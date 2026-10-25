#include "lcd_diagnostics.h"
#if defined(ARDUINO) && defined(RP_LCD_FLASH_STRESS)
#include <Arduino.h>
#include <Preferences.h>
#include <cstring>
#include "indicator_board.h"

namespace lcd_diagnostics {
bool runFlashStress() {
  // Enough changing blobs to cross NVS page boundaries and exercise garbage
  // collection. No writes to the user's rp-garden/rp-settings/rp-ui namespaces.
  Preferences scratch;
  if (!scratch.begin("rp-lcd-test", false)) {
    Serial.println("LCD flash stress: scratch namespace unavailable");
    return false;
  }
  delay(300);
  const auto before = indicator::displayStats();
  const uint32_t started = millis();
  uint32_t longestWriteUs = 0;
  unsigned failures = 0, writes = 0;
  uint8_t bytes[156], restored[sizeof(bytes)];
  Serial.println("LCD flash stress: begin 96 scratch writes with frame swaps");
  for (unsigned i = 0; i < 96; ++i) {
    // Constant grid and a small progress bar exercise complete redraws. Each
    // back buffer is fully repainted; no alternating stale/blank frames.
    auto &g = indicator::display();
    g.fillScreen(0x10A2);
    g.drawRect(24, 24, 432, 432, 0xFFFF);
    for (int16_t y = 70; y < 440; y += 40) g.drawFastHLine(24, y, 432, 0x7BEF);
    g.fillRect(32, 36, static_cast<int16_t>((i + 1) * 4), 12, 0x7CCF);
    if (!indicator::present()) { ++failures; break; }
    for (size_t j = 0; j < sizeof(bytes); ++j)
      bytes[j] = static_cast<uint8_t>(i + j * 17U);
    const uint32_t startUs = micros();
    const bool saved = scratch.putBytes("probe", bytes, sizeof(bytes)) == sizeof(bytes);
    ++writes;
    const uint32_t durationUs = micros() - startUs;
    if (durationUs > longestWriteUs) longestWriteUs = durationUs;
    if (!saved || scratch.getBytes("probe", restored, sizeof(restored)) != sizeof(restored) ||
        std::memcmp(bytes, restored, sizeof(bytes)) != 0) ++failures;
    delay(37); // Vary the write phase relative to the ~24 ms RGB frame.
  }
  if (!scratch.clear()) ++failures;
  scratch.end();
  delay(300);
  const auto after = indicator::displayStats();
  Serial.printf("LCD flash stress: writes=%u failures=%u elapsed_ms=%lu longest_write_us=%lu frames=%lu max_gap_us=%lu current_gap_us=%lu presents=%lu swaps=%lu timeouts=%lu dma_udf=%lu dma_desc=%lu dma_no_eof=%lu\n",
                writes, failures, static_cast<unsigned long>(millis() - started),
                static_cast<unsigned long>(longestWriteUs),
                static_cast<unsigned long>(after.frames - before.frames),
                static_cast<unsigned long>(after.maxGapUs),
                static_cast<unsigned long>(after.currentGapUs),
                static_cast<unsigned long>(after.presentCalls - before.presentCalls),
                static_cast<unsigned long>(after.swaps - before.swaps),
                static_cast<unsigned long>(after.timeouts - before.timeouts),
                static_cast<unsigned long>(after.underflows - before.underflows),
                static_cast<unsigned long>(after.descErrors - before.descErrors),
                static_cast<unsigned long>(after.missingEof - before.missingEof));
  // Diagnostic numbers measure IRQ continuity, not visible pixel correctness.
  return failures == 0 && writes == 96 && after.swaps - before.swaps == 96 &&
         after.timeouts == before.timeouts && after.descErrors == before.descErrors;
}
}
#endif
