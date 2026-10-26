#pragma once
#include <Arduino.h>
#include <driver/rmt.h>
#include <cstring>

// Opt-in driver using the exact timing which passed the strip bench test.
// Externally serialized by lightMutex; uses no NeoPixel RMT allocation.
template<size_t Count> class Ws2813Rmt {
 public:
  bool begin() {
    rmt_config_t c = RMT_DEFAULT_CONFIG_TX(GPIO_NUM_40, RMT_CHANNEL_0);
    c.clk_div = 8; c.mem_block_num = 2;
    ready_ = rmt_config(&c) == ESP_OK && rmt_driver_install(RMT_CHANNEL_0, 0, 0) == ESP_OK;
    return ready_;
  }
  void setBrightness(uint8_t level) { level_ = level; }
  void clear() { std::memset(bytes_, 0, sizeof bytes_); }
  void setPixelColor(size_t i, uint8_t red, uint8_t green, uint8_t blue) {
    if (i >= Count) return;
    bytes_[i*3] = (uint16_t(green)*level_)/255;
    bytes_[i*3+1] = (uint16_t(red)*level_)/255;
    bytes_[i*3+2] = (uint16_t(blue)*level_)/255;
  }
  bool show() {
    if (!ready_) return false;
    size_t n = 0;
    for (uint8_t byte : bytes_) for (int bit=7; bit>=0; --bit) {
      const bool one = byte & (1u << bit);
      symbols_[n].level0=1; symbols_[n].duration0=one?9:3;
      symbols_[n].level1=0; symbols_[n].duration1=one?3:9; ++n;
    }
    symbols_[n].level0=0; symbols_[n].duration0=1500;
    symbols_[n].level1=0; symbols_[n].duration1=1500;
    esp_err_t error=rmt_write_items(RMT_CHANNEL_0,symbols_,n+1,false);
    if(error==ESP_OK) error=rmt_wait_tx_done(RMT_CHANNEL_0,pdMS_TO_TICKS(100));
    if(error!=ESP_OK) {rmt_tx_stop(RMT_CHANNEL_0);return false;}
    return true;
  }
 private:
  uint8_t bytes_[Count*3] = {};
  rmt_item32_t symbols_[Count*24+1] = {};
  uint8_t level_ = 24;
  bool ready_ = false;
};
