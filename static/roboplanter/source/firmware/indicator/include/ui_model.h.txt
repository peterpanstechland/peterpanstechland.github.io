#pragma once

#include <cstdint>

// Portable presentation state only. No network, GPIO, storage, or actuator calls.
namespace ui {
enum class Page : uint8_t { Face, Today, Info, Photos, Focus };
enum class Gesture : uint8_t { None, Tap, SwipeLeft, SwipeRight };
enum class TouchInput : uint8_t { Up, Down, Invalid };
enum class Preset : uint8_t { Focus25, ShortBreak5, LongBreak15 };
enum class TimerPhase : uint8_t { Ready, Running, Paused, Completed };
constexpr uint8_t ThemeCount = 8;
constexpr uint8_t PageCount = 5;

// A touch-down or move never returns an interaction. Only a genuine release
// may produce a gesture. Invalid sensor input locks the contact until an Up.
class TouchGate {
 public:
  void begin(int32_t x, int32_t y, uint32_t now) {
    if (blocked_ || active_) return;
    active_ = true;
    startX_ = lastX_ = x;
    startY_ = lastY_ = y;
    startedMs_ = now;
    maxDx_ = maxDy_ = 0;
  }

  void move(int32_t x, int32_t y, uint32_t /* now */) {
    if (!active_ || blocked_) return;
    lastX_ = x;
    lastY_ = y;
    const int64_t dx = magnitude(static_cast<int64_t>(x) - startX_);
    const int64_t dy = magnitude(static_cast<int64_t>(y) - startY_);
    if (dx > maxDx_) maxDx_ = dx;
    if (dy > maxDy_) maxDy_ = dy;
  }

  Gesture release(int32_t x, int32_t y, uint32_t now) {
    if (blocked_) {
      blocked_ = false;
      active_ = false;
      return Gesture::None;
    }
    if (!active_) return Gesture::None;
    move(x, y, now);
    active_ = false;
    const int64_t dx = static_cast<int64_t>(x) - startX_;
    const int64_t dy = static_cast<int64_t>(y) - startY_;
    if (magnitude(dx) >= 60 && magnitude(dx) > magnitude(dy))
      return dx < 0 ? Gesture::SwipeLeft : Gesture::SwipeRight;
    // Moving away and back cannot become a tap on a hardware-action button.
    if (maxDx_ <= 12 && maxDy_ <= 12 && static_cast<uint32_t>(now - startedMs_) <= 600)
      return Gesture::Tap;
    return Gesture::None;
  }

  Gesture update(TouchInput input, int32_t x, int32_t y, uint32_t now) {
    if (input == TouchInput::Invalid) {
      cancel();
      return Gesture::None;
    }
    if (input == TouchInput::Up) {
      // Controllers need not supply useful coordinates on Up. Use the last
      // valid Down point, rather than a stale/zero coordinate in the Up packet.
      return release(lastX_, lastY_, now);
    }
    if (!active_) begin(x, y, now);
    else move(x, y, now);
    return Gesture::None;
  }

  void cancel() { active_ = false; blocked_ = true; }
  bool active() const { return active_; }
  bool blockedUntilUp() const { return blocked_; }
  int32_t startX() const { return startX_; }
  int32_t startY() const { return startY_; }
  int32_t lastX() const { return lastX_; }
  int32_t lastY() const { return lastY_; }

 private:
  static int64_t magnitude(int64_t value) { return value < 0 ? -value : value; }
  bool active_ = false;
  bool blocked_ = false;
  int32_t startX_ = 0, startY_ = 0, lastX_ = 0, lastY_ = 0;
  int64_t maxDx_ = 0, maxDy_ = 0;
  uint32_t startedMs_ = 0;
};

class FocusTimer {
 public:
  bool selectPreset(Preset value) {
    if (phase_ == TimerPhase::Running || phase_ == TimerPhase::Paused) return false;
    if (value != Preset::Focus25 && value != Preset::ShortBreak5 && value != Preset::LongBreak15)
      return false;
    preset_ = value;
    reset();
    return true;
  }

