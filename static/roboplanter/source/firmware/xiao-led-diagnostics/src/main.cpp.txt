#include <Arduino.h>
#include <driver/rmt.h>
#include <esp_err.h>
#include <cstring>

// Robot Board V1.0 schematic and bundled rgb_led.c both use GPIO40/D13.
// The bundled header's GPIO41 comment conflicts with its implementation.
// Only GPIO40 is driven. Restore the original full flash after bench testing.
namespace {
constexpr gpio_num_t kPin = GPIO_NUM_40;
constexpr rmt_channel_t kChannel = RMT_CHANNEL_0;
constexpr uint8_t kLevel = 24;
constexpr size_t kFramePixels = 60;
uint8_t pixels[kFramePixels * 3]{};
rmt_item32_t symbols[kFramePixels * 24 + 1]{};
bool ready = false, active = false, lit = false, wasConnected = false;
bool v5Timing = false;
uint8_t phase = 0;
uint32_t changedAt = 0;
char input[32]{};
size_t used = 0;
bool overflowed = false;

bool sendFrame() {
  if (!ready) return false;
  size_t out = 0;
  for (uint8_t byte : pixels) {
    for (int bit = 7; bit >= 0; --bit) {
      const bool one = byte & (1u << bit);
      symbols[out].level0 = 1;
      symbols[out].duration0 = one ? 9 : 3;
      symbols[out].level1 = 0;
      symbols[out].duration1 = one && !v5Timing ? 3 : 9;
      ++out;
    }
  }
  // 10 MHz resolution; 300 us low after every GRB frame.
  symbols[out].level0 = 0; symbols[out].duration0 = 1500;
  symbols[out].level1 = 0; symbols[out].duration1 = 1500;
  esp_err_t err = rmt_write_items(kChannel, symbols, out + 1, false);
  if (err == ESP_OK) err = rmt_wait_tx_done(kChannel, pdMS_TO_TICKS(100));
  if (err != ESP_OK) {
    rmt_tx_stop(kChannel);
    active = false;
    Serial.printf("{\"rmt_error\":\"%s\"}\n", esp_err_to_name(err));
    return false;
  }
  return true;
}

void off() {
  std::memset(pixels, 0, sizeof pixels);
  const bool sent = sendFrame();
  active = lit = false;
  if (Serial) Serial.printf("{\"led_off_sent\":%s,\"optical_feedback\":false}\n", sent ? "true" : "false");
}

void info() {
  Serial.printf("{\"firmware\":\"xiao-led-diagnostics-0.2.0\",\"gpio\":40,\"level\":24,\"rmt_ready\":%s,\"automatic_test\":false}\n", ready ? "true" : "false");
}

void showPhase() {
  const char* names[] = {"red", "green", "blue"};
  const uint8_t grbOffset[] = {1, 0, 2};
  std::memset(pixels, 0, sizeof pixels);
  pixels[(phase % 10) * 3 + grbOffset[phase / 10]] = kLevel;
  if (!sendFrame()) { off(); return; }
  lit = true;
  changedAt = millis();
  Serial.printf("{\"phase\":%u,\"color\":\"%s\",\"requested_pixel\":%u,\"requested_lit_pixels\":1,\"timing\":\"%s\",\"rmt_completed\":true}\n",
                phase, names[phase / 10], phase % 10 + 1,
                v5Timing ? "v5-candidate" : "bundled-ws2813");
}

void command() {
  input[used] = '\0';
  if (!overflowed) {
    if ((std::strcmp(input, "TEST") == 0 || std::strcmp(input, "TESTV5") == 0)
        && !active && ready) {
      v5Timing = std::strcmp(input, "TESTV5") == 0;
      active = true; phase = 0; showPhase();
    } else if (std::strcmp(input, "OFF") == 0) off();
    else if (std::strcmp(input, "INFO") == 0) info();
  }
  used = 0; overflowed = false;
}
}  // namespace

void setup() {
  Serial.begin(115200);
  rmt_config_t config = RMT_DEFAULT_CONFIG_TX(kPin, kChannel);
  config.clk_div = 8;  // APB 80 MHz / 8 = 10 MHz, 0.1 us per tick.
  config.mem_block_num = 2;
  esp_err_t err = rmt_config(&config);
  if (err == ESP_OK) err = rmt_driver_install(kChannel, 0, 0);
  ready = err == ESP_OK;
  off();
}

void loop() {
  const bool connected = bool(Serial);
  if (connected && !wasConnected) info();
  if (!connected && wasConnected) { off(); used = 0; overflowed = false; }
  wasConnected = connected;
  while (Serial.available()) {
    const char c = char(Serial.read());
    if (c == '\n') command();
    else if (c != '\r') {
      if (used < sizeof(input) - 1) input[used++] = c;
      else overflowed = true;
    }
  }
  if (active && uint32_t(millis() - changedAt) >= (lit ? 700u : 150u)) {
    if (lit) {
      std::memset(pixels, 0, sizeof pixels);
      if (!sendFrame()) { off(); return; }
      lit = false; changedAt = millis();
    } else if (++phase >= 30) off();
    else showPhase();
  }
  delay(1);
}
