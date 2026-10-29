// Compile the production UI translation unit without editing it or its artwork.
// Hardware/network definitions below are disconnected host-only boundaries.
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <vector>
#include "../../firmware/indicator/src/main.cpp"
// A unity translation unit also matches the library's common _data16 variable
// declaration without changing its source or relaxing linker diagnostics.
#include "../../firmware/indicator/src/ui_theme.cpp"
#include "../../firmware/indicator/src/ui_text.cpp"
#include "../../firmware/indicator/src/ui_photos.cpp"
#include "../../firmware/indicator/src/settings_ui.cpp"
#include "../../firmware/indicator/src/garden_art.cpp"
#include "../../firmware/indicator/src/garden_ui.cpp"
#include <Arduino_G.cpp>
#include <Arduino_GFX.cpp>
#include <canvas/Arduino_Canvas.cpp>

// Sample-only settings backend. No production Wi-Fi, OS, or NVS code is linked.
// The only network name used by capture fixtures is the literal "example".
namespace host_fixture {
device_settings::Language language = device_settings::Language::Chinese;
device_settings::WifiSnapshot wifi;
uint8_t savedBrightness = 80, appliedBrightness = 100;
unsigned scans = 0;
garden::Model gardenModel;
std::string gardenFixture = "new_virtual_game";
void resetWifi() {
  wifi = device_settings::WifiSnapshot();
  wifi.ready = wifi.persistenceAvailable = true;
}
}

// Real game rules, RAM-only storage. Rendering never reads or changes device NVS.
namespace garden_store {
bool begin(uint32_t now) { host_fixture::gardenModel.begin(now); return true; }
garden::Model &model() { return host_fixture::gardenModel; }
void service(uint32_t now) { host_fixture::gardenModel.tick(now); }
bool available() { return true; }
}

// Native render fixtures never initialise the physical internal UART.
namespace local_soil {
bool begin() { return true; }
Sample snapshot() { return Sample(); }
bool notifyFocusComplete() { return true; }
}

