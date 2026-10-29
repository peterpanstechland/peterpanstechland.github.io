#include "device_settings.h"
#include "config.h"
#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#include <cstring>

// All WiFi calls and Preferences writes belong to service(), which is called
// only by the HTTP worker. UI methods copy bounded requests under a short lock.
namespace {
using namespace device_settings;
constexpr uint32_t kConnectTimeoutMs = 20000, kRetryMs = 30000;
struct Credentials { uint32_t version = 1; char ssid[33] = {}, password[65] = {}; };
struct WifiRequest {
  bool present = false, save = false, forget = false;
  bool retryKnownNetwork = false;
  uint32_t revision = 0;
  Credentials credentials;
};
struct DisconnectEvent { uint8_t reason = 0; char ssid[33] = {}; };
enum class ConnectStage { Idle, Disconnecting, Attempting, Connected };
Preferences preferences;
SemaphoreHandle_t settingsLock = nullptr;
QueueHandle_t events = nullptr;
WifiSnapshot state;
Language language = Language::Chinese;
uint8_t brightness = 80;
bool initialized = false, preferencesReady = false;
bool stopNetworkReserved = false;
bool languageDirty = false, brightnessDirty = false, scanRequested = false;
uint32_t revision = 1;
WifiRequest pending, active;
// Worker-owned fields below are never read by the UI or the Wi-Fi event task.
bool workerStarted = false, scanRunning = false;
ConnectStage stage = ConnectStage::Idle;
uint32_t stageStarted = 0, nextRetry = 0;

struct Guard {
  Guard() { xSemaphoreTake(settingsLock, portMAX_DELAY); }
  ~Guard() { xSemaphoreGive(settingsLock); }
};
template<size_t N> void copy(char (&out)[N], const char *value) {
  strlcpy(out, value ? value : "", N);
}
void wipe(void *data, size_t size) {
  volatile uint8_t *p = static_cast<volatile uint8_t *>(data);
  while (size--) *p++ = 0;
}
bool validCredentials(const char *ssid, const char *password) {
  if (!ssid || !password) return false;
  const size_t ssidLength = strnlen(ssid, 33), length = strnlen(password, 65);
  if (!ssidLength || ssidLength > 32 || length > 64 || (length && length < 8)) return false;
  for (size_t i = 0; i < ssidLength; ++i)
    if (static_cast<uint8_t>(ssid[i]) < 32 || static_cast<uint8_t>(ssid[i]) == 127) return false;
  for (size_t i = 0; i < length; ++i) {
    const unsigned char c = password[i];
    if (c < 32 || c > 126) return false;
    if (length == 64 && !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')))
      return false;
  }
  return true; // Open networks, 8..63 ASCII passphrases, or 64 hex PSK.
}
void defaultCredentials(Credentials &out) {
  out = Credentials();
  copy(out.ssid, PLANTER_WIFI_SSID);
  copy(out.password, PLANTER_WIFI_PASSWORD);
}
void clearLinkLocked() {
  state.connectedSsid[0] = state.ip[0] = 0;
  state.rssi = -127;
  state.planterNetwork = false;
}
void storageResult(bool ok) {
  Guard guard;
  state.persistenceAvailable = ok;
  if (!ok) state.error = WifiError::StorageUnavailable;
}
void persistAppearance() {
  bool writeLanguage, writeBrightness;
  Language selected; uint8_t percent;
  {
    Guard guard;
    writeLanguage = languageDirty; writeBrightness = brightnessDirty;
    languageDirty = brightnessDirty = false;
    selected = language; percent = brightness;
  }
  if (!writeLanguage && !writeBrightness) return;
  bool ok = preferencesReady;
  if (writeLanguage && preferencesReady)
    ok = preferences.putUChar("language", static_cast<uint8_t>(selected)) == 1 && ok;
  if (writeBrightness && preferencesReady)
    ok = preferences.putUChar("brightness", percent) == 1 && ok;
  storageResult(ok);
}
void wifiEvent(arduino_event_id_t event, arduino_event_info_t info) {
  if (event != ARDUINO_EVENT_WIFI_STA_DISCONNECTED || !events) return;
  DisconnectEvent value;
  value.reason = info.wifi_sta_disconnected.reason;
  const size_t size = info.wifi_sta_disconnected.ssid_len > 32 ? 32 : info.wifi_sta_disconnected.ssid_len;
  memcpy(value.ssid, info.wifi_sta_disconnected.ssid, size);
  // This callback runs on another task. It only publishes nonsecret event data.
  xQueueOverwrite(events, &value);
}
bool currentAttempt() {
  Guard guard;
  return active.revision == revision && !pending.present;
}
void failConnection(WifiError error, bool retry) {
  WiFi.disconnect(false, false);
  stage = ConnectStage::Idle;
  nextRetry = retry ? millis() + kRetryMs : 0;
  Guard guard;
  if (active.revision == revision && !pending.present) {
    state.phase = WifiPhase::Failed;
    state.error = error;
    clearLinkLocked();
  }
}
void startDisconnect() {
  WiFi.disconnect(false, false);
  xQueueReset(events);
  stage = ConnectStage::Disconnecting;
  stageStarted = millis();
  nextRetry = 0;
  Guard guard;
  if (active.revision == revision) {
    state.phase = WifiPhase::Connecting;
    state.error = WifiError::None;
    clearLinkLocked();
  }
}
void serviceConnection() {
  const uint32_t now = millis();
  if (stage == ConnectStage::Disconnecting && now - stageStarted >= 150) {
    if (!currentAttempt()) return;
    xQueueReset(events); // Discard the explicit disconnect from the old attempt.
    stageStarted = now;
    stage = ConnectStage::Attempting;
    WiFi.begin(active.credentials.ssid, active.credentials.password);
  }
  if (stage == ConnectStage::Attempting) {
    if (!currentAttempt()) return;
    if (WiFi.status() == WL_CONNECTED && WiFi.SSID() == active.credentials.ssid) {
      stage = ConnectStage::Connected;
      {
        Guard guard;
        if (active.revision != revision || pending.present) return;
        state.phase = WifiPhase::Connected;
        state.error = WifiError::None;
        copy(state.connectedSsid, active.credentials.ssid);
        copy(state.ip, WiFi.localIP().toString().c_str());
        state.rssi = WiFi.RSSI();
        state.planterNetwork = !strcmp(active.credentials.ssid, PLANTER_WIFI_SSID);
      }
      // Save a single atomic blob only after association + DHCP succeeds.
      // A failed password attempt must not replace working boot credentials.
      if (active.save && currentAttempt()) {
        const bool ok = preferencesReady &&
          preferences.putBytes("wifi", &active.credentials, sizeof(Credentials)) == sizeof(Credentials);
        storageResult(ok);
        Guard guard;
        if (active.revision == revision) state.saved = ok;
      }
      active.save = false;
      active.retryKnownNetwork = true;
      return;
    }
    DisconnectEvent event;
    if (xQueueReceive(events, &event, 0) == pdTRUE &&
        (!event.ssid[0] || !strcmp(event.ssid, active.credentials.ssid))) {
      if (event.reason == WIFI_REASON_AUTH_FAIL || event.reason == WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT ||
          event.reason == WIFI_REASON_HANDSHAKE_TIMEOUT || event.reason == WIFI_REASON_802_1X_AUTH_FAILED) {
        // Saved/provisioned boot credentials were previously known to work.
        // Handshake/auth failures during router or device startup must not
        // permanently strand them. A newly typed password still fails once.
        failConnection(WifiError::AuthFailed, active.retryKnownNetwork); return;
      }
      if (event.reason == WIFI_REASON_NO_AP_FOUND) {
        failConnection(WifiError::NetworkNotFound, true); return;
      }
    }
    if (WiFi.status() == WL_NO_SSID_AVAIL && now - stageStarted > 500) {
      failConnection(WifiError::NetworkNotFound, true); return;
    }
    if (WiFi.status() == WL_CONNECT_FAILED && now - stageStarted > 500) {
      // Generic association failure can be transient after a cold boot.
      // Newly entered invalid credentials above remain non-retrying.
      failConnection(WifiError::ConnectionFailed, true); return;
    }
    if (now - stageStarted >= kConnectTimeoutMs) {
      failConnection(WifiError::Timeout, true); return;
    }
  } else if (stage == ConnectStage::Connected) {
    if (!currentAttempt()) return;
    if (WiFi.status() != WL_CONNECTED) {
      {
        Guard guard;
        // Even a fast reconnection must obtain fresh planter data before use.
        if (active.revision == revision && !pending.present) active.revision = ++revision;
      }
      failConnection(WifiError::Disconnected, true);
    } else {
      Guard guard;
      if (active.revision == revision) state.rssi = WiFi.RSSI();
    }
  } else if (stage == ConnectStage::Idle && nextRetry &&
             static_cast<int32_t>(now - nextRetry) >= 0 && !scanRunning && currentAttempt()) {
    startDisconnect();
  }
}
void insertNetwork(Network (&networks)[kMaxNetworks], uint8_t &size, const Network &network) {
  if (!network.ssid[0]) return;
  size_t index = size;
  for (size_t i = 0; i < size; ++i) {
    if (!strcmp(networks[i].ssid, network.ssid)) {
      if (network.rssi <= networks[i].rssi) return;
      index = i; break;
    }
  }
  if (index == size) {
    if (size < kMaxNetworks) ++size;
    else {
      if (network.rssi <= networks[size - 1].rssi) return;
      index = size - 1;
    }
  }
  networks[index] = network;
  while (index > 0 && networks[index].rssi > networks[index - 1].rssi) {
    const Network temporary = networks[index - 1];
    networks[index - 1] = networks[index]; networks[index] = temporary; --index;
  }
}
void finishScan(int16_t count) {
  Network networks[kMaxNetworks]; uint8_t size = 0;
  // Arduino 2.0.17's indexed accessors take uint8_t. Keep both processing and
  // the UI snapshot bounded, then release the library-owned scan allocation.
  for (int i = 0; i < count && i < 256; ++i) {
    Network item;
    copy(item.ssid, WiFi.SSID(static_cast<uint8_t>(i)).c_str());
    item.rssi = WiFi.RSSI(static_cast<uint8_t>(i));
    item.secure = WiFi.encryptionType(static_cast<uint8_t>(i)) != WIFI_AUTH_OPEN;
    insertNetwork(networks, size, item);
  }
  WiFi.scanDelete();
  scanRunning = false;
  Guard guard;
  state.scanning = false;
  if (count < 0) state.error = WifiError::ScanFailed;
  else {
    state.networkCount = size;
    memcpy(state.networks, networks, sizeof(networks));
  }
}
void serviceScan() {
  if (scanRunning) {
    const int16_t count = WiFi.scanComplete();
    if (count != WIFI_SCAN_RUNNING) finishScan(count);
    return;
  }
  bool requested = false;
  {
    Guard guard;
    if (!pending.present && scanRequested) { requested = true; scanRequested = false; }
  }
  if (!requested) return;
  if (stage == ConnectStage::Attempting || stage == ConnectStage::Disconnecting) {
    WiFi.disconnect(false, false);
    stage = ConnectStage::Idle;
    nextRetry = millis() + kRetryMs;
    Guard guard;
    if (active.revision == revision) state.phase = WifiPhase::Idle;
  }
  scanRunning = true;
  // Nonblocking scan. The pinned core bounds timeout to 120 * 20 ms.
  const int16_t result = WiFi.scanNetworks(true, false, false, 120);
  if (result != WIFI_SCAN_RUNNING) finishScan(result);
}
}  // namespace

namespace device_settings {
bool begin() {
  if (initialized) { Guard guard; return state.ready; }
  settingsLock = xSemaphoreCreateMutex();
  events = xQueueCreate(1, sizeof(DisconnectEvent));
  if (!settingsLock || !events) {
    if (events) vQueueDelete(events);
    if (settingsLock) vSemaphoreDelete(settingsLock);
    events = nullptr; settingsLock = nullptr;
    return false;
  }
  preferencesReady = preferences.begin("rp-settings", false);
  Credentials credentials;
  defaultCredentials(credentials);
  bool saved = false;
  if (preferencesReady) {
    const uint8_t storedLanguage = preferences.getUChar("language", 0);
    language = storedLanguage == 1 ? Language::English : Language::Chinese;
    const uint8_t storedBrightness = preferences.getUChar("brightness", 80);
    brightness = storedBrightness >= 5 && storedBrightness <= 100 ? storedBrightness : 80;
    Credentials stored;
    if (preferences.isKey("wifi") && preferences.getBytesLength("wifi") == sizeof(stored) &&
        preferences.getBytes("wifi", &stored, sizeof(stored)) == sizeof(stored) &&
        stored.version == 1 && stored.ssid[32] == 0 && stored.password[64] == 0 &&
        validCredentials(stored.ssid, stored.password)) {
      credentials = stored; saved = true;
    }
    wipe(&stored, sizeof(stored));
  }
  pending.present = true; pending.revision = revision; pending.credentials = credentials;
  // A successful first boot also persists the provisioned network. Subsequent
  // boots load that committed blob without writing Flash again.
  pending.save = !saved;
  pending.retryKnownNetwork = true;
  state.ready = true; state.saved = saved; state.persistenceAvailable = preferencesReady;
  state.phase = WifiPhase::Connecting;
  copy(state.targetSsid, credentials.ssid);
  wipe(&credentials, sizeof(credentials));
  initialized = true;
  return true;
}
Language getLanguage() { if (!initialized) return Language::Chinese; Guard guard; return language; }
bool setLanguage(Language value) {
  if (!initialized || (value != Language::Chinese && value != Language::English)) return false;
  Guard guard;
  if (!state.ready) return false;
  if (language != value) { language = value; languageDirty = true; }
  return true;
}
uint8_t getBrightness() { if (!initialized) return 80; Guard guard; return brightness; }
bool saveBrightness(uint8_t percent) {
  if (!initialized || percent < 5 || percent > 100) return false;
  Guard guard;
  if (!state.ready) return false;
  if (brightness != percent) { brightness = percent; brightnessDirty = true; }
  return true;
}
WifiSnapshot wifiState() { if (!initialized) return WifiSnapshot(); Guard guard; return state; }
PlanterEndpoint planterEndpoint() {
  PlanterEndpoint result;
  copy(result.ssid, PLANTER_WIFI_SSID);
  // Show only the origin. Even a mistakenly configured URL containing userinfo
  // or a query must not expose it on the display.
  const char *url = PLANTER_BASE_URL;
  const char *scheme = strstr(url, "://");
  if (scheme && (!strncmp(url, "http://", 7) || !strncmp(url, "https://", 8))) {
    const char *host = scheme + 3;
    const char *end = host + strcspn(host, "/?#");
    for (const char *p = host; p < end; ++p) if (*p == '@') host = p + 1;
    const size_t prefix = static_cast<size_t>(scheme + 3 - url);
    const size_t hostBytes = static_cast<size_t>(end - host);
    if (prefix < 10 && prefix + hostBytes < sizeof(result.address) && hostBytes) {
      memcpy(result.address, url, prefix);
      memcpy(result.address + prefix, host, hostBytes);
      result.address[prefix + hostBytes] = 0;
    }
  }
  result.configured = result.address[0] && PLANTER_DEVICE_TOKEN[0] &&
                      strcmp(PLANTER_DEVICE_TOKEN, "change-me-before-use") &&
                      strcmp(PLANTER_WIFI_SSID, "RoboPlanter-XXXX");
  return result;
}
bool requestScan() {
  if (!initialized) return false;
  Guard guard;
  if (!state.ready) return false;
  if (stopNetworkReserved || state.scanning || scanRequested || pending.present) { state.error = WifiError::Busy; return false; }
  scanRequested = true; state.scanning = true; state.error = WifiError::None;
  state.networkCount = 0;
  return true;
}
bool queueConnection(const char *ssid, const char *password, bool forget) {
  if (!initialized) return false;
  Guard guard;
  if (!state.ready) return false;
  if (!validCredentials(ssid, password)) { state.error = WifiError::InvalidInput; return false; }
  if (stopNetworkReserved || pending.present) { state.error = WifiError::Busy; return false; }
  pending.present = true; pending.forget = forget; pending.save = !forget;
  pending.retryKnownNetwork = forget;
  pending.revision = ++revision;
  // A connect request supersedes a scan not yet started by the worker. An
  // already-running scan finishes first, then the new connection is applied.
  if (scanRequested) { scanRequested = false; state.scanning = false; }
  copy(pending.credentials.ssid, ssid); copy(pending.credentials.password, password);
  state.phase = WifiPhase::Connecting; state.error = WifiError::None; state.saved = false;
  copy(state.targetSsid, ssid); clearLinkLocked();
  return true;
}
bool requestConnect(const char *ssid, const char *password) { return queueConnection(ssid, password, false); }
bool restoreDefaultWifi() { return queueConnection(PLANTER_WIFI_SSID, PLANTER_WIFI_PASSWORD, true); }
uint32_t networkRevision() { if (!initialized) return 0; Guard guard; return revision; }
bool planterNetworkReady() {
  if (!initialized) return false;
  Guard guard;
  return state.ready && state.phase == WifiPhase::Connected && state.planterNetwork && !pending.present;
}
bool reserveNetworkForStop(uint32_t expectedRevision) {
  if (!initialized) return false;
  Guard guard;
  if (!state.ready || stopNetworkReserved || pending.present || revision != expectedRevision ||
      state.phase != WifiPhase::Connected || !state.planterNetwork) return false;
  stopNetworkReserved = true;
  return true;
}
void releaseNetworkAfterStop() {
  if (!initialized) return;
  Guard guard;
  stopNetworkReserved = false;
}
void workerStartupFailed() {
  if (!initialized) return;
  Guard guard;
  state.ready = false;
  state.phase = WifiPhase::Failed;
  state.error = WifiError::ConnectionFailed;
  state.scanning = scanRequested = stopNetworkReserved = false;
  languageDirty = brightnessDirty = false;
  ++revision;
  clearLinkLocked();
  wipe(&pending, sizeof(pending));
  pending = WifiRequest();
}
void service() {
  if (!initialized) return;
  { Guard guard; if (!state.ready) return; }
  if (!workerStarted) {
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(false);
    WiFi.onEvent(wifiEvent, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
    workerStarted = true;
  }
  persistAppearance();
  serviceScan();
  bool changed = false;
  if (!scanRunning) {
    Guard guard;
    if (pending.present) {
      wipe(&active, sizeof(active));
      active = pending;
      wipe(&pending, sizeof(pending));
      pending = WifiRequest();
      changed = true;
    }
  }
  if (changed) {
    if (active.forget) {
      const bool ok = preferencesReady && (!preferences.isKey("wifi") || preferences.remove("wifi"));
      storageResult(ok);
    }
    startDisconnect();
  }
  serviceConnection();
}
}  // namespace device_settings
