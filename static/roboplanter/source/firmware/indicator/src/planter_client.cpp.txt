#include "planter_client.h"
#include "config.h"
#include "device_settings.h"
#include "local_soil.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <esp_system.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#include <freertos/task.h>
#include <math.h>

namespace {
using namespace planter;
struct Command { Action action; bool on; char id[33]; uint32_t networkRevision; };
State shared;
SemaphoreHandle_t lock = nullptr;
QueueHandle_t commands = nullptr, stops = nullptr;
uint32_t bootNonce = 0, sequence = 0;

template<size_t N> void copy(char (&dst)[N], const char *src) {
  strlcpy(dst, src ? src : "", N);
}
bool terminal(const char *status) {
  return !strcmp(status, "completed") || !strcmp(status, "failed") ||
         !strcmp(status, "rejected") || !strcmp(status, "cancelled") ||
         !strcmp(status, "stopped");
}
void networkError(const char *message) {
  xSemaphoreTake(lock, portMAX_DELAY);
  copy(shared.networkError, message);
  shared.wifi = device_settings::planterNetworkReady();
  xSemaphoreGive(lock);
}
void commandResult(const char *id, const char *status, const char *error,
                   bool blocked, bool uncertain = false) {
  xSemaphoreTake(lock, portMAX_DELAY);
  // STOP can supersede an in-flight request while HTTP is waiting.
  if (!strcmp(shared.requestId, id)) {
    copy(shared.commandStatus, status);
    copy(shared.commandError, error);
    shared.commandBlocked = blocked;
    shared.uncertain = uncertain;
  }
  xSemaphoreGive(lock);
}
bool numeric(JsonVariantConst value) {
  return !value.isNull() && (value.is<float>() || value.is<int>() || value.is<unsigned>()) &&
         isfinite(value.as<float>());
}
Reading reading(JsonVariantConst object, const char *field) {
  Reading out;
  out.valid = object["valid"].is<bool>() && object["valid"].as<bool>() && numeric(object[field]);
  if (out.valid) out.value = object[field].as<float>();
  return out;
}
bool configureHttp(HTTPClient &http, WiFiClient &client, const char *path) {
  // A user-selected office/cafe network may have an unrelated 192.168.4.1.
  // Never disclose the planter token there merely because Wi-Fi is connected.
  if (!device_settings::planterNetworkReady()) return false;
  http.setConnectTimeout(kHttpTimeoutMs);
  http.setTimeout(kHttpTimeoutMs);
  http.setReuse(false);
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  if (!http.begin(client, String(PLANTER_BASE_URL) + path)) return false;
  http.addHeader("X-Device-Token", PLANTER_DEVICE_TOKEN);
  return true;
}

void uploadSoil() {
  if(!PLANTER_ENABLE_LOCAL_SOIL)return;
  const auto sample=local_soil::snapshot();
  if(!sample.valid)return;
  WiFiClient client;HTTPClient http;
  if(!configureHttp(http,client,"/api/v1/sensors/soil"))return;
  http.addHeader("Content-Type","application/json");
  StaticJsonDocument<256> doc;
  doc["v"]=1;doc["source_boot"]=sample.boot;doc["seq"]=sample.sequence;
  doc["raw"]=sample.raw;doc["age_ms"]=static_cast<uint32_t>(millis()-sample.receivedMs);
  String body;serializeJson(doc,body);
  const int code=http.POST(body);http.end();
  static unsigned accepted=0;
  if(code==200 && ++accepted%10==1)Serial.printf("Indicator soil relay: HTTP 200 raw=%d\n",sample.raw);
}

void pollState() {
  const uint32_t requestNetwork = device_settings::networkRevision();
  WiFiClient client;
  HTTPClient http;
  if (!configureHttp(http, client, "/api/v1/state")) {
    networkError("Invalid HTTP configuration"); return;
  }
  const int code = http.GET();
  if (code != 200) {
    char message[80];
    snprintf(message, sizeof(message), "State HTTP %d%s", code,
             code == 401 || code == 403 ? " - check token" : "");
    networkError(message); http.end(); return;
  }
  const int length = http.getSize();
  if (length < 0 || length > 4096) {
    networkError("Unexpected state body length"); http.end(); return;
  }
  const String body = http.getString();
  http.end();
  if (requestNetwork != device_settings::networkRevision()) return;
  StaticJsonDocument<3072> doc;
  const auto error = deserializeJson(doc, body);
  if (error || !doc["schema_version"].is<int>() || doc["schema_version"].as<int>() != 1 ||
      !doc["device_id"].is<const char *>()) {
    networkError("Invalid or unsupported state schema"); return;
  }
  State next;
  next.received = next.wifi = true;
  next.receivedMs = millis();
  next.networkRevision = requestNetwork;
  copy(next.deviceId, doc["device_id"]);
  next.ageKnown = doc["sample_age_ms"].is<uint32_t>();
  if (next.ageKnown) next.sampleAgeMs = doc["sample_age_ms"].as<uint32_t>();
  next.soilRaw = reading(doc["soil"], "raw");
  next.soilCalibrationKnown = doc["soil"]["calibrated"].is<bool>();
  next.soilCalibrated = next.soilCalibrationKnown && doc["soil"]["calibrated"].as<bool>();
  next.soilPercent = reading(doc["soil"], "percent");
  next.soilPercent.valid = next.soilPercent.valid && next.soilCalibrated &&
                           next.soilPercent.value >= 0 && next.soilPercent.value <= 100;
  next.airRaw = reading(doc["air"], "raw");
  next.uvRaw = reading(doc["uv"], "raw");
  next.temperature = reading(doc["environment"], "temperature_c");
  next.humidity = reading(doc["environment"], "humidity_pct");
  next.humidity.valid = next.humidity.valid && next.humidity.value >= 0 && next.humidity.value <= 100;
  const auto pump = doc["pump"];
  next.pumpKnown = pump["enabled"].is<bool>() && pump["on"].is<bool>();
  next.pumpEnabled = next.pumpKnown && pump["enabled"].as<bool>();
  next.pumpOn = next.pumpKnown && pump["on"].as<bool>();
  next.remainingKnown = pump["remaining_ms"].is<uint32_t>();
  if (next.remainingKnown) next.remainingMs = pump["remaining_ms"].as<uint32_t>();
  const auto light = doc["light"];
  next.lightKnown = light["enabled"].is<bool>() && light["on"].is<bool>();
  next.lightEnabled = next.lightKnown && light["enabled"].as<bool>();
  next.lightOn = next.lightKnown && light["on"].as<bool>();
  const auto printer = doc["printer"];
  next.printerKnown = printer["enabled"].is<bool>() && printer["status"].is<const char *>();
  next.printerEnabled = next.printerKnown && printer["enabled"].as<bool>();
  if (next.printerKnown) copy(next.printerStatus, printer["status"]);

  xSemaphoreTake(lock, portMAX_DELAY);
  copy(next.requestId, shared.requestId);
  copy(next.commandStatus, shared.commandStatus);
  copy(next.commandError, shared.commandError);
  next.commandBlocked = shared.commandBlocked;
  next.commandStartedMs = shared.commandStartedMs;
  next.uncertain = shared.uncertain;
  const char *lastId = doc["last_command"]["request_id"] | "";
  const char *lastStatus = doc["last_command"]["status"] | "";
  if (next.requestId[0] && !strcmp(lastId, next.requestId) && lastStatus[0]) {
    copy(next.commandStatus, lastStatus);
    copy(next.commandError, doc["last_command"]["error"] | "");
    next.commandBlocked = !terminal(lastStatus);
    next.uncertain = false;
  }
  // A timeout is not evidence that an actuator did nothing. Keep other actions
  // blocked until its result is observed or a person acknowledges uncertainty.
  if (next.commandBlocked && millis() - next.commandStartedMs > kCommandResolveMs &&
      !terminal(next.commandStatus)) {
    next.uncertain = true;
    copy(next.commandStatus, "unknown");
    copy(next.commandError, "No final result; inspect planter");
  }
  shared = next;
  xSemaphoreGive(lock);
}

void pollCommandResult() {
  const State pending = planter::snapshot();
  // A newly queued touch can arrive while pollState() is waiting. Do not query
  // a command until its POST has finished, or a normal cache miss could be
  // mistaken for a lost result before the command was ever transmitted.
  if (!pending.requestId[0] || !pending.commandBlocked ||
      terminal(pending.commandStatus) || !strcmp(pending.commandStatus, "queued") ||
      !strcmp(pending.commandStatus, "sending")) return;
  if (uxQueueMessagesWaiting(stops) != 0 || WiFi.status() != WL_CONNECTED) return;

  // IDs generated by this client contain only URL-safe letters/digits/hyphens.
  char path[80];
  snprintf(path, sizeof(path), "/api/v1/result?request_id=%s", pending.requestId);
  WiFiClient client;
  HTTPClient http;
  if (!configureHttp(http, client, path)) return;
  const int code = http.GET();
  if (code != 200 && code != 404) {
    http.end();
    // A failed read is not an actuator failure. Keep the accepted/unknown
    // state and let the next poll retry this read-only result lookup.
    return;
  }
  if (http.getSize() < 0 || http.getSize() > 2048) {
    http.end(); return;
  }
  const String response = http.getString();
  http.end();
  StaticJsonDocument<1024> result;
  if (deserializeJson(result, response) || !result["ok"].is<bool>() ||
      strcmp(result["request_id"] | "", pending.requestId)) return;

  if (code == 404) {
    // Cache eviction or a controller restart can erase an already executed
    // request. A missing result must never cause an automatic POST retry.
    if (!strcmp(result["error"] | "", "request_not_found"))
      commandResult(pending.requestId, "unknown",
                    "Result missing; inspect planter / restart?", true, true);
    return;
  }
  const char *status = result["status"] | "";
  if (!status[0]) return;
  const bool complete = terminal(status);
  const bool expired = millis() - pending.commandStartedMs > kCommandResolveMs;
  if (!complete && expired) {
    commandResult(pending.requestId, "unknown", "Still no final result; inspect planter", true, true);
  } else {
    // An execution failure is still a confirmed final result. HTTP 200 means
    // the record was found; its status, not `ok`, determines completion.
    commandResult(pending.requestId, status, result["error"] | "", !complete);
  }
  // commandResult() checks the current ID under the mutex: an old GET cannot
  // overwrite a newer STOP request or a manual uncertainty acknowledgement.
}

void sendCommand(const Command &command) {
  if (WiFi.status() != WL_CONNECTED || !device_settings::planterNetworkReady() ||
      command.networkRevision != device_settings::networkRevision()) {
    commandResult(command.id, "not_sent", "Planter network unavailable or changed; no retry", false); return;
  }
  // Recheck capability and freshness just before transmission.
  const State state = planter::snapshot();
  if (strcmp(state.requestId, command.id)) return; // superseded by STOP
  const bool stop = command.action == Action::StopWater;
  const bool enabled = (command.action == Action::Water || stop) ? state.pumpEnabled :
                       command.action == Action::Light ? state.lightEnabled : state.printerEnabled;
  if (!enabled || (!stop && !planter::fresh(state, millis()))) {
    commandResult(command.id, "not_sent", "Unavailable or stale device state", false); return;
  }
  StaticJsonDocument<512> doc;
  doc["request_id"] = command.id;
  switch (command.action) {
    case Action::Water:
      doc["action"] = "water";
      doc["duration_ms"] = PLANTER_WATER_DURATION_MS;
      break;
    case Action::StopWater: doc["action"] = "stop_water"; break;
    case Action::Light: doc["action"] = "light"; doc["on"] = command.on; break;
    case Action::Print:
      doc["action"] = "print";
      doc["text"] = "RoboPlanter\nManual garden check-in.\nObserve your plant before watering.\n";
      break;
  }
  String body;
  serializeJson(doc, body);
  WiFiClient client;
  HTTPClient http;
  if (!configureHttp(http, client, "/api/v1/command")) {
    commandResult(command.id, "not_sent", "Invalid HTTP configuration", false); return;
  }
  http.addHeader("Content-Type", "application/json");
  commandResult(command.id, "sending", "", true);
  const int code = http.POST(body);
  // Never retry an ambiguous POST, including transport failures or redirects.
  if (code <= 0 || http.getSize() < 0 || http.getSize() > 2048) {
    http.end();
    commandResult(command.id, "unknown", "Response lost; no automatic retry", true, true);
    return;
  }
  const String response = http.getString();
  http.end();
  StaticJsonDocument<1024> result;
  if (deserializeJson(result, response) || !result["ok"].is<bool>() ||
      strcmp(result["request_id"] | "", command.id)) {
    commandResult(command.id, "unknown", "Unverified response; check planter", true, true);
    return;
  }
  const bool ok = result["ok"].as<bool>() && code >= 200 && code < 300;
  const char *status = result["status"] | (ok ? "accepted" : "rejected");
  commandResult(command.id, ok ? status : "rejected", result["error"] | "",
                ok && !terminal(status));
}

void networkTask(void *) {
  uint32_t nextPoll = 0;
  for (;;) {
    Command command;
    // STOP has its own one-element queue and is serviced before other work.
    if (xQueueReceive(stops, &command, 0) == pdTRUE) {
      xQueueReset(commands);
      sendCommand(command);
      // Keep settings from invalidating this STOP between enqueue and POST.
      // Release on every result, including not_sent/unknown; never replay it.
      device_settings::releaseNetworkAfterStop();
      nextPoll = 0;
    }
    // Settings service owns the Wi-Fi API. Scanning, switching and connection
    // timeout/retry handling never run in the display/touch task.
    device_settings::service();
    const uint32_t currentNetwork = device_settings::networkRevision();
    const bool planterNetwork = device_settings::planterNetworkReady();
    {
      xSemaphoreTake(lock, portMAX_DELAY);
      if (shared.networkRevision != currentNetwork) {
        shared.networkRevision = currentNetwork;
        shared.ageKnown = false;
        shared.pumpKnown = shared.pumpEnabled = false;
        shared.lightKnown = shared.lightEnabled = false;
        shared.printerKnown = shared.printerEnabled = false;
        if (shared.commandBlocked && !terminal(shared.commandStatus) &&
            strcmp(shared.commandStatus, "queued") && strcmp(shared.commandStatus, "sending")) {
          shared.uncertain = true;
          copy(shared.commandStatus, "unknown");
          copy(shared.commandError, "Wi-Fi changed; inspect planter; no retry");
        }
        nextPoll = 0;
      }
      shared.wifi = planterNetwork;
      xSemaphoreGive(lock);
    }
    if (xQueueReceive(commands, &command, 0) == pdTRUE) {
      sendCommand(command);
      nextPoll = 0;
    }
    const uint32_t now = millis();
    if (planterNetwork && WiFi.status() == WL_CONNECTED) {
      if (!nextPoll || static_cast<int32_t>(now - nextPoll) >= 0) {
        uploadSoil();
        pollState();
        pollCommandResult();
        nextPoll = millis() + kPollIntervalMs;
      }
    } else {
      const auto wifi = device_settings::wifiState();
      networkError(wifi.phase == device_settings::WifiPhase::Connected ?
                   "Wi-Fi connected; configured planter network not selected" :
                   "Planter Wi-Fi offline; open Wi-Fi settings");
    }
    vTaskDelay(pdMS_TO_TICKS(25));
  }
}
}

