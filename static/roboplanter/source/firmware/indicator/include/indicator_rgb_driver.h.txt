#pragma once
#include <cstdint>
#include <esp_lcd_panel_rgb.h>

// Board-owned ESP32-S3 scanout. This has its own state and exposes the buffer
// explicitly; it never reinterprets an opaque ESP-IDF or Arduino_GFX handle.
namespace indicator_rgb {
struct Stats {
  bool ready = false;
  uint32_t frames = 0, maxGapUs = 0, lastGapUs = 0, currentGapUs = 0;
  uint32_t presentCalls = 0, swaps = 0, timeouts = 0;
  uint32_t underflows = 0, descErrors = 0, missingEof = 0, lastDmaRaw = 0;
};
// One task owns rendering. begin returns the initial back buffer; every frame
// must be fully repainted. The scanout buffer must never be modified by CPU.
bool begin(const esp_lcd_rgb_panel_config_t &config, bool vsyncIdleHigh,
           uint16_t **renderBuffer);
// Write back the completed frame, queue it for VSYNC, and wait for ownership
// of the old front buffer. On failure the returned pointer is null and no
// more rendering/submission is allowed until reboot. A late VSYNC is safe.
bool present(uint16_t **nextRenderBuffer, uint32_t timeoutMs = 100);
Stats stats();
} // namespace indicator_rgb
