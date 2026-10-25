#pragma once
#include <cstddef>
#include <cstdint>

namespace device_settings {
enum class Language : uint8_t { Chinese, English };
enum class WifiPhase : uint8_t { Idle, Connecting, Connected, Failed };
enum class WifiError : uint8_t {
  None, InvalidInput, Busy, AuthFailed, NetworkNotFound, Timeout,
  Disconnected, ScanFailed, StorageUnavailable, ConnectionFailed
};
constexpr size_t kMaxNetworks = 10;
struct Network {
  char ssid[33] = {};
  int32_t rssi = -127;
  bool secure = false;
};
struct WifiSnapshot {
  bool ready = false, scanning = false, saved = false;
  // Connected Wi-Fi alone does not prove planter reachability. planterNetwork
  // additionally requires the exact PLANTER_WIFI_SSID configured in firmware.
  bool persistenceAvailable = false, planterNetwork = false;
  WifiPhase phase = WifiPhase::Idle;
  WifiError error = WifiError::None;
  char targetSsid[33] = {}, connectedSsid[33] = {}, ip[16] = {};
  int32_t rssi = -127;
  uint8_t networkCount = 0;
  Network networks[kMaxNetworks];
};

// Call once during setup, before starting the network task. Also safe to call
// again after successful initialization. No Wi-Fi operations occur here.
bool begin();
Language getLanguage();
bool setLanguage(Language value);
uint8_t getBrightness();
bool saveBrightness(uint8_t percent); // 5..100; PWM belongs to the board driver.
WifiSnapshot wifiState();             // Never contains credentials.
bool requestScan();                   // Asynchronous; strongest 10 unique SSIDs.
// SSID 1..32 bytes; open network or 8..63 ASCII password / 64 hex PSK.
// Returns request acceptance, not successful association. Save only after DHCP.
// No enterprise identity or captive-portal login is provided by this interface.
bool requestConnect(const char *ssid, const char *password);
bool restoreDefaultWifi();            // Forget saved credentials, use config.h.

// Internal network-task API. UI callers must not invoke service() or WiFi.*.
void service();
uint32_t networkRevision();
bool planterNetworkReady();
// Reserve the current trusted network while one STOP is queued/sending. Wi-Fi
// changes/scans return Busy until release. No client callback or inverse lock.
bool reserveNetworkForStop(uint32_t expectedRevision);
void releaseNetworkAfterStop();
// Called only when HTTP worker startup fails, before it can run service().
// Keep readable settings, but reject requests that no worker can execute/save.
void workerStartupFailed();
}  // namespace device_settings