namespace planter {
bool begin() {
  if (!device_settings::begin()) return false;
  lock = xSemaphoreCreateMutex();
  commands = xQueueCreate(1, sizeof(Command));
  stops = xQueueCreate(1, sizeof(Command));
  bootNonce = esp_random();
  if (lock && commands && stops &&
      xTaskCreatePinnedToCore(networkTask, "planter-http", 12288, nullptr, 1, nullptr, 0) == pdPASS) return true;
  // No worker exists, so requests must not remain accepted/Connecting forever.
  if (stops) vQueueDelete(stops);
  if (commands) vQueueDelete(commands);
  if (lock) vSemaphoreDelete(lock);
  stops = commands = nullptr; lock = nullptr;
  device_settings::workerStartupFailed();
  return false;
}
State snapshot() {
  State out;
  if (!lock) return out;
  xSemaphoreTake(lock, portMAX_DELAY);
  out = shared;
  xSemaphoreGive(lock);
  // A Wi-Fi selection may be queued while the worker is awaiting HTTP. Disable
  // controls immediately; do not reuse the previous network's capabilities.
  if (out.networkRevision != device_settings::networkRevision() || !device_settings::planterNetworkReady()) {
    out.wifi = false;
    out.pumpEnabled = out.lightEnabled = out.printerEnabled = false;
  }
  return out;
}
bool fresh(const State &state, uint32_t now) {
  return state.received && state.wifi && state.ageKnown &&
         state.networkRevision == device_settings::networkRevision() && device_settings::planterNetworkReady() &&
         static_cast<uint64_t>(now - state.receivedMs) + state.sampleAgeMs <= kStaleMs;
}
bool submit(Action action, bool lightOn) {
  if (!lock || !commands || !stops) return false;
  xSemaphoreTake(lock, portMAX_DELAY);
  const bool stop = action == Action::StopWater;
  const bool enabled = (action == Action::Water || stop) ? shared.pumpEnabled :
                       action == Action::Light ? shared.lightEnabled : shared.printerEnabled;
  if (!enabled || !shared.wifi || shared.networkRevision != device_settings::networkRevision() ||
      !device_settings::planterNetworkReady() || (!stop && (!fresh(shared, millis()) || shared.commandBlocked))) {
    xSemaphoreGive(lock); return false;
  }
  Command command{action, lightOn, {}, device_settings::networkRevision()};
  // Acquire under the settings lock after the checks above: a concurrent UI
  // network change either wins first (STOP rejected) or waits for this STOP.
  // Client -> settings is the only nested lock order. Duplicate pending STOPs
  // are rejected so one reservation always belongs to exactly one queue item.
  if (stop && !device_settings::reserveNetworkForStop(command.networkRevision)) {
    xSemaphoreGive(lock); return false;
  }
  snprintf(command.id, sizeof(command.id), "screen-%08lx-%08lx",
           static_cast<unsigned long>(bootNonce), static_cast<unsigned long>(++sequence));
  const BaseType_t queued = stop ? xQueueOverwrite(stops, &command) : xQueueSend(commands, &command, 0);
  if (queued == pdTRUE) {
    copy(shared.requestId, command.id);
    copy(shared.commandStatus, "queued");
    copy(shared.commandError, "");
    shared.commandBlocked = true;
    shared.uncertain = false;
    shared.commandStartedMs = millis();
  }
  else if (stop) device_settings::releaseNetworkAfterStop();
  xSemaphoreGive(lock);
  return queued == pdTRUE;
}
void acknowledgeUncertain() {
  if (!lock) return;
  xSemaphoreTake(lock, portMAX_DELAY);
  if (shared.uncertain) {
    shared.commandBlocked = false;
    shared.uncertain = false;
    copy(shared.commandStatus, "acknowledged");
    copy(shared.commandError, "Unknown outcome acknowledged; no retry");
    // Do not let a later nonterminal state re-lock an acknowledged result.
    shared.requestId[0] = 0;
  }
  xSemaphoreGive(lock);
}
}
