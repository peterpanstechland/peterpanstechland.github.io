/*
 * SPDX-FileCopyrightText: 2021-2022 Espressif Systems (Shanghai) CO LTD
 * SPDX-FileCopyrightText: 2026 RoboPlanter contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The initialization and one-shot DMA/VSYNC restart sequence are adapted from
 * ESP-IDF v4.4.7 components/esp_lcd/src/esp_lcd_rgb_panel.c:
 * https://github.com/espressif/esp-idf/blob/v4.4.7/components/esp_lcd/src/esp_lcd_rgb_panel.c
 * The Apache-2.0 license text is included at ../third_party/esp-idf-LICENSE.
 *
 * This deliberately narrow driver owns the Indicator's sole LCD peripheral.
 * It does not coexist with another RGB/I80 driver on that peripheral. Unlike
 * the prebuilt Arduino 2.0.17 driver, its entire VSYNC restart call graph lives
 * in IRAM/ROM and touches only internal RAM and peripheral registers. GDMA is
 * allocated through the IDF API; its documented get_channel_id escape hatch
 * allows the ISR to use the version-pinned HAL without private handle casts.
 *
 * This prevents cache-disabled flash writes from deferring frame restarts.
 * Two independent DMA chains allow a completed frame to replace the front
 * only at VSYNC. CPU rendering never touches the current scanout buffer.
 * It does not remove Flash/PSRAM bus contention: hardware observation during
 * NVS page reclamation is still required before declaring flicker resolved.
 */
#include "indicator_rgb_driver.h"
#include <esp_arduino_version.h>
#include <esp_idf_version.h>
#include <esp_attr.h>
#include <esp_heap_caps.h>
#include <esp_intr_alloc.h>
#include <esp_pm.h>
#include <esp_rom_gpio.h>
#include <esp_rom_sys.h>
#include <esp_timer.h>
#include <esp_private/gdma.h>
#include <driver/gpio.h>
#include <driver/periph_ctrl.h>
#include <hal/dma_types.h>
#include <hal/gdma_ll.h>
#include <hal/gpio_hal.h>
#include <hal/lcd_hal.h>
#include <hal/lcd_ll.h>
#include <soc/lcd_periph.h>
#include <soc/soc_caps.h>
#include <esp32s3/rom/cache.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <cstdlib>

#if !CONFIG_IDF_TARGET_ESP32S3 || ESP_IDF_VERSION != ESP_IDF_VERSION_VAL(4, 4, 7) || \
    ESP_ARDUINO_VERSION != ESP_ARDUINO_VERSION_VAL(2, 0, 17)
#error "Re-audit the Indicator RGB HAL and IRAM call graph before changing SDK versions."
#endif
static_assert(SOC_GDMA_GROUPS == 1 && SOC_LCD_RGB_PANELS == 1,
              "This driver owns ESP32-S3's one LCD and uses its single GDMA group.");

