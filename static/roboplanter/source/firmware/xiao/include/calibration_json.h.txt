#pragma once
#include <ArduinoJson.h>
#include <cstring>
#include "sensor_calibration.h"
namespace robo {
inline bool parseCalibrationEdit(JsonVariantConst input, CalibrationEdit& edit) {
  if (!input.is<JsonObjectConst>() || !input["kind"].is<const char*>() ||
      input["revision"].is<bool>() || !input["revision"].is<uint32_t>() || !input["reset"].is<bool>()) return false;
  const JsonString kind = input["kind"].as<JsonString>();
  if (kind.size() == 4 && !memcmp(kind.c_str(), "soil", 4)) edit.kind = CalibrationKind::Soil;
  else if (kind.size() == 4 && !memcmp(kind.c_str(), "tank", 4)) edit.kind = CalibrationKind::Tank;
  else return false;
  edit.revision = input["revision"]; edit.reset = input["reset"];
  if (edit.reset) return input.size() == 3;
  const bool soil = edit.kind == CalibrationKind::Soil;
  if (input.size() != (soil ? 5 : 6)) return false;
  const char* keys[] = {soil ? "dry" : "full_mm", soil ? "wet" : "empty_mm", "stop_mm"};
  int* values[] = {&edit.a, &edit.b, &edit.c};
  for (unsigned i = 0; i < (soil ? 2u : 3u); ++i) {
    if (input[keys[i]].is<bool>() || !input[keys[i]].is<int>()) return false;
    *values[i] = input[keys[i]].as<int>();
  }
  return true;
}
}
