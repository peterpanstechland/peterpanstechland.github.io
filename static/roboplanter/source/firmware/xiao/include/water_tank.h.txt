#pragma once
#include <cstdint>

namespace robo {
// Distance from the fixed probe to the surface. This is level, not volume.
struct TankCalibration {
  int fullMm = -1, emptyMm = -1, stopMm = -1;
  bool valid() const {
    return fullMm >= 20 && emptyMm <= 3500 &&
           fullMm < stopMm && stopMm < emptyMm;
  }
};
inline int ultrasonicDistanceMm(uint32_t pulseUs) {
  if (pulseUs == 0 || pulseUs > 21000) return -1;
  const int mm = int((pulseUs * 340U + 1000U) / 2000U);
  return mm >= 20 && mm <= 3500 ? mm : -1;
}
inline float tankLevelPercent(int mm, const TankCalibration& c) {
  if (!c.valid() || mm < 20 || mm > 3500) return -1;
  const float p = 100.0f * (c.emptyMm - mm) / (c.emptyMm - c.fullMm);
  return p < 0 ? 0 : p > 100 ? 100 : p;
}
class TankGuard {
 public:
  explicit TankGuard(TankCalibration calibration) : calibration_(calibration) {}
  void update(int distanceMm, uint32_t now) {
    distance_ = distanceMm; sampled_ = true; timestamp_ = now;
  }
  const char* error(uint32_t now) const {
    if (!calibration_.valid()) return "tank_uncalibrated";
    if (!sampled_ || uint32_t(now - timestamp_) > 3000 || distance_ < 20 || distance_ > 3500)
      return "tank_unavailable";
    if (distance_ >= calibration_.stopMm) return "tank_low";
    // Echo closer than the calibrated full surface can be an obstruction.
    if (distance_ < calibration_.fullMm) return "tank_out_of_range";
    return "";
  }
 private:
  TankCalibration calibration_;
  int distance_ = -1;
  bool sampled_ = false;
  uint32_t timestamp_ = 0;
};
} // namespace robo