namespace indicator_rgb {
namespace {
// 4032 is a multiple of the 64-byte external-memory transfer alignment and
// fits the 12-bit DMA descriptor size. Every descriptor starts aligned.
constexpr size_t kAlignment = 64;
constexpr size_t kDescriptorBytes = (DMA_DESCRIPTOR_BUFFER_MAX_SIZE / kAlignment) * kAlignment;
constexpr uint32_t kNoBuffer = 2;
static_assert(__atomic_always_lock_free(sizeof(uint32_t), nullptr),
              "VSYNC handoff requires inline, lock-free 32-bit atomics.");
struct State {
  lcd_hal_context_t lcd;
  gdma_dev_t *dmaDevice;
  gdma_channel_handle_t dma;
  esp_pm_lock_handle_t powerLock;
  intr_handle_t interrupt;
  dma_descriptor_t *descriptors[2];
  uint16_t *framebuffer[2];
  size_t framebufferBytes;
  uint32_t dmaChannel;
  TaskHandle_t producerTask;
  BaseType_t producerCore;
  bool moduleEnabled, dmaConnected, ready, presentFailed;
  // front belongs to the ISR; back belongs to the sole rendering task.
  // pending and acknowledged are published with release/acquire ordering.
  uint32_t front, back, pending, acknowledged;
  uint32_t submitted;
  volatile uint32_t presentCalls, timeouts;
  volatile uint32_t sequence, frames, lastUs, lastGapUs, maxGapUs;
  volatile uint32_t swaps, underflows, descErrors, missingEof, lastDmaRaw;
};
// Explicit internal placement matters while flash operations disable caches.
DRAM_ATTR State state = {};

// The HAL register helpers below are always_inline in the pinned SDK. Do not
// replace these with gdma_start/reset: those prebuilt functions live in flash.
static void IRAM_ATTR restartFrame(State *s) {
  gdma_ll_tx_reset_channel(s->dmaDevice, s->dmaChannel);
  lcd_ll_stop(s->lcd.dev);
  lcd_ll_fifo_reset(s->lcd.dev);
  gdma_ll_tx_set_desc_addr(s->dmaDevice, s->dmaChannel,
                         reinterpret_cast<uint32_t>(s->descriptors[s->front]));
  gdma_ll_tx_start(s->dmaDevice, s->dmaChannel);
  esp_rom_delay_us(1); // Same FIFO priming delay as ESP-IDF v4.4.7.
  lcd_ll_start(s->lcd.dev);
}

static void IRAM_ATTR onVsync(void *context) {
  State *s = static_cast<State *>(context);
  const uint32_t pending = lcd_ll_get_interrupt_status(s->lcd.dev);
  lcd_ll_clear_interrupt_status(s->lcd.dev, pending);
  if (!(pending & LCD_LL_EVENT_VSYNC_END)) return;

  // Both esp_timer_get_time and its systimer HAL callee are linked into IRAM
  // by this SDK. Use only the low 32 bits: unsigned interval math wraps safely.
  const uint32_t now = static_cast<uint32_t>(esp_timer_get_time());
  ++s->sequence;
  const uint32_t gap = now - s->lastUs;
  s->lastUs = now;
  s->lastGapUs = gap;
  if (gap > s->maxGapUs) s->maxGapUs = gap;

  // get_interrupt_status() reads int_st, masked by int_ena. No GDMA IRQ is
  // installed here, so read the public SoC raw register instead. These are
  // diagnostic events, not a guarantee that a visible pixel was corrupted.
  const uint32_t dmaRaw = s->dmaDevice->channel[s->dmaChannel].out.int_raw.val;
  s->lastDmaRaw = dmaRaw;
  if (s->frames) { // Ignore initialization/first-frame transients.
    if (dmaRaw & (GDMA_LL_EVENT_TX_L3_FIFO_UDF | GDMA_LL_EVENT_TX_L1_FIFO_UDF)) ++s->underflows;
    if (dmaRaw & GDMA_LL_EVENT_TX_DESC_ERROR) ++s->descErrors;
    if (!(dmaRaw & GDMA_LL_EVENT_TX_TOTAL_EOF)) ++s->missingEof;
  }
  gdma_ll_tx_clear_interrupt_status(s->dmaDevice, s->dmaChannel, GDMA_LL_TX_EVENT_MASK);

  const uint32_t next = __atomic_load_n(&s->pending, __ATOMIC_ACQUIRE);
  const bool swap = next < kNoBuffer;
  if (swap) s->front = next;
  restartFrame(s);
  // The old front is not released until reset/stop/restart have completed.
  // No pixels or cache-maintenance routines are accessed in this ISR.
  if (swap) {
    __atomic_store_n(&s->pending, kNoBuffer, __ATOMIC_RELAXED);
    ++s->swaps;
    __atomic_store_n(&s->acknowledged, s->swaps, __ATOMIC_RELEASE);
  }
  ++s->frames;
  ++s->sequence;
}

void cleanup() {
  if (state.interrupt) {
    esp_intr_disable(state.interrupt);
    esp_intr_free(state.interrupt);
  }
  if (state.moduleEnabled) {
    lcd_ll_enable_interrupt(state.lcd.dev, LCD_LL_EVENT_VSYNC_END, false);
    lcd_ll_stop(state.lcd.dev);
  }
  if (state.dma) {
    gdma_stop(state.dma);
    if (state.dmaConnected) gdma_disconnect(state.dma);
    gdma_del_channel(state.dma);
  }
  if (state.moduleEnabled) {
    lcd_ll_enable_clock(state.lcd.dev, false);
    periph_module_disable(lcd_periph_signals.panels[0].module);
  }
  if (state.powerLock) {
    esp_pm_lock_release(state.powerLock);
    esp_pm_lock_delete(state.powerLock);
  }
  for (uint32_t i = 0; i < 2; ++i) {
    free(state.descriptors[i]);
    free(state.framebuffer[i]);
  }
  state = {};
}
bool connectPin(int pin, int signal) {
  if (!GPIO_IS_VALID_OUTPUT_GPIO(pin)) return false;
  gpio_hal_iomux_func_sel(GPIO_PIN_MUX_REG[pin], PIN_FUNC_GPIO);
  if (gpio_set_direction(static_cast<gpio_num_t>(pin), GPIO_MODE_OUTPUT) != ESP_OK) return false;
  esp_rom_gpio_connect_out_signal(pin, signal, false, false);
  return true;
}
} // namespace

bool begin(const esp_lcd_rgb_panel_config_t &config, bool vsyncIdleHigh,
           uint16_t **renderBuffer) {
  if (!renderBuffer) return false;
  *renderBuffer = nullptr;
  // Reinitialization cannot safely grant ownership of a submitted buffer.
  if (state.ready) return false;
  // Keep the supported hardware/configuration explicit. Additional modes must
  // be implemented, rather than silently ignored by this board-specific path.
  if (config.data_width != 16 || config.timings.h_res != 480 || config.timings.v_res != 480 ||
      config.clk_src != LCD_CLK_SRC_PLL160M || config.timings.pclk_hz != 12000000 ||
      !config.flags.fb_in_psram || config.flags.relax_on_idle || config.on_frame_trans_done ||
      config.user_ctx || config.disp_gpio_num >= 0) return false;
  const size_t bytes = config.timings.h_res * config.timings.v_res * sizeof(uint16_t);
  const size_t count = (bytes + kDescriptorBytes - 1) / kDescriptorBytes;
  state.framebufferBytes = bytes;
  state.front = 0;
  state.back = 1;
  state.pending = kNoBuffer;
  state.producerTask = xTaskGetCurrentTaskHandle();
  state.producerCore = xPortGetCoreID();
  for (uint32_t frame = 0; frame < 2; ++frame) {
    state.framebuffer[frame] = static_cast<uint16_t *>(heap_caps_aligned_calloc(
        kAlignment, 1, bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    state.descriptors[frame] = static_cast<dma_descriptor_t *>(heap_caps_calloc(
        count, sizeof(dma_descriptor_t), MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL));
    if (!state.framebuffer[frame] || !state.descriptors[frame]) { cleanup(); return false; }
    size_t offset = 0;
    for (size_t i = 0; i < count; ++i) {
      dma_descriptor_t &node = state.descriptors[frame][i];
      const size_t remaining = bytes - offset;
      const size_t length = remaining < kDescriptorBytes ? remaining : kDescriptorBytes;
      node.dw0.size = length;
      node.dw0.length = length;
      node.dw0.owner = DMA_DESCRIPTOR_BUFFER_OWNER_DMA;
      node.dw0.suc_eof = i + 1 == count;
      node.buffer = reinterpret_cast<uint8_t *>(state.framebuffer[frame]) + offset;
      node.next = i + 1 == count ? nullptr : &state.descriptors[frame][i + 1];
      offset += length;
    }
    Cache_WriteBack_Addr(reinterpret_cast<uint32_t>(state.framebuffer[frame]), bytes);
  }
  // The default stream driver also uses a one-shot chain, restarted at VSYNC.
  // Do not enable hardware auto-next-frame: the pinned IDF documents hardware
  // limitations and deliberately uses this software restart sequence instead.
  periph_module_enable(lcd_periph_signals.panels[0].module);
  periph_module_reset(lcd_periph_signals.panels[0].module);
  state.moduleEnabled = true;
  lcd_hal_init(&state.lcd, 0);
  lcd_ll_enable_clock(state.lcd.dev, true);
  lcd_ll_select_clk_src(state.lcd.dev, LCD_CLK_SRC_PLL160M);
#if CONFIG_PM_ENABLE
  if (esp_pm_lock_create(ESP_PM_APB_FREQ_MAX, 0, "indicator-rgb", &state.powerLock) != ESP_OK) {
    cleanup(); return false;
  }
  if (esp_pm_lock_acquire(state.powerLock) != ESP_OK) {
    esp_pm_lock_delete(state.powerLock);
    state.powerLock = nullptr;
    cleanup(); return false;
  }
#endif

  gdma_channel_alloc_config_t allocation = {};
  allocation.direction = GDMA_CHANNEL_DIRECTION_TX;
  if (gdma_new_channel(&allocation, &state.dma) != ESP_OK) { cleanup(); return false; }
  if (gdma_connect(state.dma, GDMA_MAKE_TRIGGER(GDMA_TRIG_PERIPH_LCD, 0)) != ESP_OK) { cleanup(); return false; }
  state.dmaConnected = true;
  int channel = -1;
  if (gdma_get_channel_id(state.dma, &channel) != ESP_OK || channel < 0) { cleanup(); return false; }
  state.dmaChannel = static_cast<uint32_t>(channel);
  state.dmaDevice = GDMA_LL_GET_HW(0);
  gdma_transfer_ability_t ability = {};
  ability.psram_trans_align = kAlignment;
  ability.sram_trans_align = 8;
  gdma_strategy_config_t strategy = {};
  strategy.owner_check = false;
  strategy.auto_update_desc = false;
  if (gdma_set_transfer_ability(state.dma, &ability) != ESP_OK ||
      gdma_apply_strategy(state.dma, &strategy) != ESP_OK) { cleanup(); return false; }

  const auto &pins = lcd_periph_signals.panels[0];
  for (size_t i = 0; i < 16; ++i)
    if (!connectPin(config.data_gpio_nums[i], pins.data_sigs[i])) { cleanup(); return false; }
  if (!connectPin(config.hsync_gpio_num, pins.hsync_sig) ||
      !connectPin(config.vsync_gpio_num, pins.vsync_sig) ||
      !connectPin(config.de_gpio_num, pins.de_sig) ||
      !connectPin(config.pclk_gpio_num, pins.pclk_sig)) { cleanup(); return false; }

  lcd_ll_fifo_reset(state.lcd.dev);
  lcd_ll_reset(state.lcd.dev);
  const auto &timing = config.timings;
  const int clockFlags = (!timing.flags.pclk_active_neg && !timing.flags.pclk_idle_high)
                          ? LCD_HAL_PCLK_FLAG_ALLOW_EQUAL_SYSCLK : 0;
  lcd_hal_cal_pclk_freq(&state.lcd, 160000000, timing.pclk_hz, clockFlags);
  lcd_ll_set_clock_idle_level(state.lcd.dev, timing.flags.pclk_idle_high);
  lcd_ll_set_pixel_clock_edge(state.lcd.dev, timing.flags.pclk_active_neg);
  lcd_ll_enable_rgb_mode(state.lcd.dev, true);
  lcd_ll_set_data_width(state.lcd.dev, 16);
  lcd_ll_set_phase_cycles(state.lcd.dev, 0, 0, 1);
  lcd_ll_enable_output_always_on(state.lcd.dev, true);
  lcd_ll_set_idle_level(state.lcd.dev, !timing.flags.hsync_idle_low,
                        vsyncIdleHigh, timing.flags.de_idle_high);
  lcd_ll_set_blank_cycles(state.lcd.dev, 1, 1);
  lcd_ll_set_horizontal_timing(state.lcd.dev, timing.hsync_pulse_width,
      timing.hsync_back_porch, timing.h_res, timing.hsync_front_porch);
  lcd_ll_set_vertical_timing(state.lcd.dev, timing.vsync_pulse_width,
      timing.vsync_back_porch, timing.v_res, timing.vsync_front_porch);
  lcd_ll_enable_output_hsync_in_porch_region(state.lcd.dev, true);
  lcd_ll_set_hsync_position(state.lcd.dev, 0);
  lcd_ll_enable_auto_next_frame(state.lcd.dev, false);
  lcd_ll_enable_interrupt(state.lcd.dev, LCD_LL_EVENT_VSYNC_END, false);
  lcd_ll_clear_interrupt_status(state.lcd.dev, UINT32_MAX);

  const int interruptFlags = ESP_INTR_FLAG_IRAM | ESP_INTR_FLAG_INTRDISABLED | ESP_INTR_FLAG_SHARED;
  if (esp_intr_alloc_intrstatus(pins.irq_id, interruptFlags,
        reinterpret_cast<uint32_t>(lcd_ll_get_interrupt_status_reg(state.lcd.dev)),
        LCD_LL_EVENT_VSYNC_END, onVsync, &state, &state.interrupt) != ESP_OK) {
    cleanup(); return false;
  }
  state.lastUs = static_cast<uint32_t>(esp_timer_get_time());
  gdma_ll_tx_clear_interrupt_status(state.dmaDevice, state.dmaChannel, GDMA_LL_TX_EVENT_MASK);
  lcd_ll_enable_interrupt(state.lcd.dev, LCD_LL_EVENT_VSYNC_END, true);
  if (esp_intr_enable(state.interrupt) != ESP_OK) { cleanup(); return false; }
  state.ready = true;
  restartFrame(&state);
  *renderBuffer = state.framebuffer[state.back];
  return true;
}

bool present(uint16_t **nextRenderBuffer, uint32_t timeoutMs) {
  if (!nextRenderBuffer) return false;
  *nextRenderBuffer = nullptr;
  if (!state.ready || state.presentFailed) return false;
  if (xTaskGetCurrentTaskHandle() != state.producerTask || xPortGetCoreID() != state.producerCore) {
    // This is a single-producer protocol. Do not make a second task a writer.
    return false;
  }
  ++state.presentCalls;
  // Synchronous writeback happens while this buffer is owned by CPU. The
  // release store must be after it, so VSYNC cannot see a partial frame.
  Cache_WriteBack_Addr(reinterpret_cast<uint32_t>(state.framebuffer[state.back]), state.framebufferBytes);
  const uint32_t target = ++state.submitted;
  __atomic_store_n(&state.pending, state.back, __ATOMIC_RELEASE);
  const int64_t deadline = esp_timer_get_time() + static_cast<int64_t>(timeoutMs) * 1000;
  while (__atomic_load_n(&state.acknowledged, __ATOMIC_ACQUIRE) != target) {
    if (esp_timer_get_time() >= deadline) {
      ++state.timeouts;
      state.presentFailed = true;
      // Do not cancel pending: the ISR may already have switched. Never give
      // either buffer back after timeout; a late completed swap remains safe.
      return false;
    }
    vTaskDelay(1);
  }
  state.back ^= 1U;
  *nextRenderBuffer = state.framebuffer[state.back];
  return true;
}

Stats stats() {
  Stats result;
  result.ready = state.ready;
  if (!result.ready) return result;
  uint32_t sequence, last, now;
  do {
    sequence = state.sequence;
    if (sequence & 1U) continue;
    result.frames = state.frames;
    result.maxGapUs = state.maxGapUs;
    result.lastGapUs = state.lastGapUs;
    result.presentCalls = state.presentCalls;
    result.swaps = state.swaps;
    result.timeouts = state.timeouts;
    result.underflows = state.underflows;
    result.descErrors = state.descErrors;
    result.missingEof = state.missingEof;
    result.lastDmaRaw = state.lastDmaRaw;
    last = state.lastUs;
    now = static_cast<uint32_t>(esp_timer_get_time());
  } while ((sequence & 1U) || sequence != state.sequence);
  result.currentGapUs = now - last;
  return result;
}
} // namespace indicator_rgb
