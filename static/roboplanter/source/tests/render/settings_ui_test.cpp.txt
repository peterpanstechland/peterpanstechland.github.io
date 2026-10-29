// Isolated native settings UI: fixture networks only; no Wi-Fi or NVS driver.
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include "../../firmware/indicator/src/ui_text.cpp"
#include "../../firmware/indicator/src/ui_theme.cpp"
#include "../../firmware/indicator/src/settings_ui.cpp"
#include <Arduino_G.cpp>
#include <Arduino_GFX.cpp>
#include <canvas/Arduino_Canvas.cpp>

namespace {
Arduino_Canvas canvas(480, 480, nullptr);
device_settings::WifiSnapshot wifi;
device_settings::Language language = device_settings::Language::Chinese;
uint8_t light = 80;
unsigned checks = 0, brightnessWrites = 0, requests = 0, scans = 0, restores = 0;
std::string requestedSsid, requestedPassword;
ui::TouchGate gate;
uint32_t now = 100;
bool rejectJoin = false;
void require(bool value, const char *message) {
  if (!value) throw std::runtime_error(message);
  ++checks;
}
void tap(int x, int y) {
  settings_ui::handle(gate.update(ui::TouchInput::Down, x, y, now), gate, now);
  settings_ui::handle(gate.update(ui::TouchInput::Up, 0, 0, now + 80), gate, now + 80);
  now += 100;
}
void key(unsigned index) { tap(51 + index % 8 * 54, 250 + index / 8 * 48); }
void networks() {
  wifi = device_settings::WifiSnapshot(); wifi.ready = true; wifi.persistenceAvailable = true;
  wifi.networkCount = 6;
  for (unsigned i = 0; i < wifi.networkCount; ++i) {
    snprintf(wifi.networks[i].ssid, sizeof(wifi.networks[i].ssid), "Network-%u", i);
    wifi.networks[i].secure = true; wifi.networks[i].rssi = -45 - i * 5;
  }
  strcpy(wifi.networks[0].ssid, "窗边网络");
  strcpy(wifi.networks[1].ssid, "Cafe-open"); wifi.networks[1].secure = false;
}
void render() { settings_ui::draw(now, 0); }
void securePage() {
  settings_ui::open(); tap(200, 218); render(); tap(200, 184);
}
void frame(const std::filesystem::path &directory, const char *name) {
  canvas.fillScreen(ui_theme::get(0).background);
  ui_text::drawSized(canvas, 24, 22, settings_ui::title(), ui_theme::get(0).ink, 32);
  render();
  std::ofstream out(directory / (std::string(name) + ".ppm"), std::ios::binary);
  out << "P6\n480 480\n255\n";
  for (unsigned i = 0; i < 480 * 480; ++i) {
    const auto c = canvas.getFramebuffer()[i];
    const uint8_t r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31;
    const char rgb[] = {static_cast<char>((r << 3) | (r >> 2)), static_cast<char>((g << 2) | (g >> 4)),
                        static_cast<char>((b << 3) | (b >> 2))};
    out.write(rgb, 3);
  }
  require(bool(out), "Screenshot output failed");
}
}
namespace indicator {
Arduino_GFX &display() { return canvas; }
uint8_t brightness() { return light; }
void setBrightness(uint8_t value) { light = value < 5 ? 5 : value > 100 ? 100 : value; ++brightnessWrites; }
}
namespace device_settings {
PlanterEndpoint planterEndpoint() {
  PlanterEndpoint result; result.configured = true;
  strcpy(result.ssid, "example"); strcpy(result.address, "http://192.0.2.1"); return result;
}
Language getLanguage() { return language; }
bool setLanguage(Language value) { language = value; return true; }
uint8_t getBrightness() { return light; }
bool saveBrightness(uint8_t) { return true; }
WifiSnapshot wifiState() { return wifi; }
bool requestScan() { ++scans; wifi.scanning = true; wifi.networkCount = 0; return true; }
bool restoreDefaultWifi() { ++restores; return true; }
bool requestConnect(const char *ssid, const char *password) {
  ++requests; requestedSsid = ssid; requestedPassword = password;
  if (rejectJoin) { wifi.error = WifiError::Busy; return false; }
  wifi.phase = WifiPhase::Connecting; return true;
}
}
namespace planter {
State snapshot() { return State(); }
bool fresh(const State &, uint32_t) { return false; }
}
int main(int argc, char **argv) {
  try {
    require(canvas.begin(GFX_SKIP_OUTPUT_BEGIN), "Canvas initialization");
    networks(); settings_ui::open();
    canvas.fillScreen(0x1234); render();
    for (unsigned y = 0; y < 76; ++y)
      for (unsigned x = 0; x < 480; ++x)
        if (canvas.getFramebuffer()[y * 480 + x] != 0x1234) throw std::runtime_error("Settings painted over header");
    require(canvas.getFramebuffer()[479 * 480] == 0x1234, "Settings painted below y475");
    tap(350, 140); require(language == device_settings::Language::English, "English selection");
    require(std::string(settings_ui::title()) == "Settings", "English title");
    tap(100, 140); require(language == device_settings::Language::Chinese, "Chinese selection");
    settings_ui::handle(gate.update(ui::TouchInput::Down, 430, 350, now), gate, now);
    require(brightnessWrites == 0, "Brightness changed before release");
    settings_ui::handle(gate.update(ui::TouchInput::Up, 0, 0, now + 80), gate, now + 80); now += 100;
    require(light == 85 && brightnessWrites == 1, "Brightness release step");
    tap(96, 349); require(light == 5, "Minimum brightness");
    tap(383, 349); require(light == 100, "Maximum brightness");
    gate.update(ui::TouchInput::Down, 94, 349, now);
    gate.update(ui::TouchInput::Down, 98, 349, now + 20);
    settings_ui::handle(gate.update(ui::TouchInput::Up, 0, 0, now + 80), gate, now + 80); now += 100;
    require(light == 100, "Cross-boundary tap must not change brightness");
    require(settings_ui::handle(ui::Gesture::SwipeLeft, gate, now), "Settings gesture was not consumed");
    securePage();
    for (unsigned i = 0; i < 8; ++i) key(i);
    tap(290, 446); key(0); tap(290, 446); key(7);
    require(requests == 0, "Typing must not connect before Join");
    tap(405, 446);
    require(requests == 1 && requestedPassword == "abcdefgh0?", "ASCII/symbol keyboard or submit failed");
    require(requestedSsid == "窗边网络", "Chinese SSID bytes changed");
    securePage(); tap(405, 446); require(requests == 1, "Password survived submission");
    for (unsigned i = 0; i < 8; ++i) key(i);
    settings_ui::back(); tap(200, 184); tap(405, 446);
    require(requests == 1, "Password survived Back");
    for (unsigned i = 0; i < 8; ++i) key(i);
    settings_ui::close(); securePage(); tap(405, 446);
    require(requests == 1, "Password survived Close");
    for (unsigned i = 0; i < 65; ++i) key(0);
    tap(405, 446);
    require(requests == 2 && requestedPassword == std::string(64, 'a'), "64 hex or maximum length handling");
    securePage(); for (unsigned i = 0; i < 64; ++i) key(6); tap(405, 446);
    require(requests == 2, "64 non-hex password should be rejected");
    settings_ui::back(); tap(200, 234); tap(405, 446);
    require(requests == 3 && requestedPassword.empty() && requestedSsid == "Cafe-open", "Open-network join");
    tap(228, 446); tap(200, 184);
    for (unsigned i = 0; i < 8; ++i) key(i);
    tap(405, 446);
    require(requestedSsid == "Network-5", "Second network page selection");
    tap(50, 446); require(scans == 1, "Refresh did not request async scan");
    render(); tap(200, 184); require(std::string(settings_ui::title()) == "无线网络", "Scanning list was selectable");
    networks(); render(); tap(360, 446); require(restores == 1, "Default network restore");
    settings_ui::close();
    require(!settings_ui::handle(ui::Gesture::Tap, gate, now), "Closed settings consumed a main gesture");
    networks(); securePage(); for (unsigned i = 0; i < 8; ++i) key(i);
    rejectJoin = true; tap(405, 446);
    require(std::string(settings_ui::title()) == "连接网络", "Rejected join must keep the password page");
    rejectJoin = false; tap(405, 446);
    require(requestedPassword == "abcdefgh" && std::string(settings_ui::title()) == "无线网络",
            "Retry after Busy must retain input until the request is accepted");
    settings_ui::open(); tap(100, 420);
    require(std::string(settings_ui::title()) == "花盆连接", "Planter diagnostics must be reachable");
    render(); const auto beforeRestore = restores; tap(100, 437);
    require(restores == beforeRestore + 1 && std::string(settings_ui::title()) == "无线网络", "Diagnostics must restore only the paired network");
    if (argc > 1) {
      const std::filesystem::path output(argv[1]); std::filesystem::create_directories(output);
      for (unsigned lang = 0; lang < 2; ++lang) {
        language = lang ? device_settings::Language::English : device_settings::Language::Chinese;
        const std::string prefix = lang ? "en-" : "zh-";
        networks(); settings_ui::open(); frame(output, (prefix + "settings").c_str());
        tap(100, 420); frame(output, (prefix + "planter").c_str());
        settings_ui::back(); tap(350, 420); frame(output, (prefix + "about").c_str());
        settings_ui::back(); tap(200, 218); frame(output, (prefix + "wifi").c_str());
        tap(200, 184); for (unsigned i = 0; i < 8; ++i) key(i);
        frame(output, (prefix + "password").c_str());
        tap(290, 446); frame(output, (prefix + "symbols").c_str());
        settings_ui::back(); wifi.phase = device_settings::WifiPhase::Failed;
        wifi.error = device_settings::WifiError::AuthFailed; frame(output, (prefix + "failure").c_str());
      }
    }
    std::cout << "PASS: " << checks << " native settings checks (fixture networks; no I/O)\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "FAIL: " << error.what() << '\n'; return 1;
  }
}
