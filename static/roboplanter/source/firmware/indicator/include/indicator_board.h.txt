#pragma once
#include <Arduino_GFX_Library.h>
namespace indicator {
bool begin();
Arduino_GFX &display();
// Commit a completely repainted frame at VSYNC, then acquire the old front.
// On false, the caller must stop drawing: no writable buffer is retained.
bool present();
// Scanout diagnostics. Counters are sampled without blocking the VSYNC ISR.
// Compare frames before/after a storage operation; maxGapUs is since boot.
struct DisplayStats {
  bool ready = false;
  uint32_t frames = 0, maxGapUs = 0, lastGapUs = 0, currentGapUs = 0;
  uint32_t presentCalls = 0, swaps = 0, timeouts = 0;
  uint32_t underflows = 0, descErrors = 0, missingEof = 0, lastDmaRaw = 0;
};
DisplayStats displayStats();
// Backlight duty in percent, clamped to 5..100. May be set before begin();
// the requested duty is applied once the display is ready. Caller persists it.
void setBrightness(uint8_t percent);
uint8_t brightness();
enum class TouchStatus : uint8_t { Up, Down, Invalid };
// Invalid includes an I2C fault, multiple contacts, or malformed coordinates.
// Callers must cancel a pending gesture on Invalid, not treat it as release.
TouchStatus readTouchStatus(int16_t &x, int16_t &y);
// Legacy wrapper: use readTouchStatus for any release-triggered interaction.
bool readTouch(int16_t &x, int16_t &y);
bool touchReady();
}
