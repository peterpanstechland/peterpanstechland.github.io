#pragma once
#include <cstdint>
#include <cstddef>
#include <cstring>
#include "water_tank.h"

namespace robo {
enum class CalibrationKind : uint8_t { Soil, Tank };
struct SensorCalibration {
  uint32_t revision = 0;
  int dry = -1, wet = -1;
  TankCalibration tank;
  bool soilValid() const {
    return dry >= 0 && dry <= 4095 && wet >= 0 && wet <= 4095 &&
           (dry - wet >= 64 || wet - dry >= 64);
  }
  bool tankValid() const {
    return tank.valid() && tank.stopMm - tank.fullMm >= 10 && tank.emptyMm - tank.stopMm >= 10;
  }
};
struct CalibrationEdit {
  CalibrationKind kind = CalibrationKind::Soil;
  uint32_t revision = 0;
  bool reset = false;
  int a = -1, b = -1, c = -1; // soil: dry/wet; tank: full/empty/stop
};
inline const char* applyCalibration(const SensorCalibration& current, const CalibrationEdit& edit,
                                    SensorCalibration& next) {
  if (edit.revision != current.revision) return "calibration_conflict";
  if (current.revision == UINT32_MAX) return "calibration_revision_exhausted";
  next = current;
  if (edit.kind == CalibrationKind::Soil) {
    next.dry = edit.reset ? -1 : edit.a;
    next.wet = edit.reset ? -1 : edit.b;
    if (!edit.reset && !next.soilValid()) return "invalid_soil_calibration";
  } else if (edit.kind == CalibrationKind::Tank) {
    next.tank.fullMm = edit.reset ? -1 : edit.a;
    next.tank.emptyMm = edit.reset ? -1 : edit.b;
    next.tank.stopMm = edit.reset ? -1 : edit.c;
    if (!edit.reset && !next.tankValid()) return "invalid_tank_calibration";
  } else return "invalid_calibration_kind";
  ++next.revision;
  return "";
}

// One NVS blob: power loss must never combine endpoints from different saves.
// Explicit fixed-width words avoid struct padding and reject corrupt records.
struct CalibrationRecord { uint32_t words[9] = {}; };
inline uint32_t calibrationChecksum(const CalibrationRecord& record) {
  uint32_t hash = 2166136261u;
  for (unsigned i = 0; i < 8; ++i)
    for (unsigned shift = 0; shift < 32; shift += 8)
      hash = (hash ^ ((record.words[i] >> shift) & 255u)) * 16777619u;
  return hash;
}
inline CalibrationRecord encodeCalibration(const SensorCalibration& value) {
  CalibrationRecord r;
  r.words[0] = 0x52504341; r.words[1] = 1; r.words[2] = value.revision;
  r.words[3] = uint32_t(value.dry) + 1; r.words[4] = uint32_t(value.wet) + 1;
  r.words[5] = uint32_t(value.tank.fullMm) + 1; r.words[6] = uint32_t(value.tank.emptyMm) + 1; r.words[7] = uint32_t(value.tank.stopMm) + 1;
  r.words[8] = calibrationChecksum(r);
  return r;
}
inline bool decodeCalibration(const CalibrationRecord& r, SensorCalibration& value) {
  if (r.words[0] != 0x52504341 || r.words[1] != 1 || r.words[8] != calibrationChecksum(r)) return false;
  for (unsigned i = 3; i <= 4; ++i) if (r.words[i] > 4096) return false;
  for (unsigned i = 5; i <= 7; ++i) if (r.words[i] > 3501) return false;
  SensorCalibration v;
  v.revision = r.words[2]; v.dry = static_cast<int>(r.words[3]) - 1; v.wet = static_cast<int>(r.words[4]) - 1;
  v.tank.fullMm = static_cast<int>(r.words[5]) - 1; v.tank.emptyMm = static_cast<int>(r.words[6]) - 1;
  v.tank.stopMm = static_cast<int>(r.words[7]) - 1;
  if (!(v.dry == -1 && v.wet == -1) && !v.soilValid()) return false;
  if (!(v.tank.fullMm == -1 && v.tank.emptyMm == -1 && v.tank.stopMm == -1) && !v.tankValid()) return false;
  value = v; return true;
}
template<class Storage> bool saveCalibration(Storage& storage, const SensorCalibration& value) {
  const auto record = encodeCalibration(value);
  SensorCalibration check;
  if (!decodeCalibration(record, check) || storage.putBytes("values", &record, sizeof(record)) != sizeof(record)) return false;
  CalibrationRecord readback;
  return storage.getBytesLength("values") == sizeof(readback) &&
    storage.getBytes("values", &readback, sizeof(readback)) == sizeof(readback) &&
    memcmp(&readback, &record, sizeof(record)) == 0;
}

// Five distinct fresh state snapshots, not five display frames. No stable
// value is manufactured when a sensor is absent, moving or disconnected.
class CalibrationCapture {
 public:
  void start(uint32_t now, int tolerance) { active_ = true; count_ = 0; started_ = now; tolerance_ = tolerance; last_ = 0; sum_ = 0; }
  void cancel() { active_ = false; }
  bool active() const { return active_; }
  unsigned count() const { return count_; }
  // 0 collecting, 1 complete, -1 invalid/unstable/timed out.
  int sample(int value, bool valid, uint32_t sampleId, uint32_t now, int& result) {
    if (!active_) return 0;
    if (now - started_ > 12000) { active_ = false; return -1; }
    if (count_ && sampleId == last_) return 0;
    if (!valid) { active_ = false; return -1; }
    last_ = sampleId;
    if (!count_) min_ = max_ = value;
    if (value < min_) min_ = value;
    if (value > max_) max_ = value;
    if (max_ - min_ > tolerance_) { active_ = false; return -1; }
    sum_ += value;
    if (++count_ < 5) return 0;
    result = (sum_ + 2) / 5; active_ = false; return 1;
  }
 private:
  bool active_ = false;
  unsigned count_ = 0;
  uint32_t started_ = 0, last_ = 0;
  int tolerance_ = 0, min_ = 0, max_ = 0, sum_ = 0;
};
}
