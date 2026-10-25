#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

namespace robo {

enum class LightEffect { Solid, Breath, Chase, Rainbow };

inline bool parseLightEffect(const std::string& text, LightEffect& effect) {
  if (text == "solid") effect = LightEffect::Solid;
  else if (text == "breath") effect = LightEffect::Breath;
  else if (text == "chase") effect = LightEffect::Chase;
  else if (text == "rainbow") effect = LightEffect::Rainbow;
  else return false;
  return true;
}

inline const char* lightEffectName(LightEffect effect) {
  switch (effect) {
    case LightEffect::Breath: return "breath";
    case LightEffect::Chase: return "chase";
    case LightEffect::Rainbow: return "rainbow";
    default: return "solid";
  }
}

struct LightRgb {
  uint8_t red;
  uint8_t green;
  uint8_t blue;
  LightRgb(uint8_t r = 0, uint8_t g = 0, uint8_t b = 0) : red(r), green(g), blue(b) {}
};

inline LightRgb greenLevel(uint8_t level) {
  return LightRgb(0, level, static_cast<uint8_t>(level / 5));
}

// Pure, allocation-free frame calculation. All channels stay <= 100, and the
// hardware's existing ROBO_LED_BRIGHTNESS is applied separately by NeoPixel.
inline LightRgb lightColor(LightEffect effect, uint64_t elapsedMs, size_t index,
                           size_t count) {
  if (count == 0 || index >= count) return {};
  if (effect == LightEffect::Breath) {
    const uint32_t phase = elapsedMs % 4000U;
    const uint32_t ramp = phase <= 2000U ? phase : 4000U - phase;
    // Smoothstep gives zero slope at the bright/dim ends of a four-second cycle.
    const uint32_t x = ramp * 1000U / 2000U;
    const uint32_t eased = (x * x * (3000U - 2U * x)) / 1000000U;
    return greenLevel(static_cast<uint8_t>(5U + 95U * eased / 1000U));
  }
  if (effect == LightEffect::Chase) {
    // One LED has no space to chase; use gentle breathing instead of flicker.
    if (count == 1) return lightColor(LightEffect::Breath, elapsedMs, index, count);
    const size_t head = (elapsedMs / 240U) % count;
    const size_t distance = index <= head ? head - index : count - (index - head);
    return greenLevel(distance == 0 ? 100 : distance == 1 ? 18 : distance == 2 ? 5 : 0);
  }
  if (effect == LightEffect::Rainbow) {
    // Twelve-second colour cycle, distributed across the strip, with a low cap.
    const uint32_t offset = static_cast<uint32_t>((static_cast<uint64_t>(index) * 768U) / count);
    const uint32_t wheel = (elapsedMs % 12000U) * 768U / 12000U + offset;
    const uint8_t sector = static_cast<uint8_t>((wheel % 768U) / 256U);
    const uint8_t rising = static_cast<uint8_t>((wheel % 256U) * 85U / 255U);
    const uint8_t falling = static_cast<uint8_t>(85U - rising);
    if (sector == 0) return LightRgb(falling, rising, 0);
    if (sector == 1) return LightRgb(0, falling, rising);
    return LightRgb(rising, 0, falling);
  }
  return greenLevel(100);  // Original solid RGB(0,100,20).
}

class LightAnimation {
 public:
  // A state change starts a fresh cycle. Repeated snapshots do not restart it.
  // OFF canonicalises to solid and never leaves an animation running.
  bool configure(bool on, LightEffect effect, uint32_t now) {
    if (!on) effect = LightEffect::Solid;
    if (on_ == on && effect_ == effect) {
      // Frame updates accumulate short unsigned deltas: an effect that stays on
      // for more than one millis() wrap also keeps a continuous phase.
      if (on_) elapsedMs_ += static_cast<uint32_t>(now - updatedMs_);
      updatedMs_ = now;
      return false;
    }
    on_ = on;
    effect_ = effect;
    elapsedMs_ = 0;
    updatedMs_ = now;
    return true;
  }
  LightRgb pixel(uint32_t now, size_t index, size_t count) const {
    return on_ ? lightColor(effect_, elapsedMs_ + static_cast<uint32_t>(now - updatedMs_), index, count)
               : LightRgb{};
  }
  bool on() const { return on_; }
  LightEffect effect() const { return effect_; }

 private:
  bool on_ = false;
  LightEffect effect_ = LightEffect::Solid;
  uint32_t updatedMs_ = 0;
  uint64_t elapsedMs_ = 0;
};

}  // namespace robo
