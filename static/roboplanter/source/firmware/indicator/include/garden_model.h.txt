#pragma once
#include <cstddef>
#include <cstdint>

// A screen-only companion. None of these values represent a real sensor,
// plant diagnosis, or permission to operate a pump or fertilizer dispenser.
namespace garden {
enum class Species : uint8_t { Mint, Basil, Rose, Succulent, Count };
enum class Stage : uint8_t { Seed, Sprout, Leafy, Bloom, Mature };
enum class Care : uint8_t { Water, Fertilize, Weed, Comfort };
enum class Atmosphere : uint8_t { Calm, Busy, Tired, Happy };
enum class Result : uint8_t { Applied, CoolingDown, NotNeeded, Invalid, NotReady };
constexpr size_t kSpeciesCount = 4;
constexpr uint32_t kStageMinutes[5] = {0, 5, 30, 90, 180};
constexpr uint32_t kStageXp[5] = {0, 8, 30, 75, 140};
constexpr uint32_t kCareCooldownSeconds[4] = {90, 180, 120, 60};
constexpr uint32_t kFocusSeconds = 25 * 60;
constexpr uint32_t kMaxActiveSeconds = 3153600000UL; // 100 powered years.
constexpr uint32_t kMaxXp = 1000000;

struct Plant {
  uint8_t health = 80, moisture = 60, nutrition = 55, weeds = 0, mood = 70;
  uint32_t xp = 0, activeSeconds = 0;
  uint16_t partialMs = 0;
  uint32_t careReadySeconds[4] = {};
  uint32_t activeMinutes() const { return activeSeconds / 60; }
};
struct Snapshot {
  Species selected = Species::Mint;
  Atmosphere atmosphere = Atmosphere::Calm;
  Plant plants[kSpeciesCount];
  uint32_t totalActiveSeconds = 0, lastFocusRewardSeconds = 0;
  uint16_t totalPartialMs = 0;
  bool focusRewarded = false;
};

class Model {
 public:
  void begin(uint32_t now) { state_ = Snapshot(); lastTick_ = now; started_ = true; ++revision_; }
  void tick(uint32_t now) {
    if (!started_) { lastTick_ = now; started_ = true; return; }
    const uint32_t elapsed = now - lastTick_; // millis wrap is intentional.
    lastTick_ = now;
    Plant &p = state_.plants[index(state_.selected)];
    const uint32_t before = p.activeMinutes();
    advance(p.activeSeconds, p.partialMs, elapsed);
    advance(state_.totalActiveSeconds, state_.totalPartialMs, elapsed);
    const uint32_t count = p.activeMinutes() - before;
    // After 1200 neglected minutes every simulated meter has reached its floor
    // or ceiling. Bound work even after a very long delayed loop iteration.
    const uint32_t steps = count > 1200 ? 1200 : count;
    for (uint32_t n = 1; n <= steps; ++n) minute(p, before + n);
    if (count > 1200) {
      p.health = 20; p.moisture = p.nutrition = 0;
      p.weeds = 100; p.mood = 20;
    }
  }
  Species selected() const { return state_.selected; }
  const Plant &current() const { return plant(state_.selected); }
  const Plant &plant(Species value) const {
    return state_.plants[validSpecies(value) ? index(value) : 0];
  }
  bool select(Species value) {
    if (!validSpecies(value)) return false;
    if (value != state_.selected) { state_.selected = value; ++revision_; }
    return true;
  }
  Atmosphere atmosphere() const { return state_.atmosphere; }
  bool setAtmosphere(Atmosphere value) {
    if (static_cast<uint8_t>(value) > 3) return false;
    if (value != state_.atmosphere) { state_.atmosphere = value; ++revision_; }
    return true;
  }
  Stage stage() const { return stage(state_.selected); }
  Stage stage(Species species) const {
    const Plant &p = plant(species);
    uint8_t result = 0;
    while (result < 4 && p.activeMinutes() >= kStageMinutes[result + 1] && p.xp >= kStageXp[result + 1]) ++result;
    return static_cast<Stage>(result);
  }
  uint8_t progressPercent() const {
    const uint8_t s = static_cast<uint8_t>(stage());
    if (s == 4) return 100;
    const Plant &p = current();
    const uint32_t start = kStageMinutes[s] * 60, end = kStageMinutes[s + 1] * 60;
    const uint32_t time = p.activeSeconds >= end ? 100 : (p.activeSeconds - start) * 100 / (end - start);
    const uint32_t xp = p.xp >= kStageXp[s + 1] ? 100 : (p.xp - kStageXp[s]) * 100 / (kStageXp[s + 1] - kStageXp[s]);
    return static_cast<uint8_t>(time < xp ? time : xp);
  }
  uint32_t nextStageSeconds() const {
    const uint8_t s = static_cast<uint8_t>(stage());
    if (s == 4) return 0;
    const uint32_t target = kStageMinutes[s + 1] * 60;
    return current().activeSeconds < target ? target - current().activeSeconds : 0;
  }
  uint32_t nextStageXp() const {
    const uint8_t s = static_cast<uint8_t>(stage());
    if (s == 4) return 0;
    return current().xp < kStageXp[s + 1] ? kStageXp[s + 1] - current().xp : 0;
  }
  uint32_t remainingSeconds(Care action) const {
    const uint8_t n = static_cast<uint8_t>(action);
    if (n > 3) return 0;
    const Plant &p = current();
    const uint32_t target = p.careReadySeconds[n];
    return target > p.activeSeconds ? target - p.activeSeconds : 0;
  }
  Result care(Care action) {
    const uint8_t n = static_cast<uint8_t>(action);
    if (n > 3) return Result::Invalid;
    if (action == Care::Fertilize && stage() == Stage::Seed) return Result::NotReady;
    Plant &p = state_.plants[index(state_.selected)];
    if (remainingSeconds(action)) return Result::CoolingDown;
    if ((action == Care::Water && p.moisture >= 85) ||
        (action == Care::Fertilize && p.nutrition >= 80) ||
        (action == Care::Weed && p.weeds == 0) ||
        (action == Care::Comfort && p.mood >= 95)) return Result::NotNeeded;
    uint8_t gain = 0;
    switch (action) {
      case Care::Water: p.moisture = add(p.moisture, 30); gain = 8; break;
      case Care::Fertilize: p.nutrition = add(p.nutrition, 30); gain = 10; break;
      case Care::Weed: p.weeds = 0; gain = 6; break;
      case Care::Comfort: p.mood = add(p.mood, 18); gain = 2; break;
    }
    p.health = add(p.health, action == Care::Comfort ? 2 : 6);
    p.mood = add(p.mood, 3);
    p.xp = boundedAdd(p.xp, gain, kMaxXp);
    p.careReadySeconds[n] = boundedAdd(p.activeSeconds, kCareCooldownSeconds[n], UINT32_MAX);
    ++revision_;
    return Result::Applied;
  }
  // The caller invokes this only at a completed 25-minute focus edge. The
  // persisted powered-time gate additionally rejects duplicate calls/reboots.
  Result rewardFocus() {
    if (state_.totalActiveSeconds < kFocusSeconds) return Result::NotReady;
    if (state_.focusRewarded && state_.totalActiveSeconds - state_.lastFocusRewardSeconds < kFocusSeconds)
      return Result::CoolingDown;
    Plant &p = state_.plants[index(state_.selected)];
    p.xp = boundedAdd(p.xp, 20, kMaxXp);
    p.health = add(p.health, 5); p.mood = add(p.mood, 12);
    state_.focusRewarded = true; state_.lastFocusRewardSeconds = state_.totalActiveSeconds;
    ++revision_;
    return Result::Applied;
  }
  Snapshot snapshot() const { return state_; }
  // Public snapshot import is used by persistence and native preview fixtures.
  // Loading never advances offline time or clears an outstanding cooldown.
  bool restore(const Snapshot &saved, uint32_t now) {
    if (!valid(saved)) return false;
    state_ = saved; lastTick_ = now; started_ = true; ++revision_;
    return true;
  }
  uint32_t revision() const { return revision_; } // Explicit changes, not clock ticks.
  static bool valid(const Snapshot &s) {
    if (!validSpecies(s.selected) || static_cast<uint8_t>(s.atmosphere) > 3 ||
        s.totalActiveSeconds > kMaxActiveSeconds || s.totalPartialMs >= 1000 ||
        s.lastFocusRewardSeconds > s.totalActiveSeconds ||
        (!s.focusRewarded && s.lastFocusRewardSeconds != 0) ||
        (s.focusRewarded && s.lastFocusRewardSeconds < kFocusSeconds)) return false;
    for (size_t i = 0; i < kSpeciesCount; ++i) {
      const Plant &p = s.plants[i];
      if (p.health < 20 || p.health > 100 || p.moisture > 100 || p.nutrition > 100 ||
          p.weeds > 100 || p.mood > 100 || p.xp > kMaxXp ||
          p.activeSeconds > kMaxActiveSeconds || p.partialMs >= 1000) return false;
      for (uint8_t c = 0; c < 4; ++c)
        if (p.careReadySeconds[c] > p.activeSeconds && p.careReadySeconds[c] - p.activeSeconds > kCareCooldownSeconds[c]) return false;
    }
    return true;
  }
 private:
  Snapshot state_;
  uint32_t lastTick_ = 0, revision_ = 0;
  bool started_ = false;
  static size_t index(Species s) { return static_cast<uint8_t>(s); }
  static bool validSpecies(Species s) { return index(s) < kSpeciesCount; }
  static uint8_t add(uint8_t v, uint8_t n) { return v + n > 100 ? 100 : static_cast<uint8_t>(v + n); }
  static uint8_t subtract(uint8_t v, uint8_t n, uint8_t floor = 0) { return v > floor + n ? static_cast<uint8_t>(v - n) : floor; }
  static uint32_t boundedAdd(uint32_t a, uint32_t b, uint32_t maximum) { return b > maximum - a ? maximum : a + b; }
  static void advance(uint32_t &seconds, uint16_t &remainder, uint32_t elapsed) {
    const uint64_t ms = static_cast<uint64_t>(remainder) + elapsed;
    seconds = boundedAdd(seconds, static_cast<uint32_t>(ms / 1000), kMaxActiveSeconds);
    remainder = seconds == kMaxActiveSeconds ? 0 : static_cast<uint16_t>(ms % 1000);
  }
  void minute(Plant &p, uint32_t minuteNumber) {
    const Species species = state_.selected;
    const uint8_t thirst = species == Species::Mint || species == Species::Basil ? 2 : 1;
    if (species != Species::Succulent || minuteNumber % 3 == 0) p.moisture = subtract(p.moisture, thirst);
    p.nutrition = subtract(p.nutrition, 1);
    if (minuteNumber % 10 == 0) p.weeds = add(p.weeds, 1);
    const bool struggling = p.moisture < 20 || p.nutrition < 15 || p.weeds > 70;
    p.health = struggling ? subtract(p.health, 1, 20) : add(p.health, 1);
    p.mood = subtract(p.mood, 1, 20);
  }
};
} // namespace garden
