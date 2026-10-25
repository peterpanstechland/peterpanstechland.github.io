#include <cstdlib>
#include <iostream>
#include "../../firmware/indicator/include/ui_model.h"

namespace {
int checks = 0;
void expect(bool passed, const char* expression, int line) {
  ++checks;
  if (!passed) {
    std::cerr << "FAIL line " << line << ": " << expression << '\n';
    std::exit(1);
  }
}
#define CHECK(expression) expect((expression), #expression, __LINE__)

void releaseOnlyAndCancelledContacts() {
  ui::TouchGate touch;
  int activations = 0;
  auto dispatch = [&activations](ui::Gesture event) {
    if (event == ui::Gesture::Tap) ++activations;
  };
  dispatch(touch.update(ui::TouchInput::Down, 100, 300, 10));
  dispatch(touch.update(ui::TouchInput::Down, 104, 302, 20));
  CHECK(activations == 0);  // Holding a button never operates hardware.
  dispatch(touch.update(ui::TouchInput::Up, 0, 0, 30));
  CHECK(activations == 1);
  CHECK(touch.lastX() == 104 && touch.lastY() == 302);
  dispatch(touch.update(ui::TouchInput::Up, 0, 0, 40));
  CHECK(activations == 1);  // Repeated release samples do not repeat an action.

  dispatch(touch.update(ui::TouchInput::Down, 100, 300, 100));
  dispatch(touch.update(ui::TouchInput::Invalid, 0, 0, 110));
  CHECK(touch.blockedUntilUp());
  dispatch(touch.update(ui::TouchInput::Down, 100, 300, 120));
  CHECK(!touch.active());
  dispatch(touch.update(ui::TouchInput::Up, 0, 0, 130));
  CHECK(activations == 1);  // I2C fault / multiple fingers cannot synthesize tap.
  CHECK(!touch.blockedUntilUp());
  dispatch(touch.update(ui::TouchInput::Down, 100, 300, 140));
  dispatch(touch.update(ui::TouchInput::Up, 0, 0, 150));
  CHECK(activations == 2);  // A new clean contact is allowed after a real Up.

  touch.begin(100, 300, 200);
  touch.move(250, 300, 230);
  touch.move(100, 300, 250);
  dispatch(touch.release(100, 300, 280));
  CHECK(activations == 2);  // Dragging away and back must not activate a button.
  touch.begin(100, 300, 300);
  dispatch(touch.release(100, 300, 901));
  CHECK(activations == 2);  // No implicit action/home for a long press.
  touch.begin(20, 20, UINT32_MAX - 50);
  CHECK(touch.release(20, 20, 49) == ui::Gesture::Tap);
}

void gestureIntentAndPageBoundaries() {
  ui::TouchGate touch;
  touch.begin(200, 200, 0);
  CHECK(touch.release(141, 200, 100) == ui::Gesture::None);
  touch.begin(200, 200, 200);
  CHECK(touch.release(140, 210, 300) == ui::Gesture::SwipeLeft);
  touch.begin(200, 200, 400);
  CHECK(touch.release(260, 200, 500) == ui::Gesture::SwipeRight);
  touch.begin(200, 200, 600);
  CHECK(touch.release(260, 260, 700) == ui::Gesture::None);
  touch.begin(200, 200, 800);
  CHECK(touch.release(260, 300, 900) == ui::Gesture::None);

  ui::Model model;
  CHECK(model.page() == ui::Page::Face);
  CHECK(!model.previousPage());
  CHECK(!model.handleGesture(ui::Gesture::Tap));
  CHECK(model.tapFace());
  CHECK(model.page() == ui::Page::Today);
  CHECK(!model.tapFace());  // A repeated face handler cannot drill into a page.
  CHECK(model.handleGesture(ui::Gesture::SwipeLeft));
  CHECK(model.page() == ui::Page::Info);
  CHECK(model.nextPage());
  CHECK(model.page() == ui::Page::Photos);
  CHECK(model.nextPage());
  CHECK(model.page() == ui::Page::Focus);
  CHECK(!model.nextPage());
  CHECK(model.previousPage());
  CHECK(model.page() == ui::Page::Photos);
  model.home();
  CHECK(model.page() == ui::Page::Face);
}

void timerPauseResumeAndFinish() {
  ui::FocusTimer timer;
  CHECK(timer.phase() == ui::TimerPhase::Ready);
  CHECK(timer.remainingMs(900000) == 1500000);
  CHECK(timer.selectPreset(ui::Preset::ShortBreak5));
  CHECK(timer.start(1000));
  CHECK(!timer.start(2000));
  CHECK(timer.remainingMs(61000) == 240000);
  CHECK(timer.pause(61000));
  CHECK(timer.phase() == ui::TimerPhase::Paused);
  timer.tick(3601000);
  CHECK(timer.remainingMs(3601000) == 240000);
  CHECK(!timer.selectPreset(ui::Preset::LongBreak15));
  CHECK(!timer.setDurationMinutes(25));
  CHECK(timer.resume(3601000));
  CHECK(timer.remainingMs(3840999) == 1);
  timer.tick(3841000);
  CHECK(timer.done());
  CHECK(!timer.running());
  CHECK(timer.remainingMs(9000000) == 0);
  timer.tick(9000000);
  CHECK(timer.done());  // No automatic next focus/rest session.
  CHECK(!timer.resume(9000000));
  CHECK(timer.selectPreset(ui::Preset::LongBreak15));
  CHECK(timer.phase() == ui::TimerPhase::Ready);
  CHECK(timer.durationMs() == 900000);
  CHECK(!timer.setDurationMinutes(0));
  CHECK(!timer.setDurationMinutes(60));
  CHECK(timer.toggle(9001000));
  CHECK(timer.running());
  CHECK(timer.toggle(9002000));
  CHECK(timer.phase() == ui::TimerPhase::Paused);
  CHECK(timer.remainingMs(9999999) == 899000);
  timer.reset(9999999);
  CHECK(timer.phase() == ui::TimerPhase::Ready);
  CHECK(timer.remainingMs(9999999) == 900000);
}

void timerRolloverAndExpiredPause() {
  ui::FocusTimer timer;
  CHECK(timer.setDurationMinutes(5));
  CHECK(timer.start(UINT32_MAX - 999));
  CHECK(timer.remainingMs(298999) == 1);
  timer.tick(299000);
  CHECK(timer.done());
  CHECK(timer.start(300000));  // Only an explicit user start begins another run.
  CHECK(!timer.pause(600001));
  CHECK(timer.done());
  CHECK(timer.remainingMs(600001) == 0);

  timer.reset();
  CHECK(timer.start(UINT32_MAX - 999));
  CHECK(timer.pause(0));
  CHECK(timer.remainingMs(4000000) == 299000);
  CHECK(timer.resume(UINT32_MAX - 499));
  CHECK(timer.remainingMs(298499) == 1);
  timer.tick(298500);
  CHECK(timer.done());
}

void themeAndNavigationDoNotResetTimer() {
  ui::Model model;
  CHECK(model.timer().start(100));
  CHECK(model.tapFace());
  model.openThemes();
  CHECK(model.themesOpen());
  CHECK(!model.nextPage());
  CHECK(!model.previousPage());
  CHECK(!model.tapFace());
  CHECK(model.page() == ui::Page::Today);
  CHECK(!model.selectTheme(8));
  CHECK(model.themesOpen());
  CHECK(model.theme() == 0);
  CHECK(model.selectTheme(7));
  CHECK(!model.themesOpen());
  CHECK(model.theme() == 7);
  CHECK(model.page() == ui::Page::Today);
  CHECK(model.timer().remainingMs(1100) == 1499000);
  CHECK(model.timer().pause(1100));
  model.home();
  CHECK(model.timer().phase() == ui::TimerPhase::Paused);
  CHECK(model.timer().remainingMs(9000000) == 1499000);
  CHECK(model.timer().resume(9000000));
  model.openThemes();
  model.home();
  CHECK(!model.themesOpen());
  CHECK(model.timer().running());
  CHECK(model.timer().remainingMs(9001000) == 1498000);
}
}  // namespace

int main() {
  releaseOnlyAndCancelledContacts();
  gestureIntentAndPageBoundaries();
  timerPauseResumeAndFinish();
  timerRolloverAndExpiredPause();
  themeAndNavigationDoNotResetTimer();
  std::cout << "PASS " << checks << " Indicator UI checks\n";
  return 0;
}
