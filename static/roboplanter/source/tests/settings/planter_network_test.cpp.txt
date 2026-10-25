// Actual HTTP client + settings module; mocked radio, HTTP, RTOS and NVS only.
// Each startup-failure scenario is a fresh process, like a cold device boot.
#include <iostream>
#include <stdexcept>
#include <Preferences.h>
#include "../../firmware/indicator/src/planter_client.cpp"
unsigned checks = 0;
#define CHECK(condition) do { ++checks; if (!(condition)) throw std::runtime_error("check failed at line " + std::to_string(__LINE__)); } while (0)
void workerOnce() {
  CHECK(settingsTestTask != nullptr);
  try { settingsTestTask(nullptr); }
  catch (const SettingsTestEndIteration &) { return; }
  throw std::runtime_error("worker did not yield");
}
void connectConfiguredNetwork() {
  workerOnce(); settingsTestNow += 200;
  device_settings::service(); WiFi.connect(); workerOnce();
  CHECK(device_settings::planterNetworkReady()); CHECK(planter::fresh(planter::snapshot(), millis()));
}
int main(int argc, char **argv) {
  try {
    const String scenario = argc > 1 ? argv[1] : "stop-switch";
    if (scenario == "settings-mutex") settingsTestFailMutexOn = 1;
    else if (scenario == "settings-queue") settingsTestFailQueueOn = 1;
    else if (scenario == "client-mutex") settingsTestFailMutexOn = 2;
    else if (scenario == "commands-queue") settingsTestFailQueueOn = 2;
    else if (scenario == "stops-queue") settingsTestFailQueueOn = 3;
    else if (scenario == "task") settingsTestTaskFail = true;
    if (scenario != "stop-switch") {
      CHECK(!planter::begin()); CHECK(settingsTestTask == nullptr);
      CHECK(!device_settings::wifiState().ready); CHECK(!device_settings::planterNetworkReady());
      CHECK(!device_settings::requestScan()); CHECK(!device_settings::requestConnect("office", "test-password"));
      CHECK(!device_settings::setLanguage(device_settings::Language::English));
      CHECK(!device_settings::saveBrightness(55));
      CHECK(!planter::submit(planter::Action::StopWater)); CHECK(!planter::snapshot().wifi);
      device_settings::service(); CHECK(WiFi.connectCalls == 0); CHECK(Preferences::writes == 0);
      const bool settingsFailed = scenario == "settings-mutex" || scenario == "settings-queue";
      CHECK(settingsTestLiveMutexes == (settingsFailed ? 0U : 1U));
      CHECK(settingsTestLiveQueues == (settingsFailed ? 0U : 1U));
    } else {
      CHECK(planter::begin());
      settingsTestStateBody = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"pump":{"enabled":true,"on":true},"light":{"enabled":true,"on":false},"printer":{"enabled":true,"status":"idle"}})";
      connectConfiguredNetwork();
      const auto initialNetwork = device_settings::networkRevision();
      CHECK(planter::submit(planter::Action::StopWater));
      CHECK(!device_settings::requestConnect("office", "test-password"));
      CHECK(!device_settings::restoreDefaultWifi()); CHECK(!device_settings::requestScan());
      CHECK(device_settings::networkRevision() == initialNetwork);
      CHECK(device_settings::planterNetworkReady());
      const String stopId = planter::snapshot().requestId;
      CHECK(!planter::submit(planter::Action::StopWater)); // Never overwrite the one reserved STOP.
      CHECK(stopId == planter::snapshot().requestId);
      settingsTestPostHook = [&](const String &body) {
        CHECK(!device_settings::requestConnect("office", "test-password"));
        CHECK(!device_settings::restoreDefaultWifi()); CHECK(!device_settings::requestScan());
        CHECK(!planter::submit(planter::Action::StopWater));
        CHECK(device_settings::networkRevision() == initialNetwork);
        StaticJsonDocument<256> request; CHECK(!deserializeJson(request, body));
        CHECK(!strcmp(request["action"] | "", "stop_water"));
        CHECK(stopId == (request["request_id"] | ""));
        settingsTestPostBody = "{\"ok\":true,\"request_id\":\"" + stopId + "\",\"status\":\"completed\",\"error\":\"\"}";
      };
      workerOnce();
      CHECK(settingsTestPosts.size() == 1); CHECK(!strcmp(planter::snapshot().commandStatus, "completed"));
      CHECK(device_settings::networkRevision() == initialNetwork);
      // Once STOP returns, ordinary switches immediately invalidate the previous
      // capabilities and prevent a queued non-STOP from ever reaching the radio.
      CHECK(planter::submit(planter::Action::Water));
      CHECK(device_settings::requestConnect("office", "test-password"));
      CHECK(device_settings::networkRevision() != initialNetwork);
      CHECK(!planter::snapshot().wifi); CHECK(!planter::snapshot().pumpEnabled);
      CHECK(!planter::fresh(planter::snapshot(), millis()));
      CHECK(!planter::submit(planter::Action::StopWater));
      workerOnce();
      CHECK(settingsTestPosts.size() == 1); CHECK(!strcmp(planter::snapshot().commandStatus, "not_sent"));
      settingsTestNow += 200; device_settings::service(); WiFi.connect();
      const auto callsBeforeOffice = settingsTestHttpBegins;
      workerOnce(); CHECK(device_settings::wifiState().phase == device_settings::WifiPhase::Connected);
      CHECK(!device_settings::planterNetworkReady()); CHECK(settingsTestHttpBegins == callsBeforeOffice);
      // Returning to the configured network requires fresh state. A physical
      // link loss during queued STOP yields not_sent, releases the reservation,
      // and never replays that STOP on the user's next selected network.
      CHECK(device_settings::restoreDefaultWifi()); connectConfiguredNetwork();
      CHECK(planter::submit(planter::Action::StopWater)); WiFi.link = WL_DISCONNECTED;
      workerOnce(); CHECK(!strcmp(planter::snapshot().commandStatus, "not_sent"));
      CHECK(settingsTestPosts.size() == 1);
      CHECK(device_settings::requestConnect("office", "test-password"));
      CHECK(!planter::submit(planter::Action::StopWater));
    }
    std::cout << scenario << ": " << checks << " checks passed; mocked network only.\n";
    return 0;
  } catch (const std::exception &error) { std::cerr << error.what() << '\n'; return 1; }
}
