#pragma once
#include <cstdint>
#include <cstring>

namespace robo {
// Sensor-only relay. Duplicate uploads never renew a sample's lifetime.
class RemoteSoil {
 public:
  bool accept(const char* boot, uint32_t seq, int raw, uint32_t age, uint32_t now) {
    if (!boot || std::strlen(boot) != 8 || !seq || raw < 0 || raw > 4095 || age > 1500) return false;
    for (unsigned i = 0; i < 8; ++i)
      if (!((boot[i] >= '0' && boot[i] <= '9') || (boot[i] >= 'a' && boot[i] <= 'f'))) return false;
    if (known_ && !std::strcmp(boot_, boot) && seq <= seq_) return false;
    std::memcpy(boot_, boot, 9); seq_ = seq; raw_ = raw;
    // Conservative allowance for the bounded local HTTP transfer.
    age_ = age + 1500; received_ = now; known_ = true;
    return true;
  }
  uint32_t age(uint32_t now) const {
    const uint32_t elapsed = now - received_;
    return elapsed > UINT32_MAX - age_ ? UINT32_MAX : elapsed + age_;
  }
  bool valid(uint32_t now) const { return known_ && age(now) <= 3000; }
  int raw() const { return known_ ? raw_ : -1; }
 private:
  char boot_[9] = {};
  uint32_t seq_ = 0, received_ = 0, age_ = 0;
  int raw_ = -1;
  bool known_ = false;
};
}
