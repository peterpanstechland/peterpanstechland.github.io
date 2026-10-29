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
State fixture;
unsigned calibrationSaves = 0;
unsigned lightSaves=0;
robo::AutoLightSettings savedLight;
robo::CalibrationEdit savedEdit;
State snapshot() { return fixture; }
bool fresh(const State &s, uint32_t) { return s.received && s.wifi; }
bool submit(Action, bool, const PrintReceipt*, uint16_t) { throw std::runtime_error("Calibration UI must never actuate hardware"); }
bool submitCalibration(const robo::CalibrationEdit& edit) { ++calibrationSaves; savedEdit = edit; fixture.calibrationWrite = CalibrationWrite::Queued; return true; }
bool submitAutoLight(const robo::AutoLightSettings& settings) { ++lightSaves;savedLight=settings;fixture.autoLightWrite=CalibrationWrite::Queued;return true; }
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
    settings_ui::open(); tap(100, 420); tap(350, 355); render();
    require(std::string(settings_ui::title()) == "传感器校准", "Calibration entry");
    tap(200, 170); render(); tap(200, 250); render();
    require(!settings_ui::calibrationCapture.active() && planter::calibrationSaves == 0, "Offline capture must not start");
    planter::fixture.received = planter::fixture.wifi = planter::fixture.calibrationKnown = planter::fixture.calibrationWritable = planter::fixture.pumpKnown = true;
    planter::fixture.ageKnown = planter::fixture.soilAgeKnown = true;
    planter::fixture.soilRaw = {3000, true};
    planter::fixture.soilAgeMs = 3100; tap(200, 250); render();
    require(!settings_ui::calibrationCapture.active() && settings_ui::calibrationDraft.dry == -1, "Relayed soil age must reject stale capture");
    planter::fixture.soilAgeMs = 0;
    tap(200, 250);
    for (unsigned i = 0; i < 5; ++i) { now += 1000; planter::fixture.receivedMs = now; render(); }
    require(settings_ui::calibrationDraft.dry == 3000 && planter::calibrationSaves == 0, "Capturing does not save");
    tap(100, 425); require(planter::calibrationSaves == 0, "Cannot save missing wet point");
    planter::fixture.soilRaw.value = 1500; tap(200, 305);
    for (unsigned i = 0; i < 5; ++i) { now += 1000; planter::fixture.receivedMs = now; render(); }
    tap(100, 425); require(planter::calibrationSaves == 1 && planter::savedEdit.a == 3000 && planter::savedEdit.b == 1500, "Explicit save submits captured endpoints");
    tap(100, 425); require(planter::calibrationSaves == 1, "Double tap cannot duplicate pending write");
    planter::fixture.calibrationWrite = planter::CalibrationWrite::Saved;
    planter::fixture.calibration.revision = 1; planter::fixture.calibration.dry = 3000; planter::fixture.calibration.wet = 1500;
    render(); require(!settings_ui::calibrationDirty && !settings_ui::calibrationWaiting, "Readback confirms save");
    tap(350, 425); require(std::string(settings_ui::title()) == "清除校准", "Reset confirmation");
    require(planter::calibrationSaves == 1, "Reset must need confirmation");
    tap(350, 425); require(planter::calibrationSaves == 1, "Cancel reset does not write");
    tap(350, 425); tap(100, 425);
    require(planter::calibrationSaves == 2 && planter::savedEdit.reset && planter::savedEdit.kind == robo::CalibrationKind::Soil, "Reset only selected group");
    planter::fixture.calibrationWrite = planter::CalibrationWrite::Idle;
    settings_ui::back(); tap(200, 300); planter::fixture.tankDistance = {145, true}; render();
    tap(200, 250); now += 1000; planter::fixture.receivedMs = now; render();
    planter::fixture.tankDistance.value = 160; now += 1000; planter::fixture.receivedMs = now; render();
    require(!settings_ui::calibrationCapture.active() && settings_ui::calibrationDraft.tank.fullMm == -1, "Unstable tank echo rejected");
    settings_ui::open();tap(350,215);render();
    require(std::string(settings_ui::title())=="自动灯光","Light settings entry");
    tap(100,170);tap(200,430);require(planter::lightSaves==0,"Unavailable auto light cannot save");
    planter::fixture.autoLightKnown=planter::fixture.autoLightAvailable=planter::fixture.autoLightWritable=true;
    planter::fixture.ambientLightEnabled=true;planter::fixture.ambientLightRaw={2200,true};planter::fixture.receivedMs=now;
    render();tap(100,170);tap(200,430);require(planter::lightSaves==1&&planter::savedLight.enabled,"Mode change saved explicitly");
    tap(200,430);require(planter::lightSaves==1,"No double save while pending");
    planter::fixture.autoLight=planter::savedLight;++planter::fixture.autoLight.revision;planter::fixture.autoLightWrite=planter::CalibrationWrite::Saved;render();
    require(!settings_ui::lightDirty&&!settings_ui::lightWaiting,"Settings readback confirmed");
    tap(200,260);require(settings_ui::lightDraft.onBelow==2200,"Capture current light ADC");
    tap(200,430);require(planter::lightSaves==1,"Invalid threshold gap blocks save");
    tap(430,350);require(settings_ui::lightDraft.offAbove==1900,"Increase off threshold");
    settings_ui::back();tap(350,215);render();require(settings_ui::lightDraft.onBelow==1200,"Unsaved edits discarded");
    planter::fixture.autoLightPaused=true;tap(200,430);require(planter::lightSaves==2,"Explicit save resumes manual override");
    planter::fixture.autoLightWrite=planter::CalibrationWrite::Idle;
    if (argc > 1) {
      const std::filesystem::path output(argv[1]); std::filesystem::create_directories(output);
      for (unsigned lang = 0; lang < 2; ++lang) {
        language = lang ? device_settings::Language::English : device_settings::Language::Chinese;
        const std::string prefix = lang ? "en-" : "zh-";
        networks(); settings_ui::open(); frame(output, (prefix + "settings").c_str());
        planter::fixture.receivedMs=now;tap(350,215);frame(output,(prefix+"auto-light").c_str());settings_ui::back();
        tap(100, 420); frame(output, (prefix + "planter").c_str());
        planter::fixture.receivedMs = now;
        tap(350, 355); frame(output, (prefix + "calibration").c_str());
        tap(200, 170); frame(output, (prefix + "soil-calibration").c_str());
        tap(350, 425); frame(output, (prefix + "reset-calibration").c_str());
        settings_ui::back(); settings_ui::back(); tap(200, 300); frame(output, (prefix + "tank-calibration").c_str());
        settings_ui::back(); settings_ui::back();
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
