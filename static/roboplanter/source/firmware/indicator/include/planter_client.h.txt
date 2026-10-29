#pragma once
#include <Arduino.h>
#include "../../xiao/include/daily_ticket.h"
#include "../../xiao/include/sensor_calibration.h"
#include "../../xiao/include/auto_light.h"

namespace planter {
struct Reading { float value = 0; bool valid = false; };
enum class NetworkFailure : uint8_t { None, Configuration, Http, Authentication, InvalidState };
enum class CalibrationWrite : uint8_t { Idle, Queued, Saving, Saved, Failed, Unknown };
struct PrintReceipt {
  char text[161] = {};
  bool requiresRaster = false;
  bool layout32 = false;
  bool isDaily = false;
  robo::DailyTicket daily;
};
struct State {
  bool received = false, wifi = false;
  uint32_t receivedMs = 0, sampleAgeMs = 0;
  uint32_t networkRevision = 0; // A new Wi-Fi selection invalidates old capability data.
  bool ageKnown = false;
  char deviceId[49] = {}, networkError[80] = {};
  NetworkFailure networkFailure = NetworkFailure::None;
  int16_t httpStatus = 0;
  Reading soilRaw, soilPercent, airRaw, uvRaw, ambientLightRaw, temperature, humidity;
  Reading pm25, vocIndex, tankDistance, tankLevel;
  bool sen54Enabled = false, tankEnabled = false, tankCalibrated = false;
  bool waterAllowed = false;
  bool yoyoEnabled=false, yoyoPaired=false, yoyoConnected=false, yoyoPairing=false;
  uint32_t yoyoPin=0;
  bool autoPrintKnown=false, autoPrint=true;
  bool focusKnown = false;
  uint8_t focusPhase = 0;
  uint32_t focusRevision = 0, focusRemaining = 0, focusDuration = 0, uptimeMs = 0;
  char waterBlockReason[32] = {};
  bool ambientLightEnabled = false;
  bool soilCalibrationKnown = false, soilCalibrated = false;
  bool soilAgeKnown = false;
  uint32_t soilAgeMs = 0;
  bool calibrationKnown = false, calibrationWritable = false;
  robo::SensorCalibration calibration;
  CalibrationWrite calibrationWrite = CalibrationWrite::Idle;
  char calibrationError[48] = {};
  bool pumpKnown = false, pumpEnabled = false, pumpOn = false;
  bool remainingKnown = false;
  uint32_t remainingMs = 0;
  bool lightKnown = false, lightEnabled = false, lightOn = false;
  bool autoLightKnown=false, autoLightAvailable=false, autoLightWritable=false, autoLightPaused=false, autoLightStale=true;
  robo::AutoLightSettings autoLight;
  CalibrationWrite autoLightWrite=CalibrationWrite::Idle;
  char autoLightError[48]={};
  bool printerKnown = false, printerEnabled = false;
  bool printerRaster = false, printerAutocut = false;
  bool printerLayout32 = false;
  bool printerDaily = false;
  char printerStatus[25] = {};
  char requestId[33] = {}, commandStatus[25] = {}, commandError[80] = {};
  bool commandBlocked = false, uncertain = false;
  uint32_t commandStartedMs = 0;
};
enum class Action : uint8_t { Water, StopWater, Light, Print, FocusStart, FocusPause, FocusResume, FocusReset, PairYoyo, AutoPrint };
inline bool isFocus(Action a) {return a>=Action::FocusStart && a<=Action::FocusReset;}
bool begin();
State snapshot();
bool fresh(const State &state, uint32_t now);
bool submit(Action action, bool lightOn = false, const PrintReceipt *receipt = nullptr, uint16_t focusMinutes = 25);
void acknowledgeUncertain();
bool submitCalibration(const robo::CalibrationEdit& edit);
bool submitAutoLight(const robo::AutoLightSettings& settings);
}
