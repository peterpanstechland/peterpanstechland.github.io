#pragma once
#include "Arduino.h"
#include <vector>
enum { WIFI_STA = 1, WIFI_AUTH_OPEN = 0, WIFI_AUTH_WPA2_PSK = 3, WIFI_SCAN_RUNNING = -1, WIFI_SCAN_FAILED = -2 };
enum wl_status_t { WL_IDLE_STATUS, WL_NO_SSID_AVAIL, WL_CONNECTED, WL_CONNECT_FAILED, WL_DISCONNECTED };
enum arduino_event_id_t { ARDUINO_EVENT_WIFI_STA_DISCONNECTED };
struct arduino_event_info_t { struct { uint8_t reason = 0, ssid_len = 0, ssid[32] = {}; } wifi_sta_disconnected; };
struct TestAddress { String toString() const { return "192.168.4.2"; } };
struct TestNetwork { String ssid; int32_t signal; bool secure; };
class TestWifi {
 public:
  using Callback = void (*)(arduino_event_id_t, arduino_event_info_t);
  Callback callback = nullptr;
  unsigned connectCalls = 0, scanCalls = 0, disconnectCalls = 0, scanDeletes = 0;
  wl_status_t link = WL_DISCONNECTED;
  String current, attempted;
  std::vector<TestNetwork> results;
  int16_t scanResult = WIFI_SCAN_RUNNING;
  bool asyncScan = false, autoReconnect = true;
  void mode(int) {}
  void persistent(bool) {}
  void setAutoReconnect(bool value) { autoReconnect = value; }
  void onEvent(Callback cb, arduino_event_id_t) { callback = cb; }
  wl_status_t begin(const char *ssid, const char *) { ++connectCalls; attempted = ssid; link = WL_IDLE_STATUS; return link; }
  void disconnect(bool = false, bool = false) { ++disconnectCalls; link = WL_DISCONNECTED; current.clear(); }
  wl_status_t status() const { return link; }
  String SSID() const { return current; }
  int32_t RSSI() const { return -45; }
  TestAddress localIP() const { return {}; }
  int16_t scanNetworks(bool async, bool, bool, uint32_t) { ++scanCalls; asyncScan = async; return WIFI_SCAN_RUNNING; }
  int16_t scanComplete() const { return scanResult; }
  void scanDelete() { ++scanDeletes; results.clear(); scanResult = WIFI_SCAN_RUNNING; }
  String SSID(uint8_t i) const { return results[i].ssid; }
  int32_t RSSI(uint8_t i) const { return results[i].signal; }
  int encryptionType(uint8_t i) const { return results[i].secure ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN; }
  void connect() { current = attempted; link = WL_CONNECTED; }
  void failure(uint8_t reason) {
    arduino_event_info_t event;
    event.wifi_sta_disconnected.reason = reason;
    event.wifi_sta_disconnected.ssid_len = static_cast<uint8_t>(attempted.size());
    std::memcpy(event.wifi_sta_disconnected.ssid, attempted.data(), attempted.size());
    link = WL_DISCONNECTED;
    if (callback) callback(ARDUINO_EVENT_WIFI_STA_DISCONNECTED, event);
  }
};
inline TestWifi WiFi;