  bool setDurationMinutes(uint16_t minutes) {
    if (minutes == 25) return selectPreset(Preset::Focus25);
    if (minutes == 5) return selectPreset(Preset::ShortBreak5);
    if (minutes == 15) return selectPreset(Preset::LongBreak15);
    return false;
  }

  bool start(uint32_t now) {
    if (phase_ != TimerPhase::Ready && phase_ != TimerPhase::Completed) return false;
    remaining_ = durationMs();
    startedMs_ = now;
    phase_ = TimerPhase::Running;
    return true;
  }

  bool pause(uint32_t now) {
    tick(now);
    if (phase_ != TimerPhase::Running) return false;
    remaining_ = remainingMs(now);
    phase_ = TimerPhase::Paused;
    return true;
  }

  bool resume(uint32_t now) {
    if (phase_ != TimerPhase::Paused) return false;
    startedMs_ = now;
    phase_ = TimerPhase::Running;
    return true;
  }

  bool toggle(uint32_t now) {
    tick(now);
    if (phase_ == TimerPhase::Running) return pause(now);
    if (phase_ == TimerPhase::Paused) return resume(now);
    return start(now);
  }

  void reset(uint32_t /* now */ = 0) {
    remaining_ = durationMs();
    startedMs_ = 0;
    phase_ = TimerPhase::Ready;
  }

  void tick(uint32_t now) {
    if (phase_ == TimerPhase::Running && remainingMs(now) == 0) {
      remaining_ = 0;
      phase_ = TimerPhase::Completed;
    }
  }

  uint32_t remainingMs(uint32_t now) const {
    if (phase_ != TimerPhase::Running) return remaining_;
    const uint32_t elapsed = now - startedMs_;
    return elapsed >= remaining_ ? 0 : remaining_ - elapsed;
  }

  uint32_t durationMs() const {
    return preset_ == Preset::ShortBreak5 ? 300000U :
           preset_ == Preset::LongBreak15 ? 900000U : 1500000U;
  }
  Preset preset() const { return preset_; }
  TimerPhase phase() const { return phase_; }
  bool running() const { return phase_ == TimerPhase::Running; }
  bool done() const { return phase_ == TimerPhase::Completed; }

 private:
  Preset preset_ = Preset::Focus25;
  TimerPhase phase_ = TimerPhase::Ready;
  uint32_t remaining_ = 1500000U;
  uint32_t startedMs_ = 0;
};

class Model {
 public:
  Page page() const { return page_; }
  bool nextPage() {
    if (themesOpen_ || page_ == Page::Focus) return false;
    page_ = static_cast<Page>(static_cast<uint8_t>(page_) + 1);
    return true;
  }
  bool previousPage() {
    if (themesOpen_ || page_ == Page::Face) return false;
    page_ = static_cast<Page>(static_cast<uint8_t>(page_) - 1);
    return true;
  }
  bool handleGesture(Gesture gesture) {
    if (gesture == Gesture::SwipeLeft) return nextPage();
    if (gesture == Gesture::SwipeRight) return previousPage();
    return false;
  }
  bool tapFace() {
    if (themesOpen_ || page_ != Page::Face) return false;
    page_ = Page::Today;
    return true;
  }
  void home() { page_ = Page::Face; themesOpen_ = false; }
  void openThemes() { themesOpen_ = true; }
  void closeThemes() { themesOpen_ = false; }
  bool themesOpen() const { return themesOpen_; }
  uint8_t theme() const { return theme_; }
  bool selectTheme(uint8_t value) {
    if (value >= ThemeCount) return false;
    theme_ = value;
    themesOpen_ = false;
    return true;
  }
  bool setTheme(uint8_t value) { return selectTheme(value); }
  FocusTimer& timer() { return timer_; }
  const FocusTimer& timer() const { return timer_; }

 private:
  Page page_ = Page::Face;
  bool themesOpen_ = false;
  uint8_t theme_ = 0;
  FocusTimer timer_;
};
}  // namespace ui
