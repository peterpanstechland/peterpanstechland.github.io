// Actual HTTP client + settings module; mocked radio, HTTP, RTOS and NVS only.
// Each startup-failure scenario is a fresh process, like a cold device boot.
#include <iostream>
#include <stdexcept>
#include <Preferences.h>
#include "../../firmware/indicator/src/planter_client.cpp"
#include "planter_presentation.h"
// This network harness does not run the RP2040 sampler or invent soil data.
namespace local_soil { Sample snapshot() { return Sample(); } bool notifyFocusComplete(){return true;} }
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
    if (scenario != "stop-switch" && scenario != "print" && scenario != "sensors" && scenario != "companion" && scenario != "calibration" && scenario != "auto-light") {
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
    } else if(scenario=="auto-light") {
      CHECK(planter::begin());
      auto fixture=[](unsigned revision,bool enabled,bool pump=false) {
        return String("{\"schema_version\":1,\"device_id\":\"mock-planter\",\"sample_age_ms\":0,\"auto_light\":{\"schema\":1,\"available\":true,\"writable\":true,\"paused\":false,\"sensor_stale\":false,\"revision\":")+std::to_string(revision)+",\"enabled\":"+(enabled?"true":"false")+",\"on_below\":1200,\"off_above\":1800},\"pump\":{\"enabled\":true,\"water_allowed\":true,\"on\":"+(pump?"true":"false")+"}}";
      };
      settingsTestStateBody=fixture(0,false);connectConfiguredNetwork();
      auto state=planter::snapshot();CHECK(state.autoLightKnown&&state.autoLightAvailable&&state.autoLightWritable);
      auto settings=state.autoLight;settings.enabled=true;
      CHECK(planter::submitAutoLight(settings));CHECK(!planter::submitAutoLight(settings));CHECK(!planter::submit(planter::Action::Water));
      settingsTestPostHook=[&](const String& body) {
        StaticJsonDocument<256> doc;CHECK(!deserializeJson(doc,body));CHECK(doc["enabled"]==true&&doc["on_below"]==1200&&doc["off_above"]==1800&&doc["revision"]==0);
        settingsTestPostBody="{\"ok\":true,\"revision\":1}";settingsTestStateBody=fixture(1,true);
      };
      workerOnce();CHECK(settingsTestPosts.size()==1);CHECK(settingsTestPosts.back().url.find("/api/v1/auto-light")!=String::npos);
      CHECK(planter::snapshot().autoLightWrite==planter::CalibrationWrite::Saved);CHECK(!planter::submitAutoLight(settings));
      settings.revision=1;settings.enabled=false;
      settingsTestStateBody=fixture(1,true,true);pollState();CHECK(!planter::submitAutoLight(settings));
      settingsTestStateBody=fixture(1,true);pollState();CHECK(planter::submitAutoLight(settings));
      settingsTestPostHook=[&](const String&){settingsTestPostCode=-1;};workerOnce();
      CHECK(planter::snapshot().autoLightWrite==planter::CalibrationWrite::Unknown);
      auto sent=settingsTestPosts.size();settingsTestNow+=2000;workerOnce();CHECK(settingsTestPosts.size()==sent);
      settingsTestStateBody=fixture(2,false);pollState();CHECK(planter::snapshot().autoLightWrite==planter::CalibrationWrite::Saved);
      settings.revision=2;CHECK(planter::submitAutoLight(settings));settingsTestNow+=kStaleMs+1;workerOnce();
      CHECK(settingsTestPosts.size()==sent&&planter::snapshot().autoLightWrite==planter::CalibrationWrite::Failed);
      settingsTestStateBody=fixture(2,false);pollState();CHECK(planter::submitAutoLight(settings));
      CHECK(device_settings::requestConnect("untrusted","test-password"));workerOnce();CHECK(settingsTestPosts.size()==sent);
    } else if (scenario == "calibration") {
      CHECK(planter::begin());
      auto fixture = [](unsigned revision, int dry, int wet, bool pump = false) {
        return String("{\"schema_version\":1,\"device_id\":\"mock-planter\",\"sample_age_ms\":0,\"calibration\":{\"schema\":1,\"writable\":true,\"revision\":") + std::to_string(revision) +
          ",\"dry\":" + std::to_string(dry) + ",\"wet\":" + std::to_string(wet) + ",\"full_mm\":-1,\"empty_mm\":-1,\"stop_mm\":-1},\"pump\":{\"enabled\":true,\"water_allowed\":true,\"on\":" + (pump ? "true" : "false") + "}}";
      };
      settingsTestStateBody = fixture(0, -1, -1); connectConfiguredNetwork();
      CHECK(planter::snapshot().calibrationKnown && planter::snapshot().calibrationWritable);
      robo::CalibrationEdit edit{robo::CalibrationKind::Soil, 0, false, 3000, 1500};
      CHECK(planter::submitCalibration(edit)); CHECK(!planter::submitCalibration(edit));
      CHECK(!planter::submit(planter::Action::Water)); // no concurrent ordinary action
      settingsTestPostHook = [&](const String& body) {
        StaticJsonDocument<512> doc; CHECK(!deserializeJson(doc, body));
        CHECK(!strcmp(doc["kind"] | "", "soil") && doc["dry"] == 3000 && doc["wet"] == 1500);
        CHECK(doc["revision"] == 0 && doc["reset"] == false);
        settingsTestPostBody = "{\"ok\":true,\"revision\":1}"; settingsTestStateBody = fixture(1, 3000, 1500);
      };
      workerOnce(); CHECK(settingsTestPosts.size() == 1);
      CHECK(settingsTestPosts.back().url.find("/api/v1/calibration") != String::npos);
      CHECK(planter::snapshot().calibrationWrite == planter::CalibrationWrite::Saved);
      CHECK(planter::snapshot().calibration.revision == 1);
      CHECK(!planter::submitCalibration(edit)); // stale revision cannot clobber newer settings
      edit.revision = 1; edit.reset = true;
      settingsTestStateBody = fixture(1, 3000, 1500, true); pollState(); CHECK(!planter::submitCalibration(edit));
      settingsTestStateBody = fixture(1, 3000, 1500); pollState(); CHECK(planter::submitCalibration(edit));
      settingsTestPostHook = [&](const String&) { settingsTestPostCode = -1; };
      workerOnce(); CHECK(planter::snapshot().calibrationWrite == planter::CalibrationWrite::Unknown);
      const size_t sent = settingsTestPosts.size();
      settingsTestNow += 2000; workerOnce(); CHECK(settingsTestPosts.size() == sent); // never auto-retry writes
      settingsTestStateBody = fixture(2, -1, -1); pollState();
      CHECK(planter::snapshot().calibrationWrite == planter::CalibrationWrite::Saved); // lost response recovered by readback
      edit.revision = 2; CHECK(planter::submitCalibration(edit)); settingsTestNow += kStaleMs + 1;
      workerOnce(); CHECK(settingsTestPosts.size() == sent);
      CHECK(planter::snapshot().calibrationWrite == planter::CalibrationWrite::Failed);
      settingsTestStateBody = fixture(2, 4096, 1500); pollState(); CHECK(!planter::snapshot().calibrationKnown);
      settingsTestStateBody = fixture(2, -1, -1); pollState(); CHECK(planter::submitCalibration(edit));
      CHECK(device_settings::requestConnect("untrusted", "test-password")); workerOnce();
      CHECK(settingsTestPosts.size() == sent); // queued calibration cannot leak token onto another Wi-Fi
    } else if(scenario=="companion") {
      CHECK(planter::begin());
      const String valid=R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"uptime_ms":1000,"auto_print":true,"yoyo":{"enabled":true,"paired":false,"pairing":true,"pin":123456},"focus":{"enabled":true,"phase":1,"revision":8,"duration_ms":60000,"remaining_ms":58000}})";
      settingsTestStateBody=valid;connectConfiguredNetwork();
      auto state=planter::snapshot();CHECK(state.focusKnown && state.focusRemaining==58000 && state.focusRevision==8);
      CHECK(state.yoyoEnabled && state.yoyoPairing && state.yoyoPin==123456 && state.autoPrint);
      CHECK(!planter::submit(planter::Action::FocusStart,false,nullptr,0));
      CHECK(!planter::submit(planter::Action::FocusStart,false,nullptr,121));
      settingsTestPostHook=[&](const String& body) {
        StaticJsonDocument<512> doc;CHECK(!deserializeJson(doc,body));
        CHECK(!strcmp(doc["action"]|"","focus_start"));CHECK(doc["duration_ms"].as<int>()==60000);
        settingsTestPostBody="{\"ok\":true,\"request_id\":\""+String(doc["request_id"]|"")+"\",\"status\":\"completed\"}";
      };
      CHECK(planter::submit(planter::Action::FocusStart,false,nullptr,1));workerOnce();CHECK(settingsTestPosts.size()==1);
      settingsTestStateBody=R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"focus":{"enabled":true,"phase":1,"revision":8,"duration_ms":60000,"remaining_ms":60001}})";
      pollState();CHECK(!planter::snapshot().focusKnown);CHECK(!planter::submit(planter::Action::FocusPause));
      settingsTestStateBody=valid;pollState();CHECK(planter::submit(planter::Action::FocusPause));
      settingsTestNow+=kStaleMs+1;workerOnce();CHECK(settingsTestPosts.size()==1);
      CHECK(!strcmp(planter::snapshot().commandStatus,"not_sent"));
      robo::DailyTicket ticket;StaticJsonDocument<512> json;
      CHECK(!deserializeJson(json,R"({"card":0,"reversed":0,"english":0,"species":0,"soil":-9999,"raw":-9999,"temperature":-9999,"humidity":-9999,"scene":1,"note":"a\u0000b"})"));
      CHECK(!robo::readDaily(json.as<JsonVariantConst>(),ticket));
    } else if (scenario == "sensors") {
      CHECK(planter::begin());
      settingsTestStateBody = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"ambient_light":{"enabled":true,"raw":0,"valid":true},"uv":{"raw":987,"valid":true}})";
      connectConfiguredNetwork();
      CHECK(planter::snapshot().ambientLightEnabled);
      CHECK(planter::snapshot().ambientLightRaw.valid);
      CHECK(planter::snapshot().ambientLightRaw.value == 0);
      CHECK(planter::snapshot().uvRaw.value == 987);
      settingsTestStateBody = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"ambient_light":{"enabled":true,"raw":1200,"valid":false}})";
      pollState(); CHECK(!planter::snapshot().ambientLightRaw.valid);
      for (const char* raw : {"null", "-1", "4096", "\"1200\""}) {
        settingsTestStateBody = String("{\"schema_version\":1,\"device_id\":\"mock-planter\",\"sample_age_ms\":0,\"ambient_light\":{\"enabled\":true,\"valid\":true,\"raw\":") + raw + "}}";
        pollState(); CHECK(!planter::snapshot().ambientLightRaw.valid);
      }
      settingsTestStateBody = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"uv":{"raw":321,"valid":true}})";
      pollState(); CHECK(!planter::snapshot().ambientLightEnabled);
      CHECK(!planter::snapshot().ambientLightRaw.valid);
      CHECK(planter::snapshot().uvRaw.value == 321);
      settingsTestStateBody = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"ambient_light":{"enabled":false,"raw":1200,"valid":true}})";
      pollState(); CHECK(!planter::snapshot().ambientLightRaw.valid);
      settingsTestStateBody = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"sen54":{"enabled":true,"valid":true,"pm25_ug_m3":12.3,"voc_index":105},"water_tank":{"enabled":true,"valid":true,"calibrated":false,"distance_mm":150,"level_pct":50},"pump":{"enabled":true,"on":false,"water_allowed":false,"water_block_reason":"tank_uncalibrated"}})";
      pollState(); auto sensors = planter::snapshot();
      CHECK(sensors.pm25.valid && sensors.vocIndex.valid && sensors.tankDistance.valid);
      CHECK(!sensors.tankLevel.valid && !sensors.waterAllowed);
      CHECK(!planter::submit(planter::Action::Water));
      CHECK(!strcmp(sensors.waterBlockReason,"tank_uncalibrated"));
      settingsTestStateBody = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"sen54":{"enabled":true,"valid":true,"pm25_ug_m3":null,"voc_index":0},"water_tank":{"enabled":true,"valid":false,"calibrated":true,"distance_mm":150,"level_pct":50},"pump":{"enabled":true,"on":false}})";
      pollState(); sensors = planter::snapshot();
      CHECK(!sensors.pm25.valid && !sensors.vocIndex.valid && !sensors.tankDistance.valid && !sensors.tankLevel.valid);
      CHECK(!planter::submit(planter::Action::Water)); // Missing explicit permission fails closed.
    } else if (scenario == "print") {
      CHECK(planter::begin());
      const String modern = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"printer":{"enabled":true,"status":"idle","text_format":"utf8-raster","layout":"receipt32-v2","autocut":true}})";
      const String oldRaster = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"printer":{"enabled":true,"status":"idle","text_format":"utf8-raster"}})";
      const String legacy = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"printer":{"enabled":true,"status":"idle"}})";
      settingsTestStateBody = modern; connectConfiguredNetwork();
      CHECK(planter::snapshot().printerRaster && planter::snapshot().printerAutocut);
      auto zh = planter_presentation::receipt(planter::snapshot(), false);
      auto en = planter_presentation::receipt(planter::snapshot(), true);
      CHECK(zh.requiresRaster && !en.requiresRaster);
      CHECK(zh.layout32 && en.layout32);
      CHECK(strlen(zh.text) <= 160 && strlen(en.text) <= 160);
      const String approved = zh.text;
      CHECK(!planter::submit(planter::Action::Print));
      CHECK(planter::submit(planter::Action::Print, false, &zh));
      strcpy(zh.text, "Modified after approval"); // The RTOS queue must own its copy.
      CHECK(device_settings::setLanguage(device_settings::Language::English));
      settingsTestPostHook = [&](const String &body) {
        StaticJsonDocument<512> doc; CHECK(!deserializeJson(doc, body));
        CHECK(!strcmp(doc["action"] | "", "print"));
        CHECK(approved == (doc["text"] | ""));
        settingsTestPostBody = "{\"ok\":true,\"request_id\":\"" + String(doc["request_id"] | "") + "\",\"status\":\"completed\"}";
      };
      workerOnce(); CHECK(settingsTestPosts.size() == 1);
      settingsTestStateBody = legacy; pollState();
      auto fallback = planter_presentation::receipt(planter::snapshot(), false);
      CHECK(!fallback.requiresRaster && !strcmp(fallback.text, en.text));
      for (const unsigned char *p = reinterpret_cast<const unsigned char *>(fallback.text); *p; ++p) CHECK(*p < 128);
      auto modernState = planter::snapshot(); modernState.printerRaster = modernState.printerLayout32 = true;
      zh = planter_presentation::receipt(modernState, false);
      CHECK(!planter::submit(planter::Action::Print, false, &zh));
      settingsTestStateBody = modern; pollState();
      CHECK(planter::submit(planter::Action::Print, false, &zh));
      settingsTestStateBody = oldRaster; pollState(); workerOnce();
      CHECK(settingsTestPosts.size() == 1);
      CHECK(!strcmp(planter::snapshot().commandStatus, "not_sent"));
      settingsTestStateBody = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"printer":{"enabled":true,"status":"recovery_required","text_format":"utf8-raster"}})";
      pollState(); CHECK(!planter::submit(planter::Action::Print, false, &zh));
      settingsTestStateBody = modern; pollState();
      const String dailyState = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"printer":{"enabled":true,"status":"idle","text_format":"utf8-raster","daily_layout":"garden-daily-v2"}})";
      settingsTestStateBody=dailyState;pollState();CHECK(planter::snapshot().printerDaily);
      auto preview=planter_presentation::dailyReceipt(planter::snapshot(),false,2,[]{return 155U;});
      CHECK(preview.daily.card==77 && preview.daily.reversed==1 && preview.daily.soil==-9999);
      CHECK(planter::submit(planter::Action::Print,false,&preview));
      preview.daily.card=0; // The queue owns the approved 78th card, not this mutation.
      settingsTestPostHook = [&](const String& body){
        StaticJsonDocument<1024> doc;CHECK(!deserializeJson(doc,body));
        CHECK(!strcmp(doc["action"]|"","print_daily"));CHECK(!doc.containsKey("text"));
        robo::DailyTicket decoded;CHECK(robo::readDaily(doc["daily"],decoded));
        CHECK(decoded.card==77 && decoded.reversed==1 && decoded.species==2);
        doc["daily"]["card"]=78;CHECK(!robo::readDaily(doc["daily"],decoded));
        doc["daily"]["card"]=0;doc["daily"]["extra"]=1;CHECK(!robo::readDaily(doc["daily"],decoded));
        settingsTestPostBody="{\"ok\":true,\"request_id\":\""+String(doc["request_id"]|"")+"\",\"status\":\"completed\"}";
      };
      workerOnce();CHECK(settingsTestPosts.size()==2);
      CHECK(planter::submit(planter::Action::Print,false,&preview));
      settingsTestStateBody=modern;pollState();workerOnce();CHECK(settingsTestPosts.size()==2);
      CHECK(!strcmp(planter::snapshot().commandStatus,"not_sent"));
      CHECK(!planter::submit(planter::Action::Print,false,&preview));
      settingsTestGetCode = 401; pollState();
      auto state = planter::snapshot();
      CHECK(state.networkFailure == planter::NetworkFailure::Authentication && state.httpStatus == 401);
      CHECK(!planter::fresh(state, millis()));
      CHECK(!planter::submit(planter::Action::Print, false, &zh));
      using planter_presentation::Link;
      auto wifi = device_settings::wifiState();
      CHECK(planter_presentation::link(state, wifi, millis()) == Link::Authentication);
      wifi.planterNetwork = false; CHECK(planter_presentation::link(state, wifi, millis()) == Link::WrongNetwork);
      wifi.phase = device_settings::WifiPhase::Idle; CHECK(planter_presentation::link(state, wifi, millis()) == Link::Offline);
      settingsTestGetCode = 400; pollState();
      state = planter::snapshot();
      CHECK(state.httpStatus == 400 && state.networkFailure == planter::NetworkFailure::Http);
      CHECK(planter_presentation::link(state, device_settings::wifiState(), millis()) == Link::NoResponse);
      CHECK(!planter::submit(planter::Action::Print, false, &zh));
      settingsTestGetCode = 200; pollState();
      CHECK(planter::fresh(planter::snapshot(), millis()));
      settingsTestNow += kStaleMs + 1;
      CHECK(planter_presentation::link(planter::snapshot(), device_settings::wifiState(), millis()) == Link::Stale);
    } else {
      CHECK(planter::begin());
      settingsTestStateBody = R"({"schema_version":1,"device_id":"mock-planter","sample_age_ms":0,"pump":{"enabled":true,"on":true,"water_allowed":true},"light":{"enabled":true,"on":false},"printer":{"enabled":true,"status":"idle"}})";
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
