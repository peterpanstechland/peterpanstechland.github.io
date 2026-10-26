#include <Arduino.h>
#include <ArduinoJson.h>
#include <Adafruit_NeoPixel.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <driver/uart.h>
#include <cmath>
#include <cstring>
#include <string>
#include <vector>

#include "controller.h"
#include "printer_receipt.h"
#include "ble_session.h"
#include "robo_config.h"
#include "remote_soil.h"
#include "diagnostic_read_session.h"
#if ROBO_WS2813_RMT
#include "ws2813_rmt.h"
#endif

namespace {
constexpr char ServiceUuid[] = "a2f39c10-7e4b-4d21-8a61-0f3bc9d15001";
constexpr char CharacteristicUuid[] = "a2f39c11-7e4b-4d21-8a61-0f3bc9d15001";
constexpr size_t MaxBleBytes = 240;
constexpr size_t MaxHttpBytes = 512;
constexpr char DefaultToken[] = "change-me-before-use";

bool credentialsConfigured() {
  const std::string token(ROBO_DEVICE_TOKEN);
  if (token == DefaultToken || token.size() < 16 || token.size() > 64) return false;
  for (unsigned char c : token) if (c <= 32 || c > 126 || c == '|') return false;
  return true;
}

const bool ActionsReady = ROBO_ENABLE_ACTIONS && credentialsConfigured();

robo::Config controlConfig() {
  robo::Config c;
  c.actionsEnabled = ROBO_ENABLE_ACTIONS;
  c.credentialsConfigured = credentialsConfigured();
  c.pumpEnabled = ROBO_ENABLE_PUMP && ActionsReady;
  c.lightEnabled = ROBO_ENABLE_LIGHT && ActionsReady;
  c.printerEnabled = ROBO_ENABLE_PRINTER && ActionsReady;
  c.maxWaterMs = ROBO_MAX_WATER_MS;
  return c;
}

robo::Controller controller(controlConfig());
SemaphoreHandle_t coreMutex;
SemaphoreHandle_t sensorMutex;
SemaphoreHandle_t lightMutex;
SemaphoreHandle_t bleMutex;
QueueHandle_t printQueue;
QueueHandle_t bleQueue;
WebServer http(80);
HardwareSerial printerSerial(1);
#if ROBO_WS2813_RMT
Ws2813Rmt<ROBO_LED_COUNT> pixels;
#else
Adafruit_NeoPixel pixels(ROBO_LED_COUNT, pins::Rgb, NEO_GRB + NEO_KHZ800);
#endif
robo::RemoteSoil remoteSoil;
robo::DiagnosticReadSession diagnosticRead;
robo::LightAnimation lightAnimation;
BLECharacteristic* bleCharacteristic;
BLE2902* bleNotifications;
esp_gatt_if_t bleGattsIf = ESP_GATT_IF_NONE;
robo::BleSession bleSession;
robo::BlePreparedWrite<MaxBleBytes> blePreparedWrite;
String deviceId;

struct Sample {
  int soil = -1;
  int air = -1;
  int uv = -1;
  bool soilValid = false;
  bool airValid = false;
  bool uvValid = false;
  bool environmentValid = false;
  float temperature = NAN;
  float humidity = NAN;
  uint32_t timestamp = 0;
};
Sample sample;
struct PrintJob { char id[33]; char text[robo::MaxPrintBytes + 1]; };
struct BleJob { robo::BleTicket ticket; char text[MaxBleBytes + 1]; };

class Lock {
 public:
  explicit Lock(SemaphoreHandle_t handle) : handle_(handle) {
    xSemaphoreTake(handle_, portMAX_DELAY);
  }
  ~Lock() { xSemaphoreGive(handle_); }
 private:
  SemaphoreHandle_t handle_;
};

bool tokenMatches(const std::string& supplied) {
  const std::string expected(ROBO_DEVICE_TOKEN);
  if (supplied.size() != expected.size()) return false;
  unsigned char difference = 0;
  for (size_t i = 0; i < expected.size(); ++i)
    difference |= static_cast<unsigned char>(supplied[i] ^ expected[i]);
  return difference == 0;
}

void writePump() {
  // Only the independent task and command path call this, under coreMutex.
  if (ROBO_ENABLE_PUMP) digitalWrite(pins::Pump, controller.pumpOn() ? HIGH : LOW);
}

void pumpTask(void*) {
  TickType_t wake = xTaskGetTickCount();
  for (;;) {
    {
      Lock guard(coreMutex);
      controller.tick(millis());
      writePump();
    }
    vTaskDelayUntil(&wake, pdMS_TO_TICKS(10));
  }
}

uint8_t crc8(const uint8_t* bytes) {
  uint8_t crc = 0xff;
  for (int i = 0; i < 2; ++i) {
    crc ^= bytes[i];
    for (int bit = 0; bit < 8; ++bit)
      crc = (crc & 0x80) ? static_cast<uint8_t>((crc << 1) ^ 0x31) : crc << 1;
  }
  return crc;
}

bool readSht31(float& temperature, float& humidity) {
  Wire.beginTransmission(ROBO_SHT31_ADDRESS);
  Wire.write(0x24);
  Wire.write(0x00);  // High repeatability single shot, clock stretching disabled.
  if (Wire.endTransmission() != 0) return false;
  vTaskDelay(pdMS_TO_TICKS(20));
  if (Wire.requestFrom(static_cast<uint8_t>(ROBO_SHT31_ADDRESS), static_cast<uint8_t>(6)) != 6)
    return false;
  uint8_t bytes[6];
  for (uint8_t& byte : bytes) byte = Wire.read();
  if (crc8(bytes) != bytes[2] || crc8(bytes + 3) != bytes[5]) return false;
  temperature = -45.0f + 175.0f * ((bytes[0] << 8) | bytes[1]) / 65535.0f;
  humidity = 100.0f * ((bytes[3] << 8) | bytes[4]) / 65535.0f;
  return std::isfinite(temperature) && std::isfinite(humidity) &&
         temperature >= -45 && temperature <= 130 && humidity >= 0 && humidity <= 100;
}

int readAnalog(int pin) {
  uint32_t total = 0;
  for (int i = 0; i < 8; ++i) total += analogRead(pin);
  return total / 8;
}

void sensorTask(void*) {
  TickType_t wake = xTaskGetTickCount();
  for (;;) {
    Sample next;
    if (ROBO_ENABLE_SOIL) {
      next.soil = readAnalog(pins::Soil);
      next.soilValid = next.soil >= 0 && next.soil <= 4095;
    }
    if (ROBO_ENABLE_AIR) {
      next.air = readAnalog(pins::Air);
      next.airValid = next.air >= 0 && next.air <= 4095;
    }
    if (ROBO_ENABLE_UV) {
      next.uv = readAnalog(pins::Uv);
      next.uvValid = next.uv >= 0 && next.uv <= 4095;
    }
    if (ROBO_ENABLE_SHT31)
      next.environmentValid = readSht31(next.temperature, next.humidity);
    next.timestamp = millis();
    {
      Lock guard(sensorMutex);
      sample = next;
    }
    vTaskDelayUntil(&wake, pdMS_TO_TICKS(1000));
  }
}

Sample copySample() {
  Lock guard(sensorMutex);
  Sample current = sample;
  if (ROBO_ENABLE_REMOTE_SOIL) {
    current.soil = remoteSoil.raw();
    current.soilValid = remoteSoil.valid(millis());
  }
  if (static_cast<uint32_t>(millis() - current.timestamp) > 3000) {
    current.soilValid = current.airValid = current.uvValid = false;
    current.environmentValid = false;
  }
  return current;
}

void applyLight(bool force = false) {
  if (!ROBO_ENABLE_LIGHT) return;
  Lock outputGuard(lightMutex);
  bool on;
  robo::LightEffect effect = robo::LightEffect::Solid;
  {
    Lock coreGuard(coreMutex);
    on = controller.lightOn();
    robo::parseLightEffect(controller.lightEffect(), effect);
  }
  const uint32_t now = millis();
  const bool changed = lightAnimation.configure(on, effect, now);
  if (!force && !changed && (!on || effect == robo::LightEffect::Solid)) return;
  // Pixel transmission is outside coreMutex, so it cannot hold the pump deadline
  // behind a strip update. lightMutex also serializes immediate OFF with frames.
  for (size_t i = 0; i < ROBO_LED_COUNT; ++i) {
    const robo::LightRgb color = lightAnimation.pixel(now, i, ROBO_LED_COUNT);
    pixels.setPixelColor(i, color.red, color.green, color.blue);
  }
  pixels.show();
}

void lightTask(void*) {
  TickType_t wake = xTaskGetTickCount();
  for (;;) {
    applyLight();
    vTaskDelayUntil(&wake, pdMS_TO_TICKS(40));
  }
}

void printerTask(void*) {
  PrintJob job;
  for (;;) {
    if (xQueueReceive(printQueue, &job, portMAX_DELAY) != pdTRUE) continue;
    const uint32_t started = millis();
    // Transmission is bounded and occurs in this low priority task. It never
    // holds the controller mutex or delays the independent pump deadline task.
    const auto writeByte = [&](uint8_t byte) {
      if (millis() - started >= 5000) return false;
      while (printerSerial.availableForWrite() < 1) {
        if (millis() - started >= 5000) return false;
        vTaskDelay(pdMS_TO_TICKS(1));
      }
      return printerSerial.write(byte) == 1;
    };
    bool success = ROBO_ENABLE_PRINTER && robo::writeReceipt(job.text, writeByte);
    if (success)
      success = uart_wait_tx_done(UART_NUM_1, pdMS_TO_TICKS(5000)) == ESP_OK;
    {
      Lock guard(coreMutex);
      controller.finishPrint(job.id, success);
    }
  }
}

robo::Result processCommand(const robo::Command& command) {
  robo::Result result;
  {
    Lock guard(coreMutex);
    result = controller.submit(command, millis());
    writePump();
  }
  if (result.ok && !result.duplicate && command.action == "light") applyLight(true);
  if (result.ok && !result.duplicate && command.action == "print") {
    PrintJob job{};
    memcpy(job.id, command.requestId.data(), command.requestId.size());
    memcpy(job.text, command.text.data(), command.text.size());
    if (xQueueSend(printQueue, &job, 0) != pdTRUE) {
      Lock guard(coreMutex);
      controller.finishPrint(command.requestId, false);
      controller.lookup(command.requestId, result);
    }
  }
  return result;
}

void resultJson(JsonDocument& document, const robo::Result& result) {
  document["ok"] = result.ok;
  document["request_id"] = result.requestId;
  document["status"] = result.status;
  document["error"] = result.error;
}

void stateJson(JsonDocument& document) {
  const Sample current = copySample();
  const uint32_t now = millis();
  document["schema_version"] = 1;
  document["device_id"] = deviceId;
  document["uptime_ms"] = now;
  document["sample_age_ms"] = static_cast<uint32_t>(now - current.timestamp);
  JsonObject soil = document.createNestedObject("soil");
  if (current.soil >= 0) soil["raw"] = current.soil; else soil["raw"] = nullptr;
  const bool calibrated = robo::calibrated(ROBO_SOIL_DRY_RAW, ROBO_SOIL_WET_RAW);
  soil["valid"] = current.soilValid;
  soil["calibrated"] = calibrated;
  if(ROBO_ENABLE_REMOTE_SOIL) {
    soil["source"]="indicator_rp2040_grove_adc";
    Lock guard(sensorMutex);
    if(remoteSoil.raw()>=0)soil["sample_age_ms"]=remoteSoil.age(now);
    else soil["sample_age_ms"]=nullptr;
  }
  if (current.soilValid && calibrated)
    soil["percent"] = robo::soilPercent(current.soil, ROBO_SOIL_DRY_RAW, ROBO_SOIL_WET_RAW);
  else soil["percent"] = nullptr;
  JsonObject air = document.createNestedObject("air");
  if (current.air >= 0) air["raw"] = current.air; else air["raw"] = nullptr;
  air["valid"] = current.airValid;
  JsonObject uv = document.createNestedObject("uv");
  if (current.uv >= 0) uv["raw"] = current.uv; else uv["raw"] = nullptr;
  uv["valid"] = current.uvValid;
  JsonObject environment = document.createNestedObject("environment");
  environment["valid"] = current.environmentValid;
  if (current.environmentValid) {
    environment["temperature_c"] = current.temperature;
    environment["humidity_pct"] = current.humidity;
  } else {
    environment["temperature_c"] = nullptr;
    environment["humidity_pct"] = nullptr;
  }
  Lock guard(coreMutex);
  JsonObject pump = document.createNestedObject("pump");
  pump["enabled"] = ROBO_ENABLE_PUMP && ActionsReady;
  pump["on"] = controller.pumpOn();
  pump["remaining_ms"] = controller.remainingMs(millis());
  JsonObject light = document.createNestedObject("light");
  light["enabled"] = ROBO_ENABLE_LIGHT && ActionsReady;
  light["on"] = controller.lightOn();
  light["effect"] = controller.lightEffect();
  JsonObject printer = document.createNestedObject("printer");
  printer["enabled"] = ROBO_ENABLE_PRINTER && ActionsReady;
  printer["status"] = std::string(controller.printerStatus());
  JsonObject last = document.createNestedObject("last_command");
  const robo::Result& result = controller.last();
  last["request_id"] = result.requestId;
  last["status"] = result.status;
  last["error"] = result.error;
}

void sendJson(int code, JsonDocument& document) {
  String body;
  serializeJson(document, body);
  http.sendHeader("Cache-Control", "no-store");
  http.send(code, "application/json", body);
}

void sendError(int status, const char* error, const char* requestId = "") {
  StaticJsonDocument<256> document;
  robo::Result result;
  result.requestId = requestId;
  result.error = error;
  resultJson(document, result);
  sendJson(status, document);
}

bool httpAuthorized() {
  if (!tokenMatches(http.header("X-Device-Token").c_str())) {
    sendError(401, "unauthorized");
    return false;
  }
  return true;
}

bool jsonString(JsonVariantConst value, std::string& destination) {
  if (!value.is<const char*>()) return false;
  JsonString text = value.as<JsonString>();
  destination.assign(text.c_str(), text.size());
  return destination.find('\0') == std::string::npos;
}

void httpSoil() {
  if (!httpAuthorized()) return;
  if (!ROBO_ENABLE_REMOTE_SOIL) { sendError(409, "remote_soil_disabled"); return; }
  if (http.header("Content-Type").indexOf("application/json") != 0) {
    sendError(415, "content_type_required"); return;
  }
  const String body = http.arg("plain");
  if (!body.length() || body.length() > MaxHttpBytes) {sendError(413,"body_size_invalid");return;}
  StaticJsonDocument<512> input;
  if (deserializeJson(input, body) || !input.is<JsonObject>() || input.size()!=5 ||
      !input["source_boot"].is<const char*>() ||
      input["seq"].is<bool>() || !input["seq"].is<uint32_t>() ||
      input["raw"].is<bool>() || !input["raw"].is<int>() ||
      input["age_ms"].is<bool>() || !input["age_ms"].is<uint32_t>() ||
      !input["v"].is<int>() || input["v"].as<int>()!=1) {
    sendError(400,"invalid_soil_sample");return;
  }
  bool accepted;
  {Lock guard(sensorMutex); accepted=remoteSoil.accept(input["source_boot"],input["seq"],input["raw"],input["age_ms"],millis());}
  StaticJsonDocument<128> output; output["accepted"]=accepted;
  sendJson(accepted?200:409,output);
}

void httpDiagnosticSession() {
  if(!httpAuthorized())return;
  if(!ROBO_ENABLE_DIAGNOSTIC_READ){sendError(409,"diagnostic_read_disabled");return;}
  if(http.header("Content-Type").indexOf("application/json")!=0){sendError(415,"content_type_required");return;}
  const String body=http.arg("plain");
  if(!body.length() || body.length()>MaxHttpBytes){sendError(413,"body_size_invalid");return;}
  StaticJsonDocument<256> input;
  if(deserializeJson(input,body) || !input.is<JsonObject>()){sendError(400,"invalid_json");return;}
  if(input.size()==1 && input["disable"].is<bool>() && input["disable"].as<bool>()) {
    {Lock guard(bleMutex);diagnosticRead.clear();}
    StaticJsonDocument<128> out;out["disabled"]=true;sendJson(200,out);return;
  }
  if(input.size()!=2 || !input["token"].is<const char*>() || input["ttl_ms"].is<bool>() || !input["ttl_ms"].is<uint32_t>()) {
    sendError(400,"invalid_diagnostic_session");return;
  }
  std::string readToken;
  if(!jsonString(input["token"],readToken)){sendError(400,"invalid_diagnostic_session");return;}
  bool ok;
  {Lock guard(bleMutex);ok=diagnosticRead.start(readToken.c_str(),input["ttl_ms"],millis());}
  StaticJsonDocument<128> out;out["created"]=ok;out["scope"]="one_soil_read";
  sendJson(ok?200:400,out);
}

void httpCommand() {
  if (!httpAuthorized()) return;
  if (http.header("Content-Type").indexOf("application/json") != 0) {
    sendError(415, "content_type_required"); return;
  }
  const String body = http.arg("plain");
  if (body.length() == 0 || body.length() > MaxHttpBytes) {
    sendError(413, "body_size_invalid"); return;
  }
  StaticJsonDocument<1024> input;
  if (deserializeJson(input, body) || !input.is<JsonObject>()) {
    sendError(400, "invalid_json"); return;
  }
  JsonObjectConst object = input.as<JsonObjectConst>();
  for (JsonPairConst pair : object) {
    const char* key = pair.key().c_str();
    if (strcmp(key, "request_id") && strcmp(key, "action") &&
        strcmp(key, "duration_ms") && strcmp(key, "on") && strcmp(key, "text") &&
        strcmp(key, "effect")) {
      sendError(400, "unexpected_fields"); return;
    }
  }
  robo::Command command;
  if (!jsonString(object["request_id"], command.requestId) ||
      !jsonString(object["action"], command.action)) {
    sendError(400, "invalid_command_fields"); return;
  }
  if (!robo::validId(command.requestId)) {
    sendError(400, "invalid_request_id"); return;
  }
  command.hasDuration = object.containsKey("duration_ms");
  command.hasOn = object.containsKey("on");
  command.hasText = object.containsKey("text");
  command.hasEffect = object.containsKey("effect");
  if (command.hasDuration) {
    if (object["duration_ms"].is<bool>() || !object["duration_ms"].is<int64_t>()) {
      sendError(400, "invalid_duration"); return;
    }
    command.durationMs = object["duration_ms"].as<int64_t>();
  }
  if (command.hasOn) {
    if (!object["on"].is<bool>()) { sendError(400, "invalid_light_fields"); return; }
    command.on = object["on"].as<bool>();
  }
  if (command.hasText && !jsonString(object["text"], command.text)) {
    sendError(400, "invalid_print_text"); return;
  }
  if (command.hasEffect && !jsonString(object["effect"], command.effect)) {
    sendError(400, "invalid_light_fields"); return;
  }
  const robo::Result result = processCommand(command);
  StaticJsonDocument<384> output;
  resultJson(output, result);
  sendJson(result.ok ? (result.status == "accepted" ? 202 : 200) : 409, output);
}

void httpResult() {
  if (!httpAuthorized()) return;
  const std::string requestId = http.arg("request_id").c_str();
  if (!robo::validId(requestId)) {
    sendError(400, "invalid_request_id"); return;
  }
  robo::Result result;
  bool found;
  {
    Lock guard(coreMutex);
    found = controller.lookup(requestId, result);
  }
  if (!found) {
    sendError(404, "request_not_found", requestId.c_str()); return;
  }
  StaticJsonDocument<384> output;
  resultJson(output, result);
  sendJson(200, output);
}

std::vector<std::string> split(const std::string& line) {
  std::vector<std::string> fields;
  size_t begin = 0;
  do {
    const size_t end = line.find('|', begin);
    if (end == std::string::npos) { fields.push_back(line.substr(begin)); break; }
    fields.push_back(line.substr(begin, end - begin));
    begin = end + 1;
  } while (fields.size() < 8);
  return fields;
}

const char* shortError(const std::string& error) {
  if (error == "actions_disabled") return "LOCK";
  if (error == "pump_disabled" || error == "light_disabled" || error == "printer_disabled") return "OFF";
  if (error == "pump_busy" || error == "printer_busy") return "BUSY";
  if (error == "request_id_conflict") return "ID";
  if (error == "idempotency_cache_full") return "FULL";
  if (error == "invalid_duration") return "TIME";
  if (error == "printer_write_failed") return "IO";
  if (error == "unknown_action") return "ACT";
  return "ARG";
}

std::string bleResult(const robo::Result& result) {
  if (!result.ok) return "E:" + result.requestId + ":" + shortError(result.error);
  return (result.status == "accepted" ? "A:" : "D:") + result.requestId;
}

std::string bleQuery(const std::string& field) {
  const Sample current = copySample();
  char buffer[32];
  if ((field == "soil" || field == "air" || field == "uv" || field == "env") &&
      static_cast<uint32_t>(millis() - current.timestamp) > 3000) return "E:STALE";
  if (field == "soil") {
    const bool calibrated = robo::calibrated(ROBO_SOIL_DRY_RAW, ROBO_SOIL_WET_RAW);
    const std::string raw = current.soil >= 0 ? std::to_string(current.soil) : "x";
    const std::string percent = current.soilValid && calibrated ?
      std::to_string(static_cast<int>(lround(robo::soilPercent(current.soil, ROBO_SOIL_DRY_RAW, ROBO_SOIL_WET_RAW)))) : "x";
    return "S:" + raw + ":" + percent + ":" + (current.soilValid ? "1" : "0") + ":" + (calibrated ? "1" : "0");
  }
  if (field == "air" || field == "uv") {
    const int raw = field == "air" ? current.air : current.uv;
    const bool valid = field == "air" ? current.airValid : current.uvValid;
    return std::string(field == "air" ? "A:" : "U:") + (raw >= 0 ? std::to_string(raw) : "x") + ":" + (valid ? "1" : "0");
  }
  if (field == "env") {
    if (!current.environmentValid) return "E:x:x:0";
    snprintf(buffer, sizeof(buffer), "E:%.1f:%.1f:1", current.temperature, current.humidity);
    return buffer;
  }
  Lock guard(coreMutex);
  if (field == "pump") {
    snprintf(buffer, sizeof(buffer), "P:%d:%d:%lu", ROBO_ENABLE_PUMP && ActionsReady ? 1 : 0,
             controller.pumpOn() ? 1 : 0, static_cast<unsigned long>(controller.remainingMs(millis())));
    return buffer;
  }
  if (field == "light") {
    snprintf(buffer, sizeof(buffer), "L:%d:%d", ROBO_ENABLE_LIGHT && ActionsReady ? 1 : 0, controller.lightOn() ? 1 : 0);
    return buffer;
  }
  if (field == "printer") {
    const std::string status = controller.printerStatus();
    const char* label = status == "disabled" ? "off" : status == "bytes_sent" ? "sent" :
                        status == "write_failed" ? "fail" : status.c_str();
    snprintf(buffer, sizeof(buffer), "T:%d:%s", ROBO_ENABLE_PRINTER && ActionsReady ? 1 : 0, label);
    return buffer;
  }
  return "E:FIELD";
}

std::string handleBle(const std::string& text) {
  const auto fields = split(text);
  if(fields.size()==2 && fields[0]=="Q") {
    if(!ROBO_ENABLE_DIAGNOSTIC_READ || !diagnosticRead.take(fields[1].c_str(),millis()))return "E:AUTH";
    return bleQuery("soil");
  }
  if (fields.size() < 2 || !tokenMatches(fields[1])) return "E:AUTH";
  if (fields[0] == "S") {
    if (fields.size() == 2) return "Q:soil,pump,air,uv";
    return fields.size() == 3 ? bleQuery(fields[2]) : "E:FORMAT";
  }
  if (fields[0] == "R") {
    if (fields.size() != 3 || fields[2].size() > 8 || !robo::validId(fields[2])) return "E:FORMAT";
    robo::Result result;
    Lock guard(coreMutex);
    return controller.lookup(fields[2], result) ? bleResult(result) : "E:" + fields[2] + ":MISS";
  }
  if (fields[0] != "C" || fields.size() < 4 || fields[2].size() > 8 || !robo::validId(fields[2]))
    return "E:FORMAT";
  robo::Command command;
  command.requestId = fields[2];
  command.action = fields[3];
  if (command.action == "water" && fields.size() == 5) {
    uint32_t duration;
    if (!robo::parseUnsigned(fields[4], duration)) return "E:" + command.requestId + ":TIME";
    command.hasDuration = true;
    command.durationMs = duration;
  } else if (command.action == "light" && (fields.size() == 5 || fields.size() == 6) &&
             (fields[4] == "0" || fields[4] == "1")) {
    command.hasOn = true;
    command.on = fields[4] == "1";
    command.hasEffect = fields.size() == 6;
    if (command.hasEffect) command.effect = fields[5];
  } else if (command.action == "print" && fields.size() == 5) {
    command.hasText = true;
    command.text = fields[4];
  } else if (command.action != "stop_water" || fields.size() != 4) {
    return "E:" + command.requestId + ":ARG";
  }
  return bleResult(processCommand(command));
}

// All BLE helpers below run under bleMutex. Send only to the original conn_id:
// Arduino's notify() broadcasts to every peer, including one being rejected.
void bleReply(const robo::BleTicket& ticket, const std::string& response) {
  if (!bleSession.mayReply(ticket) || bleGattsIf == ESP_GATT_IF_NONE) return;
  // No multipart notifications. Every response fits the default ATT MTU 23.
  const std::string value = response.size() <= 20 ? response : "E:SIZE";
  esp_ble_gatts_send_indicate(bleGattsIf, ticket.connectionId, bleCharacteristic->getHandle(),
      value.size(), reinterpret_cast<uint8_t*>(const_cast<char*>(value.data())), false);
}

void queueBle(const robo::BleTicket& ticket, const uint8_t* data, size_t size) {
  if (!bleSession.matches(ticket)) return;
  if (!data || size == 0 || size > MaxBleBytes || std::memchr(data, '\0', size)) {
    bleReply(ticket, "E:SIZE"); return;
  }
  BleJob job{};
  job.ticket = ticket;
  memcpy(job.text, data, size);
  if (xQueueSend(bleQueue, &job, 0) != pdTRUE) bleReply(ticket, "E:BUSY");
}

// Public Arduino BLE hook, called after the library handles each GATTS event.
// Read the actual peer/bytes from the event instead of the shared getValue().
void bleGattEvent(esp_gatts_cb_event_t event, esp_gatt_if_t gattsIf, esp_ble_gatts_cb_param_t* param) {
  Lock guard(bleMutex);
  if (event == ESP_GATTS_REG_EVT && param->reg.status == ESP_GATT_OK) {
    bleGattsIf = gattsIf;
    return;
  }
  if (!bleCharacteristic) return;
  if (event == ESP_GATTS_WRITE_EVT) {
    const auto& write = param->write;
    const robo::BleTicket ticket = bleSession.ticketFor(write.conn_id);
    if (!ticket.valid()) return;
    if (write.handle == bleNotifications->getHandle() && !write.is_prep && write.offset == 0 && write.len == 2) {
      bleSession.setNotifications(write.conn_id, (write.value[0] & 1) != 0);
    } else if (write.handle == bleCharacteristic->getHandle()) {
      if (write.is_prep) {
        if (!blePreparedWrite.append(ticket, write.offset, write.value, write.len))
          bleReply(ticket, "E:FORMAT");
      } else {
        blePreparedWrite.reset();
        if (write.offset != 0) bleReply(ticket, "E:FORMAT");
        else queueBle(ticket, write.value, write.len);
      }
    }
  } else if (event == ESP_GATTS_EXEC_WRITE_EVT) {
    const robo::BleTicket ticket = bleSession.ticketFor(param->exec_write.conn_id);
    if (!ticket.valid()) return;
    if (param->exec_write.exec_write_flag == ESP_GATT_PREP_WRITE_CANCEL) {
      blePreparedWrite.reset();
    } else if (param->exec_write.exec_write_flag == ESP_GATT_PREP_WRITE_EXEC) {
      char text[MaxBleBytes + 1]{};
      if (blePreparedWrite.finish(ticket, text))
        queueBle(ticket, reinterpret_cast<const uint8_t*>(text), strlen(text));
      else bleReply(ticket, "E:FORMAT");
    }
  }
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server, esp_ble_gatts_cb_param_t* param) override {
    bool accepted;
    {
      Lock guard(bleMutex);
      accepted = bleSession.connect(param->connect.conn_id);
      if (accepted) {
        xQueueReset(bleQueue);
        blePreparedWrite.reset();
      }
    }
    if (accepted) BLEDevice::stopAdvertising();
    else server->disconnect(param->connect.conn_id);
  }
  void onDisconnect(BLEServer*, esp_ble_gatts_cb_param_t* param) override {
    bool ownerLeft;
    {
      Lock guard(bleMutex);
      ownerLeft = bleSession.disconnect(param->disconnect.conn_id);
      if (ownerLeft) {
        blePreparedWrite.reset();
        bleCharacteristic->setValue("RoboPlanter/1");
        xQueueReset(bleQueue);
      }
    }
    if (ownerLeft) BLEDevice::startAdvertising();
  }
};

