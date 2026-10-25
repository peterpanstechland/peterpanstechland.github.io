#include "indicator_board.h"
#include "indicator_rgb_driver.h"
#include <Wire.h>
#include <esp32-hal-ledc.h>

// Original SenseCAP Indicator ST7701 panel. Pin facts and register mapping:
// Seeed-Solution/SenseCAP_Indicator_ESP32 @77edb8d2, see README sources.
// Only expander port 0 LCD/touch bits are changed; RP2040 reset is port 1.
namespace {
constexpr uint8_t kExpander = 0x20;
constexpr uint8_t kTouch = 0x48;
constexpr uint8_t kCs = 1U << 4;
constexpr uint8_t kLcdReset = 1U << 5;
constexpr uint8_t kTouchIrq = 1U << 6;
constexpr uint8_t kTouchReset = 1U << 7;
// GPIO45 is the active-high LCD backlight, independent of RGB DMA timing.
// Arduino-ESP32 2.0.17 LEDC API; channel 0 is reserved for this backlight.
constexpr uint8_t kBacklightPin = 45;
constexpr uint8_t kBacklightChannel = 0;
constexpr uint32_t kBacklightHz = 5000;
constexpr uint8_t kBacklightBits = 8;
uint8_t backlightPercent = 100;
bool backlightReady = false;
uint8_t outputs = 0;
bool i2cHealthy = true;
bool touchOk = false;

bool readBytes(uint8_t addr, uint8_t reg, uint8_t *data, size_t count) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(addr, static_cast<uint8_t>(count)) != count) return false;
  for (size_t i = 0; i < count; ++i) data[i] = Wire.read();
  return true;
}
bool writeRegister(uint8_t addr, uint8_t reg, uint8_t value) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}
void setOutputs(uint8_t mask, bool high) {
  outputs = high ? outputs | mask : outputs & ~mask;
  if (!writeRegister(kExpander, 0x02, outputs)) i2cHealthy = false;
}

// Arduino_SWSPI supplies the nine-bit command/data stream; chip select lives
// on PCA9535 P04, not ESP32 GPIO4. The inherited CS is deliberately undefined.
class ExpanderSpi : public Arduino_SWSPI {
 public:
  ExpanderSpi() : Arduino_SWSPI(GFX_NOT_DEFINED, GFX_NOT_DEFINED, 41, 48) {}
  void beginWrite() override {
    Arduino_SWSPI::beginWrite();
    setOutputs(kCs, false);
  }
  void endWrite() override {
    setOutputs(kCs, true);
    Arduino_SWSPI::endWrite();
  }
};
ExpanderSpi spi;
// Canvas keeps its normal drawing implementation, but borrows the driver's
// back buffer instead of allocating a third framebuffer. No full-frame copy
// is needed. Protected fields/virtual begin are supported GFX extension points;
// there is no access to an opaque IDF handle or a private GFX object layout.
class IndicatorCanvas : public Arduino_Canvas {
 public:
  IndicatorCanvas() : Arduino_Canvas(480, 480, nullptr) {}
  ~IndicatorCanvas() {
    // Arduino_Canvas owns/frees its normal allocation. These two buffers are
    // owned by the driver and may still be in use by DMA at destruction.
    _framebuffer = nullptr;
  }
  bool begin(int32_t speed = GFX_NOT_DEFINED) override {
    if (!spi.begin()) return false;
    spi.sendCommand(0x01);
    delay(120);
    spi.batchOperation(const_cast<uint8_t *>(st7701_type1_init_operations),
                       sizeof(st7701_type1_init_operations));
    esp_lcd_rgb_panel_config_t config = {};
    config.clk_src = LCD_CLK_SRC_PLL160M;
    config.timings.pclk_hz = speed == GFX_NOT_DEFINED ? 12000000 : speed;
    config.timings.h_res = WIDTH;
    config.timings.v_res = HEIGHT;
    config.timings.hsync_pulse_width = 8;
    config.timings.hsync_back_porch = 50;
    config.timings.hsync_front_porch = 10;
    config.timings.vsync_pulse_width = 8;
    config.timings.vsync_back_porch = 20;
    config.timings.vsync_front_porch = 10;
    config.data_width = 16;
    config.sram_trans_align = 8;
    config.psram_trans_align = 64;
    config.de_gpio_num = 18; config.vsync_gpio_num = 17;
    config.hsync_gpio_num = 16; config.pclk_gpio_num = 21;
    // RGB565 bus order: B0..B4, G0..G5, R0..R4, identical to the old GFX panel.
    const int pins[] = {15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0};
    for (uint8_t i = 0; i < 16; ++i) config.data_gpio_nums[i] = pins[i];
    config.disp_gpio_num = -1;
    config.flags.fb_in_psram = true;
    return indicator_rgb::begin(config, true, &_framebuffer);
  }
  bool present() {
    if (!_framebuffer) return false;
    // The driver revokes the old pointer immediately and returns a new one
    // only after VSYNC stopped reading it. Failure leaves no writable buffer.
    return indicator_rgb::present(&_framebuffer);
  }
};
IndicatorCanvas canvas;

