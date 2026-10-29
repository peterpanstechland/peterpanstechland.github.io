#include <cassert>
#include <iostream>
#include <vector>
#include "../../firmware/xiao/include/controller.h"
#include "../../firmware/xiao/include/calibration_json.h"
struct Storage {
  std::vector<uint8_t> bytes;
  bool fail = false, corrupt = false;
  size_t putBytes(const char*, const void* p, size_t n) {
    if (fail) return 0;
    bytes.assign(static_cast<const uint8_t*>(p), static_cast<const uint8_t*>(p) + n);
    if (corrupt) bytes.back() ^= 1;
    return n;
  }
  size_t getBytesLength(const char*) { return bytes.size(); }
  size_t getBytes(const char*, void* p, size_t n) { if (bytes.size() != n) return 0; memcpy(p, bytes.data(), n); return n; }
};
int main() {
  using namespace robo;
  SensorCalibration current, next;
  CalibrationEdit soil{CalibrationKind::Soil, 0, false, 3000, 1500};
  assert(!*applyCalibration(current, soil, next)); assert(next.soilValid() && next.revision == 1);
  current = next;
  assert(!strcmp(applyCalibration(current, soil, next), "calibration_conflict"));
  soil.revision = 1;
  soil.b = 2990; assert(*applyCalibration(current, soil, next));
  soil.b = -1; assert(*applyCalibration(current, soil, next));
  soil.a = 1000; soil.b = 3000; assert(!*applyCalibration(current, soil, next)); // reversed ADC direction works
  assert(soilPercent(2000, next.dry, next.wet) == 50);
  CalibrationEdit tank{CalibrationKind::Tank, 1, false, 40, 300, 260};
  assert(!*applyCalibration(current, tank, next)); assert(next.dry == current.dry && next.wet == current.wet);
  current = next;
  tank.revision = current.revision;
  for (int invalid : {10, 40, 45, 295, 300, 5000}) { tank.c = invalid; assert(*applyCalibration(current, tank, next)); }
  tank.c = 260;
  auto record = encodeCalibration(current);
  assert(decodeCalibration(record, next) && next.tankValid() && next.soilValid());
  for (unsigned i = 0; i < 9; ++i) { auto broken = record; broken.words[i] ^= 1; assert(!decodeCalibration(broken, next)); }
  Storage storage;
  assert(saveCalibration(storage, current));
  storage.fail = true; assert(!saveCalibration(storage, current)); storage.fail = false;
  storage.corrupt = true; assert(!saveCalibration(storage, current)); storage.corrupt = false;
  CalibrationEdit reset{CalibrationKind::Tank, current.revision, true};
  assert(!*applyCalibration(current, reset, next));
  assert(!next.tankValid() && next.soilValid()); assert(saveCalibration(storage, next));
  CalibrationRecord reboot;
  assert(storage.getBytes("values", &reboot, sizeof(reboot)) == sizeof(reboot));
  SensorCalibration restored; assert(decodeCalibration(reboot, restored));
  assert(!restored.tankValid() && restored.dry == 3000 && restored.wet == 1500); // reset persists, other sensor survives

  Config config; config.actionsEnabled = config.credentialsConfigured = config.pumpEnabled = config.tankRequired = true;
  config.tankCalibration = current.tank;
  Controller controller(config); controller.updateTank(100, 1000);
  Command water; water.action = "water"; water.requestId = "water-before"; water.hasDuration = true; water.durationMs = 1000;
  assert(controller.beginCalibration());
  assert(controller.submit(water, 1001).error == "calibration_busy");
  controller.finishCalibration(current.tank);
  water.requestId = "water-after"; assert(controller.submit(water, 1002).ok);
  assert(!controller.beginCalibration()); // cannot change thresholds under an active pump
  controller.tick(2100); assert(!controller.pumpOn());
  assert(controller.beginCalibration()); controller.finishCalibration(TankCalibration());
  water.requestId = "after-reset"; assert(controller.submit(water, 2200).error == "tank_uncalibrated");

  CalibrationCapture capture; int value = -1;
  capture.start(100, 4);
  assert(capture.sample(100, true, 1, 100, value) == 0);
  for (int i = 0; i < 20; ++i) capture.sample(100, true, 1, 200, value);
  assert(capture.count() == 1); // display frames do not count as sensor samples
  for (unsigned i = 2; i <= 4; ++i) assert(capture.sample(101, true, i, i*1000, value) == 0);
  assert(capture.sample(102, true, 5, 5000, value) == 1 && value == 101);
  capture.start(0, 4); capture.sample(100, true, 1, 0, value);
  assert(capture.sample(105, true, 2, 1000, value) == -1);
  capture.start(0, 4); assert(capture.sample(100, false, 2, 10, value) == -1);
  capture.start(0, 4); assert(capture.sample(100, true, 2, 12001, value) == -1);
  capture.start(UINT32_MAX-1000, 4); assert(capture.sample(100, true, 2, 200, value) == 0);
  for (const char* body : {R"({"kind":"soil","revision":0,"reset":false,"dry":3000,"wet":1500})",
                            R"({"kind":"tank","revision":1,"reset":true})"}) {
    StaticJsonDocument<512> doc; CalibrationEdit parsed; assert(!deserializeJson(doc, body));
    assert(parseCalibrationEdit(doc.as<JsonVariantConst>(), parsed));
  }
  for (const char* body : {R"({"kind":"soil","revision":true,"reset":false,"dry":3000,"wet":1500})",
    R"({"kind":"soil","revision":0,"reset":false,"dry":true,"wet":1500})",
    R"({"kind":"soil","revision":0,"reset":true,"dry":3000})",
    R"({"kind":"soil\u0000water","revision":0,"reset":true})",
    R"({"kind":"tank","revision":0,"reset":false,"full_mm":30,"empty_mm":300})",
    R"({"kind":"soil","revision":0,"reset":false,"dry":3000.5,"wet":1500})"}) {
    StaticJsonDocument<512> doc; CalibrationEdit parsed; assert(!deserializeJson(doc, body));
    assert(!parseCalibrationEdit(doc.as<JsonVariantConst>(), parsed));
  }
  std::cout << "PASS: calibration persistence, conflicts, guards, capture, strict JSON\n";
}
