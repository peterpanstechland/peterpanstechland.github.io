#pragma once
#include <Arduino.h>

namespace planter {
struct Reading { float value = 0; bool valid = false; };
struct State {
  bool received = false, wifi = false;
  uint32_t receivedMs = 0, sampleAgeMs = 0;
  uint32_t networkRevision = 0; // A new Wi-Fi selection invalidates old capability data.
  bool ageKnown = false;
  char deviceId[49] = {}, networkError[80] = {};
  Reading soilRaw, soilPercent, airRaw, uvRaw, temperature, humidity;
  bool soilCalibrationKnown = false, soilCalibrated = false;
  bool pumpKnown = false, pumpEnabled = false, pumpOn = false;
  bool remainingKnown = false;
  uint32_t remainingMs = 0;
  bool lightKnown = false, lightEnabled = false, lightOn = false;
  bool printerKnown = false, printerEnabled = false;
  char printerStatus[25] = {};
  char requestId[33] = {}, commandStatus[25] = {}, commandError[80] = {};
  bool commandBlocked = false, uncertain = false;
  uint32_t commandStartedMs = 0;
};
enum class Action : uint8_t { Water, StopWater, Light, Print };
bool begin();
State snapshot();
bool fresh(const State &state, uint32_t now);
bool submit(Action action, bool lightOn = false);
void acknowledgeUncertain();
}
