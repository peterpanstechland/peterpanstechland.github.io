#pragma once
#include <ArduinoJson.h>
#include "auto_light.h"
namespace robo {
inline bool parseAutoLight(JsonVariantConst input, AutoLightSettings& settings) {
  if(!input.is<JsonObjectConst>() || input.size()!=4 || !input["enabled"].is<bool>() ||
    !input["revision"].is<uint32_t>() || input["revision"].is<bool>() ||
    !input["on_below"].is<int>() || input["on_below"].is<bool>() ||
    !input["off_above"].is<int>() || input["off_above"].is<bool>())return false;
  settings.revision=input["revision"]; settings.enabled=input["enabled"];
  settings.onBelow=input["on_below"]; settings.offAbove=input["off_above"];
  // Bound before subtracting: reject extreme integers without signed overflow.
  return settings.onBelow>=0 && settings.onBelow<=4095 && settings.offAbove>=0 && settings.offAbove<=4095 && settings.valid();
}
}