void bleTask(void*) {
  BleJob job;
  for (;;) {
    if (xQueueReceive(bleQueue, &job, portMAX_DELAY) == pdTRUE) {
      Lock guard(bleMutex);
      if (!bleSession.matches(job.ticket)) continue;
      // Serialize the short command commit with disconnect. Already accepted
      // pump/print work retains its local deadline/result; it is not replayed.
      const std::string response = handleBle(job.text);
      bleReply(job.ticket, response);
    }
  }
}

void failClosed(const char* reason) {
  // D8 belongs to UART while printing is enabled; do not force a UART break.
  if (!ROBO_ENABLE_PRINTER) digitalWrite(pins::Pump, LOW);
  Serial.println(reason);
  for (;;) delay(1000);
}
}  // namespace

void setup() {
  // Disable both documented revisions' motor/heater nets. This firmware never
  // runs the robot drive controller. External pump driver MUST have a pulldown
  // so it remains off during reset, before these GPIOs become outputs.
  const int safePins[] = {2, 3, 39, 11, 12};
  for (int pin : safePins) { digitalWrite(pin, LOW); pinMode(pin, OUTPUT); }
  // UART idles HIGH. Avoid the former pump initialization pulling printer TX
  // LOW before UART1 starts. The config rejects simultaneous pump/printer use.
  digitalWrite(pins::Pump, ROBO_ENABLE_PRINTER ? HIGH : LOW);
  pinMode(pins::Pump, OUTPUT);
  Serial.begin(115200);
  coreMutex = xSemaphoreCreateMutex();
  sensorMutex = xSemaphoreCreateMutex();
  lightMutex = xSemaphoreCreateMutex();
  bleMutex = xSemaphoreCreateMutex();
  printQueue = xQueueCreate(1, sizeof(PrintJob));
  bleQueue = xQueueCreate(4, sizeof(BleJob));
  if (!coreMutex || !sensorMutex || !lightMutex || !bleMutex || !printQueue || !bleQueue)
    failClosed("Startup failed: task resources unavailable");
  if (xTaskCreate(pumpTask, "pump-deadline", 3072, nullptr, 10, nullptr) != pdPASS)
    failClosed("Startup failed: pump deadline task unavailable");

  analogReadResolution(12);
  if (ROBO_ENABLE_SOIL) { pinMode(pins::Soil, INPUT); analogSetPinAttenuation(pins::Soil, ADC_11db); }
  if (ROBO_ENABLE_AIR) { pinMode(pins::Air, INPUT); analogSetPinAttenuation(pins::Air, ADC_11db); }
  if (ROBO_ENABLE_UV) { pinMode(pins::Uv, INPUT); analogSetPinAttenuation(pins::Uv, ADC_11db); }
  if (ROBO_ENABLE_SHT31) {
    Wire.begin(pins::Sda, pins::Scl);
    Wire.setTimeOut(30);
  }
  if (ROBO_ENABLE_LIGHT) {
#if ROBO_WS2813_RMT
    if (!pixels.begin()) failClosed("Startup failed: WS2813 RMT unavailable");
#else
    pixels.begin();
#endif
    pixels.setBrightness(ROBO_LED_BRIGHTNESS);
    pixels.clear();
    pixels.show();
  }
  if (ROBO_ENABLE_PRINTER) {
    printerSerial.begin(ROBO_PRINTER_BAUD, SERIAL_8N1, pins::PrinterRx, pins::PrinterTx);
    if (!printerSerial) failClosed("Startup failed: printer UART unavailable");
  }
  if (xTaskCreate(sensorTask, "sensors", 4096, nullptr, 1, nullptr) != pdPASS ||
      xTaskCreate(printerTask, "printer", 4096, nullptr, 1, nullptr) != pdPASS ||
      (ROBO_ENABLE_LIGHT && xTaskCreate(lightTask, "light-frames", 3072, nullptr, 1, nullptr) != pdPASS) ||
      xTaskCreate(bleTask, "ble-commands", 6144, nullptr, 2, nullptr) != pdPASS)
    failClosed("Startup failed: worker task unavailable");

  char suffix[5];
  snprintf(suffix, sizeof(suffix), "%04X", static_cast<unsigned>(ESP.getEfuseMac() & 0xffff));
  deviceId = String("RoboPlanter-") + suffix;
  if (ROBO_WIFI_STA) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(ROBO_STA_SSID,ROBO_STA_PASSWORD);
  } else {
    WiFi.mode(WIFI_AP);
    if (!WiFi.softAP(deviceId.c_str(), ROBO_AP_PASSWORD, 1, false, 2))
      failClosed("Startup failed: Wi-Fi AP unavailable");
  }
  const char* headers[] = {"X-Device-Token", "Content-Type"};
  http.collectHeaders(headers, 2);
  http.on("/api/v1/state", HTTP_GET, []() {
    if (!httpAuthorized()) return;
    StaticJsonDocument<2048> output;
    stateJson(output);
    sendJson(200, output);
  });
  http.on("/api/v1/command", HTTP_POST, httpCommand);
  http.on("/api/v1/sensors/soil", HTTP_POST, httpSoil);
  http.on("/api/v1/diagnostic-session", HTTP_POST, httpDiagnosticSession);
  http.on("/api/v1/result", HTTP_GET, httpResult);
  http.onNotFound([]() { sendError(404, "not_found"); });
  http.begin();

  BLEDevice::init(deviceId.c_str());
  BLEDevice::setMTU(247);
  BLEDevice::setCustomGattsHandler(bleGattEvent);
  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService* service = server->createService(ServiceUuid);
  bleCharacteristic = service->createCharacteristic(CharacteristicUuid,
      BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY);
  // Declaration properties alone are not ATT permissions. Never expose the
  // library's last written value, which contains the caller's device token.
  bleCharacteristic->setAccessPermissions(ESP_GATT_PERM_WRITE);
  bleNotifications = new BLE2902();
  bleCharacteristic->addDescriptor(bleNotifications);
  bleCharacteristic->setValue("RoboPlanter/1");
  service->start();
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(ServiceUuid);
  advertising->setScanResponse(true);
  advertising->start();
  Serial.printf("%s ready; network=%s; actions %s\n", deviceId.c_str(),ROBO_WIFI_STA?"station":"access-point",
                ROBO_ENABLE_ACTIONS && credentialsConfigured() ? "configured" : "disabled");
}

void loop() {
  static uint32_t lastNetworkLog=0;
  if (millis()-lastNetworkLog>=5000) {
    lastNetworkLog=millis();
    Serial.printf("RoboPlanter network connected=%d ip=%s\n",WiFi.status()==WL_CONNECTED,
                  (ROBO_WIFI_STA?WiFi.localIP():WiFi.softAPIP()).toString().c_str());
  }
  http.handleClient();
  delay(2);
}
