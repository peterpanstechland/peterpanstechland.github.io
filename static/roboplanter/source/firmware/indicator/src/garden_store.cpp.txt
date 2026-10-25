#include "garden_store.h"
#include <Preferences.h>
#ifdef ARDUINO
#include <Arduino.h>
#include "indicator_board.h"
#endif

namespace garden_store {
namespace {
Preferences preferences;
garden::Model game;
bool started = false, opened = false, healthy = false, dirty = false, attempted = false;
uint32_t seenRevision = 0, changedAt = 0, savedAt = 0, attemptedAt = 0;
constexpr uint32_t kCoalesceMs = 2000, kCheckpointMs = 60000, kRetryMs = 30000;

void put16(uint8_t *&p, uint16_t value) { *p++ = value & 255; *p++ = (value >> 8) & 255; }
void put32(uint8_t *&p, uint32_t value) { for (uint8_t i = 0; i < 4; ++i) *p++ = static_cast<uint8_t>(value >> (8 * i)); }
uint16_t get16(const uint8_t *&p) { const uint16_t result = p[0] | (static_cast<uint16_t>(p[1]) << 8); p += 2; return result; }
uint32_t get32(const uint8_t *&p) {
  uint32_t result = 0;
  for (uint8_t i = 0; i < 4; ++i) result |= static_cast<uint32_t>(*p++) << (8 * i);
  return result;
}
uint32_t checksum(const uint8_t *p, size_t size) {
  uint32_t value = 2166136261UL;
  while (size--) value = (value ^ *p++) * 16777619UL;
  return value;
}
} // namespace

namespace codec {
bool encode(const garden::Snapshot &s, uint8_t (&bytes)[kBlobSize]) {
  if (!garden::Model::valid(s)) return false;
  uint8_t *p = bytes;
  *p++ = 'R'; *p++ = 'P'; *p++ = 'G'; *p++ = '1';
  put16(p, 1); put16(p, static_cast<uint16_t>(kBlobSize));
  *p++ = static_cast<uint8_t>(s.selected); *p++ = static_cast<uint8_t>(s.atmosphere);
  *p++ = s.focusRewarded ? 1 : 0; *p++ = 0;
  put32(p, s.totalActiveSeconds); put32(p, s.lastFocusRewardSeconds);
  put16(p, s.totalPartialMs); put16(p, 0);
  for (size_t i = 0; i < garden::kSpeciesCount; ++i) {
    const garden::Plant &plant = s.plants[i];
    *p++ = plant.health; *p++ = plant.moisture; *p++ = plant.nutrition;
    *p++ = plant.weeds; *p++ = plant.mood; *p++ = 0;
    put16(p, plant.partialMs); put32(p, plant.xp); put32(p, plant.activeSeconds);
    for (uint8_t c = 0; c < 4; ++c) put32(p, plant.careReadySeconds[c]);
  }
  if (static_cast<size_t>(p - bytes) != kBlobSize - 4) return false;
  put32(p, checksum(bytes, kBlobSize - 4));
  return true;
}
bool decode(const uint8_t *bytes, size_t length, garden::Snapshot &out) {
  if (!bytes || length != kBlobSize || bytes[0] != 'R' || bytes[1] != 'P' || bytes[2] != 'G' || bytes[3] != '1') return false;
  const uint8_t *tail = bytes + kBlobSize - 4;
  if (get32(tail) != checksum(bytes, kBlobSize - 4)) return false;
  const uint8_t *p = bytes + 4;
  if (get16(p) != 1 || get16(p) != kBlobSize) return false;
  garden::Snapshot s;
  s.selected = static_cast<garden::Species>(*p++); s.atmosphere = static_cast<garden::Atmosphere>(*p++);
  const uint8_t focus = *p++;
  if (focus > 1 || *p++ != 0) return false;
  s.focusRewarded = focus != 0;
  s.totalActiveSeconds = get32(p); s.lastFocusRewardSeconds = get32(p);
  s.totalPartialMs = get16(p);
  if (get16(p) != 0) return false;
  for (size_t i = 0; i < garden::kSpeciesCount; ++i) {
    garden::Plant &plant = s.plants[i];
    plant.health = *p++; plant.moisture = *p++; plant.nutrition = *p++;
    plant.weeds = *p++; plant.mood = *p++;
    if (*p++ != 0) return false;
    plant.partialMs = get16(p); plant.xp = get32(p); plant.activeSeconds = get32(p);
    for (uint8_t c = 0; c < 4; ++c) plant.careReadySeconds[c] = get32(p);
  }
  if (!garden::Model::valid(s)) return false;
  out = s; // Failed validation never partially changes the destination.
  return true;
}
} // namespace codec

bool begin(uint32_t now) {
  if (started) return healthy;
  game.begin(now);
  opened = preferences.begin("rp-garden", false);
  healthy = opened;
  bool loaded = false;
  if (opened && preferences.isKey("save") && preferences.getBytesLength("save") == codec::kBlobSize) {
    uint8_t bytes[codec::kBlobSize];
    garden::Snapshot state;
    loaded = preferences.getBytes("save", bytes, sizeof(bytes)) == sizeof(bytes) &&
             codec::decode(bytes, sizeof(bytes), state) && game.restore(state, now);
  }
  dirty = !loaded; seenRevision = game.revision();
  changedAt = savedAt = attemptedAt = now;
  attempted = !opened;
  started = true;
  return healthy;
}
garden::Model &model() { return game; }
bool available() { return started && healthy; }
void service(uint32_t now) {
  if (!started) begin(now);
  game.tick(now);
  const uint32_t revision = game.revision();
  if (revision != seenRevision) { dirty = true; changedAt = now; seenRevision = revision; }
  const bool due = (dirty && now - changedAt >= kCoalesceMs) || now - savedAt >= kCheckpointMs;
  if (!due || (attempted && !healthy && now - attemptedAt < kRetryMs)) return;
  attempted = true; attemptedAt = now;
#ifdef ARDUINO
  const uint32_t writeStartedUs = micros();
  const auto framesBefore = indicator::displayStats();
#endif
  if (!opened) opened = preferences.begin("rp-garden", false);
  uint8_t bytes[codec::kBlobSize];
  const bool ok = opened && codec::encode(game.snapshot(), bytes) &&
                  preferences.putBytes("save", bytes, sizeof(bytes)) == sizeof(bytes);
  healthy = ok;
  if (ok) { dirty = false; savedAt = now; }
#ifdef ARDUINO
  // Timing only: correlate a visible glitch with a flash commit without
  // logging the save contents, network state, or any credentials.
  const uint32_t writeUs = micros() - writeStartedUs;
  const auto framesAfter = indicator::displayStats();
  Serial.printf("Garden save: uptime_ms=%lu duration_us=%lu result=%s rgb_frames=%lu max_gap_us=%lu current_gap_us=%lu presents=%lu swaps=%lu timeouts=%lu dma_udf=%lu dma_desc=%lu dma_no_eof=%lu\n",
                static_cast<unsigned long>(now),
                static_cast<unsigned long>(writeUs), ok ? "ok" : "failed",
                static_cast<unsigned long>(framesAfter.frames - framesBefore.frames),
                static_cast<unsigned long>(framesAfter.maxGapUs),
                static_cast<unsigned long>(framesAfter.currentGapUs),
                static_cast<unsigned long>(framesAfter.presentCalls),
                static_cast<unsigned long>(framesAfter.swaps),
                static_cast<unsigned long>(framesAfter.timeouts),
                static_cast<unsigned long>(framesAfter.underflows),
                static_cast<unsigned long>(framesAfter.descErrors),
                static_cast<unsigned long>(framesAfter.missingEof));
#endif
}
} // namespace garden_store