namespace {
Arduino_Canvas hostCanvas(480, 480, nullptr);
planter::State hostState; // Deliberately unknown: no sensor or actuator fixtures.
unsigned presentCount = 0;
unsigned displayAccessCount = 0;
bool failNextPresent = false;
bool interactionChecks = false;
std::vector<planter::Action> submitted;
std::vector<std::string> submittedReceipts;
unsigned checked = 0;
unsigned artStabilityChecks = 0;
unsigned displayFailureChecks = 0;
}
namespace indicator {
bool begin() { return hostCanvas.begin(GFX_SKIP_OUTPUT_BEGIN); }
Arduino_GFX &display() { ++displayAccessCount; return hostCanvas; }
bool present() {
  ++presentCount;
  if (failNextPresent) { failNextPresent = false; return false; }
  return true;
}
void setBrightness(uint8_t value) { host_fixture::appliedBrightness = constrain(value, 5, 100); }
uint8_t brightness() { return host_fixture::appliedBrightness; }
bool touchReady() { return true; }
TouchStatus readTouchStatus(int16_t &, int16_t &) { return TouchStatus::Up; }
bool readTouch(int16_t &, int16_t &) { return false; }
}
namespace device_settings {
bool begin() { host_fixture::resetWifi(); return true; }
Language getLanguage() { return host_fixture::language; }
bool setLanguage(Language value) { host_fixture::language = value; return true; }
uint8_t getBrightness() { return host_fixture::savedBrightness; }
bool saveBrightness(uint8_t value) { host_fixture::savedBrightness = constrain(value, 5, 100); return true; }
WifiSnapshot wifiState() { return host_fixture::wifi; }
bool requestScan() { ++host_fixture::scans; host_fixture::wifi.scanning = true; return true; }
bool requestConnect(const char *, const char *) {
  throw std::runtime_error("Capture must not request a connection, even through the mock");
}
bool restoreDefaultWifi() { host_fixture::resetWifi(); return true; }
PlanterEndpoint planterEndpoint() {
  PlanterEndpoint value;value.configured=true;
  strcpy(value.ssid,"example");strcpy(value.address,"http://192.0.2.1");return value;
}
void service() { throw std::runtime_error("The native renderer must not run a network worker"); }
uint32_t networkRevision() { return 0; }
bool planterNetworkReady() { return false; }
}
namespace planter {
bool begin() { return true; }
State snapshot() { return hostState; }
bool fresh(const State &state, uint32_t now) {
  // Same boundary contract as planter_client.cpp; no transport is linked.
  return state.received && state.wifi && state.ageKnown && state.networkFailure == NetworkFailure::None &&
      static_cast<uint64_t>(now - state.receivedMs) + state.sampleAgeMs <= kStaleMs;
}
bool submit(Action action, bool, const PrintReceipt *receipt, uint16_t) {
  if (!interactionChecks) throw std::runtime_error("Rendering must never submit a hardware action");
  submitted.push_back(action);
  if (receipt) submittedReceipts.push_back(receipt->text);
  return true;
}
void acknowledgeUncertain() { throw std::runtime_error("Rendering must not modify command state"); }
}
namespace {
struct Capture {
  std::string name, kind, page;
  unsigned theme, time;
  std::string language = "zh", fixture = "none";
  std::string gardenFixture;
};
std::vector<Capture> captures;
void writeFrame(const std::filesystem::path &output, Capture capture) {
  capture.language = device_settings::getLanguage() == device_settings::Language::English ? "en" : "zh";
  capture.gardenFixture = host_fixture::gardenFixture;
  if (host_fixture::wifi.networkCount) capture.fixture = "sample_network_example";
  renderNow = capture.time;
  draw(hostState, capture.time);
  const uint16_t *pixels = hostCanvas.getFramebuffer();
  std::ofstream image(output / (capture.name + ".ppm"), std::ios::binary);
  if (!image) throw std::runtime_error("Unable to open image output");
  image << "P6\n480 480\n255\n";
  for (size_t i = 0; i < 480U * 480; ++i) {
    const uint16_t c = pixels[i];
    const uint8_t r = static_cast<uint8_t>((c >> 11) & 31);
    const uint8_t g = static_cast<uint8_t>((c >> 5) & 63);
    const uint8_t b = static_cast<uint8_t>(c & 31);
    const char rgb[3] = {static_cast<char>((r << 3) | (r >> 2)),
                         static_cast<char>((g << 2) | (g >> 4)),
                         static_cast<char>((b << 3) | (b >> 2))};
    image.write(rgb, 3);
  }
  if (!image) throw std::runtime_error("Image output failed");
  captures.push_back(capture);
}
void resetPage(uint8_t themeId, uint8_t page) {
  settings_ui::close();
  garden_ui::close();
  host_fixture::resetWifi();
  host_fixture::gardenModel = garden::Model();
  host_fixture::gardenModel.begin(0);
  host_fixture::gardenFixture = "new_virtual_game";
  model = ui::Model();
  model.selectTheme(themeId);
  controlsOpen = false;
  confirmOpen = false;
  for (uint8_t i = 0; i < page; ++i) model.nextPage();
}
void require(bool value, const char *message) {
  if (!value) throw std::runtime_error(message);
  ++checked;
}
void tapRect(const Rect &rect, const State &state, uint32_t now) {
  const int16_t x = rect.x + rect.w / 2, y = rect.y + rect.h / 2;
  handle(touch.update(ui::TouchInput::Down, x, y, now), state, now);
  handle(touch.update(ui::TouchInput::Up, 0, 0, now + 20), state, now + 20);
}
void focusRewardTests() {
  interactionChecks = true;
  resetPage(0, 4); touch = ui::TouchGate(); submitted.clear();
  model.timer().start(1000);
  garden_store::service(1500999);
  const auto before = garden_store::model().current().xp;
  tickCompanion(1500999);
  require(garden_store::model().current().xp == before,
          "An unfinished focus session cannot grant a game reward");
  garden_store::service(1501000);
  const auto beforeFinish = garden_store::model().current().xp;
  tickCompanion(1501000);
  const auto awarded = garden_store::model().current().xp;
  require(model.timer().done() && awarded > beforeFinish,
          "Finishing the real 25-minute timer must reward the virtual plant");
  tickCompanion(1501000); tickCompanion(1501001);
  require(garden_store::model().current().xp == awarded && submitted.empty(),
          "A completed timer grants only one virtual reward and no actuator command");

  for (auto preset : {ui::Preset::ShortBreak5, ui::Preset::LongBreak15}) {
    resetPage(0, 4); model.timer().selectPreset(preset); model.timer().start(1000);
    const auto doneAt = 1000 + model.timer().durationMs();
    garden_store::service(doneAt);
    const auto breakXp = garden_store::model().current().xp;
    tickCompanion(doneAt);
    require(model.timer().done() && garden_store::model().current().xp == breakXp,
            "A break timer must not count as a completed focus session");
  }
  resetPage(0, 4); touch = ui::TouchGate(); model.timer().start(1000);
  garden_store::service(1500980);
  const auto edgeXp = garden_store::model().current().xp;
  tapRect(kTimerReset, hostState, 1500980);
  require(model.timer().phase() == ui::TimerPhase::Ready && garden_store::model().current().xp > edgeXp,
          "A reset released at the deadline cannot swallow a completed focus reward");
  require(submitted.empty(), "Focus rewards must not submit any hardware action");
  interactionChecks = false;
}
void gardenInteractionTests() {
  constexpr Rect homeCare{24,380,278,48}, homeSpecies{320,76,136,44}, homeMood{316,380,140,48};
  constexpr Rect water{24,228,210,70}, feed{246,228,210,70}, weed{24,310,210,70}, comfort{246,310,210,70};
  constexpr Rect secondTile{246,132,210,126}, firstTile{24,132,210,126}, fourthTile{246,270,210,126};
  interactionChecks = true;
  resetPage(0, 0); touch = ui::TouchGate(); submitted.clear();
  tapRect(homeCare, hostState, 1000);
  require(garden_ui::isOpen() && model.page() == ui::Page::Face && submitted.empty(),
          "The home care button must open the virtual garden without navigating or acting on hardware");
  const auto seedXp = garden_store::model().current().xp;
  tapRect(feed, hostState, 1100);
  require(garden_store::model().current().xp == seedXp,
          "The seed-stage feeding control must match its wait-for-sprout label");
  tapRect(water, hostState, 1200);
  const auto wateredXp = garden_store::model().current().xp;
  require(wateredXp == seedXp + 8 && submitted.empty(),
          "Game watering must add virtual growth without sending a pump request");
  tapRect(water, hostState, 1300);
  require(garden_store::model().current().xp == wateredXp && submitted.empty(),
          "Repeated water taps during cooldown must not farm growth or send a command");
  tapRect(comfort, hostState, 1400);
  require(garden_store::model().current().xp == wateredXp + 2 && submitted.empty(),
          "Comfort must affect only the virtual companion");
  auto saved = garden_store::model().snapshot();
  saved.plants[0].weeds = 22;
  require(garden_store::model().restore(saved, 1500), "Care test fixture must restore");
  tapRect(weed, hostState, 1500);
  require(garden_store::model().current().weeds == 0 && submitted.empty(),
          "Weeding must clear virtual weeds without a hardware request");
  const auto afterCare = garden_store::model().current().xp;
  handle(touch.update(ui::TouchInput::Down, 400, 250, 1600), hostState, 1600);
  handle(touch.update(ui::TouchInput::Down, 100, 250, 1650), hostState, 1650);
  handle(touch.update(ui::TouchInput::Up, 0, 0, 1680), hostState, 1680);
  require(garden_ui::isOpen() && model.page() == ui::Page::Face && garden_store::model().current().xp == afterCare,
          "A swipe on the garden overlay cannot navigate its hidden page or apply care");
  handle(touch.update(ui::TouchInput::Down, 100, 260, 1700), hostState, 1700);
  handle(touch.update(ui::TouchInput::Invalid, 0, 0, 1720), hostState, 1720);
  handle(touch.update(ui::TouchInput::Up, 0, 0, 1740), hostState, 1740);
  require(garden_store::model().current().xp == afterCare && submitted.empty(),
          "Invalid touch must not become a game action");
  tapRect(kBack, hostState, 1800);
  require(!garden_ui::isOpen() && model.page() == ui::Page::Face,
          "Back from a garden overlay returns to the companion home");
  tapRect(homeSpecies, hostState, 1900); tapRect(secondTile, hostState, 2000);
  require(!garden_ui::isOpen() && garden_store::model().selected() == garden::Species::Basil &&
          garden_store::model().current().xp == 0,
          "Selecting basil opens its independent seed progress");
  tapRect(homeSpecies, hostState, 2100); tapRect(firstTile, hostState, 2200);
  require(garden_store::model().selected() == garden::Species::Mint && garden_store::model().current().xp == afterCare,
          "Returning to mint must preserve its existing care progress");
  tapRect(homeMood, hostState, 2300); tapRect(fourthTile, hostState, 2400);
  require(!garden_ui::isOpen() && garden_store::model().atmosphere() == garden::Atmosphere::Happy && submitted.empty(),
          "Desk mood selection must persist in the local model without sending a light or pump action");
  tapRect(homeCare, hostState, 2500); tapRect(kSettings, hostState, 2600);
  require(!garden_ui::isOpen() && settings_ui::isOpen() && submitted.empty(),
          "Opening settings must close the garden overlay");
  settings_ui::close(); tapRect(homeCare, hostState, 2700); tapRect(kTheme, hostState, 2800);
  require(!garden_ui::isOpen() && model.themesOpen() && submitted.empty(),
          "Opening themes must close the garden overlay");
  resetPage(0, 1); controlsOpen = confirmOpen = true; garden_ui::openCare(); touch = ui::TouchGate();
  State available; available.received = available.wifi = available.ageKnown = true;
  available.receivedMs = 1000; available.pumpEnabled = available.printerEnabled = true;
  available.waterAllowed = true;
  tapRect(kConfirmGo, available, 1100); tapRect(kHardware[1], available, 1200);
  require(garden_ui::isOpen() && submitted.empty(),
          "A garden overlay must isolate hidden confirmation and direct STOP hitboxes");
  resetPage(0, 0); touch = ui::TouchGate();
  interactionChecks = false;
}
std::vector<uint16_t> plantBodyPixels(uint8_t species, uint8_t stage, uint32_t now) {
  hostCanvas.fillScreen(ui_theme::get(0).background);
  garden_art::draw(hostCanvas, 0, species, stage, 240, 240, 96, 86, 78, 0, now);
  const auto *pixels = hostCanvas.getFramebuffer();
  std::vector<uint16_t> body;
  // Fixed central plant-and-pot region, excluding peripheral decorative sparks
  // and the herb seed particles. Non-blink frames should not move this body.
  for (int y = 165; y < 321; ++y)
    for (int x = 204; x < 276; ++x) body.push_back(pixels[y * 480 + x]);
  return body;
}
void artStabilityTests() {
  const uint32_t times[] = {1100, 2000, 3200, 4800};
  for (uint8_t species = 0; species < 4; ++species) for (uint8_t stage = 0; stage < 5; ++stage) {
    const auto anchored = plantBodyPixels(species, stage, 500);
    for (const auto time : times) {
      if (plantBodyPixels(species, stage, time) != anchored)
        throw std::runtime_error("Plant body must stay anchored between non-blink animation frames");
      ++artStabilityChecks;
    }
  }
  const auto closed = plantBodyPixels(0, 0, 0);
  const auto open = plantBodyPixels(0, 0, 300);
  if (closed == open) throw std::runtime_error("The seed blink must visibly close and reopen its eyes");
  ++artStabilityChecks;
  if (plantBodyPixels(0, 0, 200) != closed)
    throw std::runtime_error("Blink must remain visible for multiple nominal 100 ms frames");
  ++artStabilityChecks;
  if (plantBodyPixels(0, 0, 350) != open)
    throw std::runtime_error("A second short blink must not interrupt the reopened eyes");
  ++artStabilityChecks;
  if (plantBodyPixels(0, 0, 5300) != closed)
    throw std::runtime_error("The next blink cycle must keep the same fixed character anchor");
  ++artStabilityChecks;
  std::cout << "PASS: " << artStabilityChecks << " fixed-anchor and visible-blink pixel assertions.\n";
}
void displayFailureTests() {
  auto check = [](bool value, const char *message) {
    if (!value) throw std::runtime_error(message);
    ++displayFailureChecks;
  };
  resetPage(0, 0); touch = ui::TouchGate(); renderNow = 1000;
  const auto beforePresent = presentCount;
  const auto beforeMessage = Serial.lineCount;
  failNextPresent = true;
  // Invoke the production loop, including its first-frame draw and failure path.
  // The host boundary refuses exactly this one frame handoff.
  loop();
  check(presentCount == beforePresent + 1 && !failNextPresent && !displayReady,
        "A failed frame handoff must disable rendering in the production loop");
  check(Serial.lineCount == beforeMessage + 1 && Serial.lastLine.find("handoff failed") != std::string::npos,
        "The failed handoff must emit a clear diagnostic once");
  const auto stoppedPresent = presentCount, stoppedAccess = displayAccessCount;
  const auto stoppedMessage = Serial.lineCount;
  const auto stoppedTime = renderNow;
  const auto *pixels = hostCanvas.getFramebuffer();
  const std::vector<uint16_t> stoppedFrame(pixels, pixels + 480U * 480U);
  for (unsigned i = 0; i < 3; ++i) loop();
  check(!displayReady && presentCount == stoppedPresent,
        "Subsequent loop calls cannot retry a failed frame handoff");
  check(displayAccessCount == stoppedAccess,
        "Subsequent loop calls cannot obtain or draw into the display framebuffer");
  check(std::equal(stoppedFrame.begin(), stoppedFrame.end(), hostCanvas.getFramebuffer()),
        "The last framebuffer must remain unchanged after a failed handoff");
  check(renderNow > stoppedTime && Serial.lineCount == stoppedMessage,
        "The stopped loop must yield time without repeatedly logging the same failure");
  // Test teardown only. Production intentionally requires a restart to recover.
  displayReady = true; failNextPresent = false;
  resetPage(0, 0); renderNow = 0;
  std::cout << "PASS: " << displayFailureChecks << " production-loop frame-handoff failure assertions.\n";
}
void interactionTests() {
  interactionChecks = true;
  State available;
  // Test-only connectivity/capability flags, never sensor readings or screenshots.
  available.received = available.wifi = available.ageKnown = true;
  available.receivedMs = 1000;
  available.pumpEnabled = available.printerEnabled = true;
  available.waterAllowed = true;
  for (unsigned button : {0U, 3U}) {
    resetPage(0, 1); controlsOpen = true; touch = ui::TouchGate(); submitted.clear();
    tapRect(kHardware[button], available, 1100);
    require(confirmOpen && submitted.empty(), "First water/print tap must only open confirmation");
    tapRect(kConfirmGo, available, 1200);
    require(!confirmOpen && submitted.size() == 1 && submitted[0] == kActions[button],
            "Second tap must submit the selected command exactly once");
    tapRect(kConfirmGo, available, 1300);
    require(submitted.size() == 1, "A further tap outside an action cannot resubmit");
  }
  available.printerRaster = available.printerLayout32 = true;
  device_settings::setLanguage(device_settings::Language::Chinese);
  resetPage(0, 1); controlsOpen = true; touch = ui::TouchGate(); submitted.clear(); submittedReceipts.clear();
  tapRect(kHardware[3], available, 1100);
  const std::string preview = confirmReceipt.text;
  require(confirmReceipt.requiresRaster && preview.find("工位盆栽") == 0, "Chinese raster preview must use Chinese text");
  device_settings::setLanguage(device_settings::Language::English);
  tapRect(kConfirmGo, available, 1200);
  require(submittedReceipts.size() == 1 && submittedReceipts[0] == preview, "Changing language after preview must not change approved receipt bytes");
  available.printerDaily=true;
  resetPage(0,1);controlsOpen=true;touch=ui::TouchGate();submitted.clear();
  tapRect(kHardware[3],available,1400);
  const auto approvedDaily=confirmReceipt.daily;
  require(confirmReceipt.isDaily&&dailyPreviewPage==0,"Daily preview starts on the logo without sending");
  handle(ui::Gesture::SwipeLeft,available,1450);
  require(confirmOpen&&dailyPreviewPage==1&&submitted.empty(),"Daily swipe browses instead of printing or closing");
  for(int i=0;i<20;++i)handle(ui::Gesture::SwipeLeft,available,1500+i);
  require(dailyPreviewPage==receipt_preview::DailyPreviewPages-1,"Daily preview stops at last viewport");
  for(int i=0;i<20;++i)handle(ui::Gesture::SwipeRight,available,1550+i);
  require(dailyPreviewPage==0&&robo::sameDaily(approvedDaily,confirmReceipt.daily),"Browsing cannot redraw the card or snapshot");
  tapRect(kConfirmCancel,available,1600);
  require(!confirmOpen&&submitted.empty(),"Cancelling a daily ticket never prints");
  available.printerDaily=false;
  strcpy(available.printerStatus, "recovery_required");
  require(!enabled(planter::Action::Print, available, 1200), "Printer recovery must block another receipt");
  available.printerStatus[0] = 0;
  device_settings::setLanguage(device_settings::Language::Chinese);
  resetPage(0, 1); controlsOpen = true; touch = ui::TouchGate(); submitted.clear();
  tapRect(kHardware[0], available, 1100);
  handle(touch.update(ui::TouchInput::Down, 350, 220, 1200), available, 1200);
  handle(touch.update(ui::TouchInput::Down, 120, 220, 1250), available, 1250);
  handle(touch.update(ui::TouchInput::Up, 0, 0, 1280), available, 1280);
  require(!confirmOpen && controlsOpen && submitted.empty(), "Swipe must cancel confirmation without sending");
  tapRect(kHardware[0], available, 1400);
  tapRect(kConfirmGo, available, 7000);
  require(confirmOpen && submitted.empty(), "State expiring on confirmation must block the send");
  tapRect(kConfirmCancel, available, 7100);
  require(!confirmOpen && submitted.empty(), "Cancel must never send");
  available.commandBlocked = available.uncertain = true;
  tapRect(kHardware[1], available, 7200);
  require(submitted.size() == 1 && submitted[0] == planter::Action::StopWater && !confirmOpen,
          "STOP must remain direct through stale/unknown-command lock when connected and enabled");
  submitted.clear(); resetPage(0, 1); controlsOpen = true;
  tapRect(kHardware[0], State(), 7300);
  tapRect(kHardware[3], State(), 7400);
  require(!confirmOpen && submitted.empty(), "Unknown disconnected capabilities must block water/print");

  // Exercise the production main dispatcher, not a copy of settings routing.
  available.commandBlocked = available.uncertain = false;
  resetPage(0, 1); controlsOpen = confirmOpen = true; touch = ui::TouchGate();
  confirmAction = planter::Action::Water;
  tapRect(kSettings, available, 1100);
  require(settings_ui::isOpen() && !controlsOpen && !confirmOpen && submitted.empty(),
          "Opening settings must close both action layers without submitting");
  // A stale underlying modal must still be unreachable behind settings.
  controlsOpen = confirmOpen = true;
  tapRect(kConfirmGo, available, 1200);
  require(settings_ui::isOpen() && submitted.empty(), "Settings must swallow a tap over the hidden confirmation button");
  settings_ui::open(); confirmOpen = false;
  tapRect(kHardware[1], available, 1300);
  require(submitted.empty(), "Settings must swallow a tap over the hidden direct STOP button");
  const auto oldPage = model.page();
  handle(touch.update(ui::TouchInput::Down, 400, 250, 1400), available, 1400);
  handle(touch.update(ui::TouchInput::Down, 100, 250, 1450), available, 1450);
  handle(touch.update(ui::TouchInput::Up, 0, 0, 1480), available, 1480);
  require(settings_ui::isOpen() && model.page() == oldPage && submitted.empty(),
          "A settings swipe cannot navigate the hidden page or submit an action");
  settings_ui::open();
  tapRect({248, 117, 208, 48}, available, 1500);
  require(device_settings::getLanguage() == device_settings::Language::English && submitted.empty(),
          "Changing language must work through main without reaching hardware actions");
  handle(touch.update(ui::TouchInput::Down, 100, 140, 1600), available, 1600);
  handle(touch.update(ui::TouchInput::Invalid, 0, 0, 1620), available, 1620);
  handle(touch.update(ui::TouchInput::Up, 0, 0, 1640), available, 1640);
  require(device_settings::getLanguage() == device_settings::Language::English && submitted.empty(),
          "Invalid touch cannot become a language tap or underlying action");
  resetPage(0, 0); touch = ui::TouchGate(); device_settings::setLanguage(device_settings::Language::Chinese);
  indicator::setBrightness(80); device_settings::saveBrightness(80);
  interactionChecks = false;
}

void captureScreens(const std::filesystem::path &output, uint8_t themeId, const std::string &prefix) {
  const char *pages[] = {"face", "today", "info", "photos", "focus"};
  for (uint8_t page = 0; page < 5; ++page) {
    resetPage(themeId, page);
    writeFrame(output, {prefix + pages[page], "screen", pages[page], themeId, 1000});
  }
  resetPage(themeId, 0); model.openThemes();
  writeFrame(output, {prefix + "themes", "screen", "themes", themeId, 1000});
  resetPage(themeId, 1); controlsOpen = true;
  writeFrame(output, {prefix + "controls", "screen", "controls", themeId, 1000});
  confirmOpen = true; confirmAction = planter::Action::Water;
  writeFrame(output, {prefix + "confirm-water", "screen", "confirm-water", themeId, 1000});
  confirmAction = planter::Action::Print;
  confirmReceipt = planter_presentation::receipt(hostState, device_settings::getLanguage() == device_settings::Language::English);
  writeFrame(output, {prefix + "confirm-print", "screen", "confirm-print", themeId, 1000});
}

void captureSettings(const std::filesystem::path &output, const std::string &language) {
  const std::string prefix = language + "-settings-";
  resetPage(0, 0); touch = ui::TouchGate();
  settings_ui::open();
  writeFrame(output, {prefix + "menu", "screen", "settings-menu", 0, 1000});
  tapRect({16, 181, 448, 76}, hostState, 1100);
  // Complete the simulated scan with zero results. No real adapter was queried.
  host_fixture::wifi.scanning = false;
  writeFrame(output, {prefix + "wifi-empty", "screen", "settings-wifi-empty", 0, 1200});
  settings_ui::open();
  tapRect({16, 394, 216, 54}, hostState, 1250);
  writeFrame(output, {prefix + "planter", "screen", "settings-planter", 0, 1300});
  tapRect({24,332,432,60},hostState,1320);
  hostState.yoyoEnabled=true;hostState.yoyoPairing=true;hostState.yoyoPin=123456;
  hostState.autoPrintKnown=hostState.autoPrint=true;
  writeFrame(output,{prefix+"yoyo-pairing","screen","settings-yoyo",0,1330});
  hostState.yoyoPairing=false;hostState.yoyoPaired=hostState.yoyoConnected=true;
  writeFrame(output,{prefix+"yoyo-paired","screen","settings-yoyo",0,1340});
  hostState=State();
  settings_ui::open();
  tapRect({248, 394, 216, 54}, hostState, 1300);
  writeFrame(output, {prefix + "about", "screen", "settings-about", 0, 1400});
  settings_ui::open();
  host_fixture::wifi.networkCount = 1;
  std::strcpy(host_fixture::wifi.networks[0].ssid, "example");
  host_fixture::wifi.networks[0].secure = true;
  host_fixture::wifi.networks[0].rssi = -60;
  tapRect({16, 181, 448, 76}, hostState, 1500);
  writeFrame(output, {prefix + "wifi-sample", "screen", "settings-wifi-sample", 0, 1600});
  tapRect({16, 160, 448, 48}, hostState, 1700);
  writeFrame(output, {prefix + "keyboard", "screen", "settings-keyboard", 0, 1800});
  tapRect({134, 422, 102, 48}, hostState, 1900);
  writeFrame(output, {prefix + "keyboard-upper", "screen", "settings-keyboard-upper", 0, 2000});
  tapRect({244, 422, 102, 48}, hostState, 2100);
  writeFrame(output, {prefix + "keyboard-symbols", "screen", "settings-keyboard-symbols", 0, 2200});
  tapRect({244, 422, 102, 48}, hostState, 2300);
  writeFrame(output, {prefix + "keyboard-symbols-2", "screen", "settings-keyboard-symbols-2", 0, 2400});
  settings_ui::close();
}
void capturePrinter(const std::filesystem::path &output) {
  for (unsigned lang = 0; lang < 2; ++lang) {
    device_settings::setLanguage(lang ? device_settings::Language::English : device_settings::Language::Chinese);
    resetPage(0, 1); controlsOpen = confirmOpen = true; confirmAction = planter::Action::Print;
    hostState.received = hostState.wifi = hostState.ageKnown = true;
    hostState.receivedMs = 1000;
    hostState.printerKnown = hostState.printerEnabled = hostState.printerRaster = hostState.printerAutocut = true;
    hostState.printerLayout32 = true;
    host_fixture::wifi.ready = host_fixture::wifi.planterNetwork = true;
    host_fixture::wifi.phase = device_settings::WifiPhase::Connected;
    confirmReceipt = planter_presentation::receipt(hostState, lang != 0);
    writeFrame(output, {lang ? "en-printer-raster" : "zh-printer-raster", "screen", "confirm-print", 0, 1000, "zh", "sample_printer_capability_no_io"});
    hostState.printerDaily=true;
    confirmReceipt=planter_presentation::dailyReceipt(hostState,lang!=0,0,[]{return 95U;});
    for(dailyPreviewPage=0;dailyPreviewPage<receipt_preview::DailyPreviewPages;++dailyPreviewPage)
      writeFrame(output,{std::string(lang?"en-daily-":"zh-daily-")+std::to_string(dailyPreviewPage),"screen","confirm-daily",0,1000,"zh","sample_no_io"});
    confirmOpen = false;strcpy(hostState.printerStatus, "recovery_required");
    writeFrame(output, {lang ? "en-printer-recovery" : "zh-printer-recovery", "screen", "controls", 0, 1000, "zh", "sample_printer_capability_no_io"});
    hostState = State();host_fixture::resetWifi();
  }
}
const char *speciesNames[] = {"mint", "basil", "rose", "succulent"};
const char *stageNames[] = {"seed", "sprout", "leafy", "bloom", "mature"};
void gameFixture(uint8_t species, uint8_t stage, uint32_t now = 1000) {
  auto saved = garden_store::model().snapshot();
  saved.selected = static_cast<garden::Species>(species);
  auto &plant = saved.plants[species];
  plant.xp = garden::kStageXp[stage];
  plant.activeSeconds = garden::kStageMinutes[stage] * 60;
  plant.partialMs = 0;
  plant.health = 86; plant.moisture = 62; plant.nutrition = 55;
  plant.weeds = stage ? 12 : 0; plant.mood = 78;
  saved.totalActiveSeconds = plant.activeSeconds;
  require(garden_store::model().restore(saved, now), "Virtual stage fixture must be valid");
  require(static_cast<uint8_t>(garden_store::model().stage()) == stage,
          "Each growth capture must show the stage named by its fixture");
  host_fixture::gardenFixture = std::string("virtual_") + speciesNames[species] + "_" + stageNames[stage];
}
void captureGarden(const std::filesystem::path &output) {
  device_settings::setLanguage(device_settings::Language::Chinese);
  for (uint8_t species = 0; species < 4; ++species) for (uint8_t stage = 0; stage < 5; ++stage) {
    resetPage(0, 0); gameFixture(species, stage);
    const auto name = std::string("garden-") + speciesNames[species] + "-" + stageNames[stage];
    writeFrame(output, {name, "screen", "garden-stage", 0, 1000});
  }
  for (bool english : {false, true}) {
    device_settings::setLanguage(english ? device_settings::Language::English : device_settings::Language::Chinese);
    const std::string prefix = english ? "en-garden-" : "zh-garden-";
    resetPage(0, 0); gameFixture(2, 3); garden_ui::openCare();
    writeFrame(output, {prefix + "care", "screen", "garden-care", 0, 1000});
    tapRect({24,228,210,70}, hostState, 1100);
    writeFrame(output, {prefix + "care-watered", "screen", "garden-care-watered", 0, 1120});
    tapRect({24,228,210,70}, hostState, 1300);
    writeFrame(output, {prefix + "care-cooldown", "screen", "garden-care-cooldown", 0, 1320});
    garden_ui::close(); garden_ui::openSpecies();
    writeFrame(output, {prefix + "species", "screen", "garden-species", 0, 1000});
    garden_ui::close(); garden_ui::openMood();
    writeFrame(output, {prefix + "mood", "screen", "garden-mood", 0, 1000});
    garden_ui::close();
    for (uint8_t mood = 0; mood < 4; ++mood) {
      garden_store::model().setAtmosphere(static_cast<garden::Atmosphere>(mood));
      writeFrame(output, {prefix + "atmosphere-" + std::to_string(mood), "screen", "garden-atmosphere", 0, 1000});
    }
  }
  device_settings::setLanguage(device_settings::Language::Chinese);
}
}
int main(int argc, char **argv) {
  try {
    if (argc != 2) throw std::runtime_error("Usage: indicator_render OUTPUT_DIRECTORY");
    const std::filesystem::path output(argv[1]);
    std::filesystem::create_directories(output);
    setup();
    if (!displayReady) throw std::runtime_error("Host canvas allocation failed");
    interactionTests();
    focusRewardTests();
    gardenInteractionTests();
    displayFailureTests();
    artStabilityTests();
    const unsigned interactionCount = checked;
    std::cout << "PASS: " << interactionCount << " real dispatcher, touch, garden, and focus assertions.\n";
    for (uint8_t themeId = 0; themeId < ui_theme::kCount; ++themeId) {
      const std::string prefix = "theme-" + std::to_string(themeId) + "-";
      captureScreens(output, themeId, prefix);
      resetPage(themeId, 0);
      for (unsigned frame = 0; frame < 53; ++frame) {
        char number[8]; std::snprintf(number, sizeof(number), "%03u", frame);
        writeFrame(output, {prefix + "animation-" + number, "animation", "face", themeId, frame * 100});
      }
    }
    captureSettings(output, "zh");
    device_settings::setLanguage(device_settings::Language::English);
    captureScreens(output, 0, "en-theme-0-");
    captureSettings(output, "en");
    capturePrinter(output);
    for (bool english : {false, true}) {
      device_settings::setLanguage(english ? device_settings::Language::English : device_settings::Language::Chinese);
      resetPage(0, 2);
      hostState.received = hostState.wifi = hostState.ageKnown = true;
      hostState.receivedMs = 1000;
      hostState.ambientLightEnabled = true;
      hostState.ambientLightRaw = {2382, true};
      hostState.airRaw = {143, true};
      writeFrame(output, {english ? "en-ambient-info" : "zh-ambient-info", "screen", "info", 0, 1000, "zh", "sample_sensors_no_io"});
      hostState.sen54Enabled = hostState.tankEnabled = hostState.tankCalibrated = true;
      hostState.pm25 = {12.3f, true}; hostState.vocIndex = {105, true};
      hostState.tankDistance = {150, true}; hostState.tankLevel = {50, true};
      writeFrame(output, {english ? "en-sen54-info" : "zh-sen54-info", "screen", "info", 0, 1000, "zh", "sample_sensors_no_io"});
    }
    captureGarden(output);
    device_settings::setLanguage(device_settings::Language::Chinese);
    resetPage(0, 4); model.timer().start(1000);
    writeFrame(output, {"timer-running", "screen", "focus", 0, 61100});
    model.timer().pause(61100);
    writeFrame(output, {"timer-paused", "screen", "focus", 0, 62000});
    model.timer().reset(); model.timer().start(0); model.timer().tick(1500000);
    writeFrame(output, {"timer-completed", "screen", "focus", 0, 1500000});
    std::ofstream manifest(output / "captures.json");
    manifest << "{\"width\":480,\"height\":480,\"state\":\"disconnected_unknown\",\"interaction_assertions\":"
             << interactionCount << ",\"game_fixture_assertions\":" << checked - interactionCount
             << ",\"art_stability_assertions\":" << artStabilityChecks
             << ",\"display_failure_assertions\":" << displayFailureChecks
             << ",\"settings_backend\":\"host_sample_fixture_no_network\",\"game_backend\":\"production_model_ram_only_store\",\"frame_duration_ms\":100,\"captures\":[\n";
    for (size_t i = 0; i < captures.size(); ++i) {
      const auto &c = captures[i];
      if (i) manifest << ",\n";
      manifest << "{\"name\":\"" << c.name << "\",\"kind\":\"" << c.kind
               << "\",\"page\":\"" << c.page << "\",\"theme\":" << c.theme
               << ",\"time_ms\":" << c.time << ",\"language\":\"" << c.language
               << "\",\"fixture\":\"" << c.fixture
               << "\",\"game_fixture\":\"" << c.gardenFixture << "\"}";
    }
    manifest << "\n]}\n";
    std::cout << "Rendered " << captures.size() << " actual firmware frames at 480 x 480; no device I/O.\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n'; return 1;
  }
}
