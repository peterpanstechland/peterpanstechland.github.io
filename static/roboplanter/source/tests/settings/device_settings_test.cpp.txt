// Actual settings implementation, with no radio, hardware, NVS or secrets.
#include <iostream>
#include <stdexcept>
#include "../../firmware/indicator/src/device_settings.cpp"
unsigned checks = 0;
#define CHECK(condition) do { ++checks; if (!(condition)) throw std::runtime_error("check failed at line " + std::to_string(__LINE__)); } while (0)
void advance(uint32_t ms) { settingsTestNow += ms; device_settings::service(); }
void finishConnect() { advance(200); WiFi.connect(); device_settings::service(); }
int main() {
  try {
    using namespace device_settings;
    CHECK(begin()); CHECK(getLanguage() == Language::Chinese); CHECK(getBrightness() == 80);
    CHECK(!saveBrightness(4)); CHECK(!saveBrightness(101)); CHECK(saveBrightness(5));
    CHECK(setLanguage(Language::English)); CHECK(!setLanguage(static_cast<Language>(9)));
    CHECK(Preferences::writes == 0); CHECK(WiFi.connectCalls == 0); // UI never writes NVS or operates radio.
    service(); CHECK(Preferences::writes == 2); CHECK(WiFi.connectCalls == 0);
    finishConnect(); CHECK(wifiState().phase == WifiPhase::Connected); CHECK(planterNetworkReady());
    CHECK(!Preferences::values.count("wifi")); CHECK(!WiFi.autoReconnect);
    const auto priorRevision = networkRevision();
    CHECK(!reserveNetworkForStop(priorRevision + 1));
    CHECK(reserveNetworkForStop(priorRevision)); CHECK(!reserveNetworkForStop(priorRevision));
    CHECK(!requestConnect("office", "valid-password")); CHECK(!restoreDefaultWifi()); CHECK(!requestScan());
    CHECK(wifiState().error == WifiError::Busy); CHECK(networkRevision() == priorRevision); CHECK(planterNetworkReady());
    releaseNetworkAfterStop();
    CHECK(!requestConnect("", "valid-password")); CHECK(wifiState().error == WifiError::InvalidInput);
    CHECK(!requestConnect("office", "short"));
    CHECK(!requestConnect("office", std::string(64, 'x').c_str()));
    CHECK(!requestConnect(std::string(33, 's').c_str(), "valid-password"));
    CHECK(requestConnect("office", "valid-password"));
    CHECK(networkRevision() != priorRevision); CHECK(!planterNetworkReady());
    CHECK(!requestConnect("second", "valid-password")); // Single pending request is not overwritten.
    CHECK(wifiState().error == WifiError::Busy);
    CHECK(!Preferences::values.count("wifi"));
    service(); finishConnect();
    CHECK(wifiState().phase == WifiPhase::Connected); CHECK(!planterNetworkReady());
    CHECK(!strcmp(wifiState().connectedSsid, "office")); CHECK(wifiState().saved);
    CHECK(Preferences::values.count("wifi"));
    const auto savedCredentials = Preferences::values["wifi"];
    CHECK(requestConnect("bad-password", "wrong-password")); service(); advance(200);
    WiFi.failure(WIFI_REASON_AUTH_FAIL); service();
    CHECK(wifiState().phase == WifiPhase::Failed); CHECK(wifiState().error == WifiError::AuthFailed);
    CHECK(Preferences::values["wifi"] == savedCredentials);
    const auto connects = WiFi.connectCalls; advance(60000); CHECK(WiFi.connectCalls == connects);
    CHECK(requestScan()); CHECK(!requestScan());
    service(); CHECK(WiFi.scanCalls == 1); CHECK(WiFi.asyncScan); CHECK(wifiState().scanning);
    for (int i = 0; i < 14; ++i) WiFi.results.push_back({"AP" + std::to_string(i), -90 + i * 3, true});
    WiFi.results.push_back({"AP4", -20, false}); // Duplicate uses strongest AP, no unbounded list.
    WiFi.scanResult = static_cast<int16_t>(WiFi.results.size()); service();
    const auto scanned = wifiState(); CHECK(!scanned.scanning); CHECK(scanned.networkCount == 10);
    CHECK(!strcmp(scanned.networks[0].ssid, "AP4")); CHECK(scanned.networks[0].rssi == -20); CHECK(!scanned.networks[0].secure);
    for (int i = 1; i < scanned.networkCount; ++i) CHECK(scanned.networks[i-1].rssi >= scanned.networks[i].rssi);
    CHECK(WiFi.results.empty()); CHECK(WiFi.scanDeletes == 1);
    CHECK(requestScan()); service();
    CHECK(requestConnect("after-scan", "valid-password"));
    const auto before = WiFi.connectCalls; service(); CHECK(WiFi.connectCalls == before);
    WiFi.scanResult = 0; service(); finishConnect();
    CHECK(!strcmp(wifiState().connectedSsid, "after-scan"));
    CHECK(requestConnect("timeout", "valid-password")); service(); advance(200); advance(20001);
    CHECK(wifiState().phase == WifiPhase::Failed); CHECK(wifiState().error == WifiError::Timeout);
    CHECK(restoreDefaultWifi()); service(); CHECK(!Preferences::values.count("wifi")); finishConnect();
    CHECK(planterNetworkReady()); CHECK(!wifiState().saved);
    const auto liveRevision = networkRevision(); WiFi.link = WL_DISCONNECTED; service();
    CHECK(!planterNetworkReady()); CHECK(networkRevision() != liveRevision);
    CHECK(wifiState().error == WifiError::Disconnected);
    CHECK(requestConnect("open-network", "")); service(); finishConnect(); CHECK(wifiState().phase == WifiPhase::Connected);
    CHECK(requestConnect("missing", "valid-password")); service(); advance(200);
    WiFi.failure(WIFI_REASON_NO_AP_FOUND); service(); CHECK(wifiState().error == WifiError::NetworkNotFound);
    CHECK(requestScan()); service(); WiFi.scanResult = WIFI_SCAN_FAILED; service(); CHECK(wifiState().error == WifiError::ScanFailed);
    CHECK(requestScan()); // A queued scan is superseded before it touches the radio.
    CHECK(requestConnect("supersedes-scan", "valid-password"));
    const auto scans = WiFi.scanCalls; service(); finishConnect(); CHECK(WiFi.scanCalls == scans);
    CHECK(wifiState().phase == WifiPhase::Connected); CHECK(!wifiState().scanning);
    Preferences::available = false; CHECK(saveBrightness(55)); service(); CHECK(getBrightness() == 55);
    CHECK(!wifiState().persistenceAvailable); CHECK(wifiState().error == WifiError::StorageUnavailable);
    // Re-enter setup with the mock NVS retained. Failed writes do not replace
    // the last committed appearance values; successful Wi-Fi is restored.
    Preferences::available = true; initialized = false;
    CHECK(begin()); CHECK(getLanguage() == Language::English); CHECK(getBrightness() == 5);
    CHECK(wifiState().saved); CHECK(!strcmp(wifiState().targetSsid, "supersedes-scan"));
    Preferences::values["language"] = {9}; Preferences::values["brightness"] = {201};
    Preferences::values["wifi"] = {1, 2, 3}; initialized = false;
    CHECK(begin()); CHECK(getLanguage() == Language::Chinese); CHECK(getBrightness() == 80);
    CHECK(!wifiState().saved); CHECK(!strcmp(wifiState().targetSsid, PLANTER_WIFI_SSID));
    workerStartupFailed();
    CHECK(!wifiState().ready); CHECK(wifiState().phase == WifiPhase::Failed);
    CHECK(!begin()); CHECK(!requestScan()); CHECK(!requestConnect("office", "valid-password"));
    CHECK(!restoreDefaultWifi()); CHECK(!setLanguage(Language::English)); CHECK(!saveBrightness(50));
    CHECK(!reserveNetworkForStop(networkRevision())); CHECK(!planterNetworkReady());
    const auto failedWrites = Preferences::writes, failedConnects = WiFi.connectCalls;
    service(); CHECK(Preferences::writes == failedWrites); CHECK(WiFi.connectCalls == failedConnects);
    std::cout << checks << " settings checks passed; no radio/NVS/hardware I/O.\n";
    return 0;
  } catch (const std::exception &error) { std::cerr << error.what() << '\n'; return 1; }
}