// The Seeed Arduino tutorial's full example adds these two orientation bits
// to Arduino_GFX's type1 table and maps touch as (479-x, 479-y).
const uint8_t kOrientation[] = {
    BEGIN_WRITE, WRITE_COMMAND_8, 0xFF,
    WRITE_BYTES, 5, 0x77, 0x01, 0x00, 0x00, 0x10,
    WRITE_C8_D8, 0xC7, 0x04,
    WRITE_COMMAND_8, 0xFF,
    WRITE_BYTES, 5, 0x77, 0x01, 0x00, 0x00, 0x00,
    WRITE_C8_D8, 0x36, 0x10, END_WRITE};
}

namespace indicator {
bool begin() {
  pinMode(kBacklightPin, OUTPUT);
  digitalWrite(kBacklightPin, LOW);
  if (!psramFound()) return false;
  Wire.begin(39, 40, 400000);
  Wire.setTimeOut(20);
  uint8_t direction;
  if (!readBytes(kExpander, 0x02, &outputs, 1) ||
      !readBytes(kExpander, 0x06, &direction, 1)) return false;
  // Preserve all other outputs and directions, especially port 1 RP2040.
  outputs = (outputs | kCs) & ~(kLcdReset | kTouchReset);
  if (!writeRegister(kExpander, 0x02, outputs)) return false;
  direction = (direction & ~(kCs | kLcdReset | kTouchReset)) | kTouchIrq;
  if (!writeRegister(kExpander, 0x06, direction)) return false;
  delay(10);
  setOutputs(kLcdReset | kTouchReset, true);
  delay(120);
  if (!canvas.begin(12000000L)) return false;
  spi.batchOperation(kOrientation, sizeof(kOrientation));
  if (!i2cHealthy) return false;
  canvas.fillScreen(0);
  if (!present()) return false;
  if (ledcSetup(kBacklightChannel, kBacklightHz, kBacklightBits) == 0) return false;
  ledcWrite(kBacklightChannel, 0);
  ledcAttachPin(kBacklightPin, kBacklightChannel);
  backlightReady = true;
  setBrightness(backlightPercent);
  uint8_t probe;
  touchOk = readBytes(kTouch, 0x02, &probe, 1);
  // FT5x06 values from Seeed's ft5x06_init; no address scanning/fallback.
  const uint8_t settings[][2] = {
      {0x80,70},{0x81,60},{0x82,16},{0x83,60},{0x84,10},
      {0x85,20},{0x87,2},{0x88,12},{0x89,40}};
  if (touchOk) {
    for (const auto &setting : settings)
      touchOk = writeRegister(kTouch, setting[0], setting[1]) && touchOk;
  }
  return true;
}
Arduino_GFX &display() { return canvas; }
bool present() { return canvas.present(); }
DisplayStats displayStats() {
  const auto value = indicator_rgb::stats();
  DisplayStats result;
  result.ready = value.ready; result.frames = value.frames;
  result.maxGapUs = value.maxGapUs; result.lastGapUs = value.lastGapUs;
  result.currentGapUs = value.currentGapUs;
  result.presentCalls = value.presentCalls; result.swaps = value.swaps;
  result.timeouts = value.timeouts; result.underflows = value.underflows;
  result.descErrors = value.descErrors; result.missingEof = value.missingEof;
  result.lastDmaRaw = value.lastDmaRaw;
  return result;
}
void setBrightness(uint8_t percent) {
  backlightPercent = percent < 5 ? 5 : (percent > 100 ? 100 : percent);
  if (backlightReady) {
    // Round to nearest 8-bit duty; the core maps 255 to constant HIGH.
    ledcWrite(kBacklightChannel,
              (static_cast<uint32_t>(backlightPercent) * 255U + 50U) / 100U);
  }
}
uint8_t brightness() { return backlightPercent; }
bool touchReady() { return touchOk; }
TouchStatus readTouchStatus(int16_t &x, int16_t &y) {
  if (!touchOk) return TouchStatus::Invalid;
  uint8_t data[5];
  if (!readBytes(kTouch, 0x02, data, sizeof(data))) return TouchStatus::Invalid;
  const uint8_t points = data[0] & 0x0F;
  if (points == 0) return TouchStatus::Up;
  if (points != 1) return TouchStatus::Invalid;
  const uint8_t event = data[1] >> 6;
  if (event == 1) return TouchStatus::Up;
  if (event == 3) return TouchStatus::Invalid;
  const uint16_t rawX = ((data[1] & 0x0F) << 8) | data[2];
  const uint16_t rawY = ((data[3] & 0x0F) << 8) | data[4];
  if (rawX >= 480 || rawY >= 480) return TouchStatus::Invalid;
  x = 479 - rawX;
  y = 479 - rawY;
  return TouchStatus::Down;
}
bool readTouch(int16_t &x, int16_t &y) { return readTouchStatus(x, y) == TouchStatus::Down; }
}
