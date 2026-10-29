#pragma once

#include <array>
#include <cstdint>
#include <string>
#include "light_effects.h"
#include "printer_text.h"
#include "daily_ticket.h"
#include "water_tank.h"
#include "focus_session.h"

namespace robo {

constexpr size_t MaxRequestId = 32;
constexpr size_t MaxPrintBytes = MaxPrinterTextBytes;
constexpr size_t CacheCapacity = 64;

struct Command {
  std::string requestId;
  std::string action;
  bool hasDuration = false;
  int64_t durationMs = 0;
  bool hasOn = false;
  bool on = false;
  bool hasText = false;
  std::string text;
  bool hasDaily = false;
  DailyTicket daily;
  bool hasEffect = false;
  std::string effect;
};

inline bool samePayload(const Command& a, const Command& b) {
  bool sameEffect = a.hasEffect == b.hasEffect && a.effect == b.effect;
  if (a.action == "light" && b.action == "light" && a.hasOn && b.hasOn && a.on && b.on)
    sameEffect = (a.hasEffect ? a.effect : "solid") == (b.hasEffect ? b.effect : "solid");
  return a.action == b.action && a.hasDuration == b.hasDuration &&
         a.durationMs == b.durationMs && a.hasOn == b.hasOn && a.on == b.on &&
         a.hasText == b.hasText && a.text == b.text && sameEffect &&
         a.hasDaily == b.hasDaily && sameDaily(a.daily,b.daily);
}

struct Result {
  bool ok = false;
  std::string requestId;
  std::string status = "rejected";
  std::string error;
  bool duplicate = false;
};

struct Config {
  bool actionsEnabled = false;
  bool credentialsConfigured = false;
  bool pumpEnabled = false;
  bool lightEnabled = false;
  bool printerEnabled = false;
  uint32_t maxWaterMs = 3000;
  bool tankRequired = false;
  TankCalibration tankCalibration;
};

inline bool validId(const std::string& id) {
  if (id.empty() || id.size() > MaxRequestId) return false;
  for (unsigned char c : id) {
    if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
          (c >= '0' && c <= '9') || c == '-' || c == '_')) return false;
  }
  return true;
}

inline bool printableText(const std::string& text) {
  PrinterLayout layout;
  return printerTextLayout(text, layout);
}

inline bool parseUnsigned(const std::string& text, uint32_t& value) {
  if (text.empty()) return false;
  uint32_t result = 0;
  for (char c : text) {
    if (c < '0' || c > '9') return false;
    const uint32_t digit = static_cast<uint32_t>(c - '0');
    if (result > (UINT32_MAX - digit) / 10U) return false;
    result = result * 10U + digit;
  }
  value = result;
  return true;
}

// Caller serializes access. There are no delays, hardware calls or network calls.
// Dedupe entries deliberately NEVER expire/evict within a boot: a replay cannot
// start the pump again after unrelated commands. Capacity exhaustion fails closed.
class Controller {
 public:
  explicit Controller(const Config& config) : config_(config), tank_(config.tankCalibration) { last_.status = "none"; }

  Result submit(const Command& command, uint32_t now) {
    tick(now);
    if (!validId(command.requestId)) return reject(command, "invalid_request_id", false);
    for (size_t i = 0; i < used_; ++i) {
      if (entries_[i].command.requestId == command.requestId) {
        if (!samePayload(entries_[i].command, command))
          return reject(command, "request_id_conflict", false);
        Result result = entries_[i].result;
        result.duplicate = true;
        return result;
      }
    }
    const std::string error = validate(command);
    if (!error.empty()) return reject(command, error);

    // Emergency OFF is always available to an authenticated caller, even when
    // actions are disabled or the dedupe table is full. OFF is intrinsically
    // idempotent; no other action is admitted once the table is full.
    if (used_ == CacheCapacity && command.action != "stop_water")
      return reject(command, "idempotency_cache_full");

    Result result;
    result.ok = true;
    result.requestId = command.requestId;
    result.status = "completed";
    if (focusAction(command.action)) {
      if(!focus_.apply(command.action,static_cast<uint32_t>(command.durationMs),now))return reject(command,"focus_invalid_state");
    } else if(command.action=="auto_print") { autoPrint_=command.on;
    } else if (command.action == "water") {
      const char* waterError = waterBlockReason(now);
      if (*waterError) return reject(command, waterError);
      if (pumpOn_) return reject(command, "pump_busy");
      if (printerBusy_) return reject(command, "printer_busy");
      pumpOn_ = true;
      pumpStartedMs_ = now;
      pumpDurationMs_ = static_cast<uint32_t>(command.durationMs);
      pumpRequestId_ = command.requestId;
      result.status = "accepted";
    } else if (command.action == "stop_water") {
      completePump();
    } else if (command.action == "light") {
      lightOn_ = command.on;
      lightEffect_ = command.on && command.hasEffect ? command.effect : "solid";
    } else if ((command.action == "print" || command.action == "print_scene" || command.action == "print_daily" || command.action == "print_calibration")) {
      if (printerRecoveryRequired_) return reject(command, "printer_recovery_required");
      if (pumpOn_) return reject(command, "pump_busy");
      if (printerBusy_) return reject(command, "printer_busy");
      if(command.action=="print_scene" && command.on) {
        if(!autoPrint_)return reject(command,"auto_print_disabled");
        const int scene=sceneNumber(command.effect);
        if(scenePrinted_[scene] && uint32_t(now-sceneTime_[scene])<300000)return reject(command,"scene_cooldown");
        scenePrinted_[scene]=true;sceneTime_[scene]=now;
      }
      printerBusy_ = true;
      printerStatus_ = "queued";
      result.status = "accepted";
    }
    if (used_ < CacheCapacity) entries_[used_++] = Entry{command, result};
    last_ = result;
    return result;
  }

  void tick(uint32_t now) {
    focus_.tick(now);
    if (pumpOn_ && *waterBlockReason(now)) {
      pumpOn_ = false;
      finish(pumpRequestId_, false, waterBlockReason(now));
    }
    // Subtraction is correct across millis() wrap; durations are <= 30 seconds.
    if (pumpOn_ && static_cast<uint32_t>(now - pumpStartedMs_) >= pumpDurationMs_)
      completePump();
  }

  void updateTank(int distanceMm, uint32_t now) { tank_.update(distanceMm, now); tick(now); }
  void failPreference(const std::string& id,bool previous) {autoPrint_=previous;finish(id,false,"settings_save_failed");}
  bool autoPrint() const {return autoPrint_;}
  void restoreAutoPrint(bool value) {autoPrint_=value;}
  const FocusSession& focus() const {return focus_;}
  const char* waterBlockReason(uint32_t now) const {
    return config_.tankRequired ? tank_.error(now) : "";
  }

  void finishPrint(const std::string& requestId, bool success) {
    printerBusy_ = false;
    // A partial GS v 0 leaves the device waiting for raster bytes. No new job
    // may follow until both printer and controller are restarted/recovered.
    if (!success) printerRecoveryRequired_ = true;
    printerStatus_ = printerRecoveryRequired_ ? "recovery_required" : "bytes_sent";
    finish(requestId, success, success ? "" : "printer_write_failed");
  }

  uint32_t remainingMs(uint32_t now) const {
    if (!pumpOn_) return 0;
    const uint32_t elapsed = now - pumpStartedMs_;
    return elapsed >= pumpDurationMs_ ? 0 : pumpDurationMs_ - elapsed;
  }
  bool pumpOn() const { return pumpOn_; }
  bool lightOn() const { return lightOn_; }
  const std::string& lightEffect() const { return lightEffect_; }
  bool printerBusy() const { return printerBusy_; }
  const char* printerStatus() const {
    return config_.printerEnabled ? printerStatus_.c_str() : "disabled";
  }
  const Result& last() const { return last_; }
  bool lookup(const std::string& requestId, Result& result) const {
    for (size_t i = 0; i < used_; ++i) {
      if (entries_[i].command.requestId == requestId) {
        result = entries_[i].result;
        return true;
      }
    }
    return false;
  }

 private:
  struct Entry { Command command; Result result; };
  Config config_;
  TankGuard tank_;
  FocusSession focus_;
  bool autoPrint_=true;
  bool scenePrinted_[6]={};
  uint32_t sceneTime_[6]={};
  std::array<Entry, CacheCapacity> entries_{};
  size_t used_ = 0;
  bool pumpOn_ = false;
  bool lightOn_ = false;
  std::string lightEffect_ = "solid";
  bool printerBusy_ = false;
  bool printerRecoveryRequired_ = false;
  uint32_t pumpStartedMs_ = 0;
  uint32_t pumpDurationMs_ = 0;
  std::string pumpRequestId_;
  std::string printerStatus_ = "idle";
  Result last_;

  Result reject(const Command& command, const std::string& error, bool remember = true) {
    Result result;
    result.requestId = command.requestId;
    result.error = error;
    if (remember && used_ < CacheCapacity) entries_[used_++] = Entry{command, result};
    last_ = result;
    return result;
  }

  std::string validate(const Command& c) const {
    if (c.action != "water" && c.action != "stop_water" &&
        c.action != "light" && c.action != "print" && c.action != "print_scene" && c.action != "print_daily" && c.action != "print_calibration" && c.action != "auto_print" && !focusAction(c.action)) return "unknown_action";
    if (c.hasDaily && c.action != "print_daily") return "unexpected_fields";
    if (c.action == "print_daily" && (!c.hasDaily || !validDaily(c.daily))) return "invalid_daily_ticket";
    if (c.action == "stop_water") {
      if (c.hasDuration || c.hasOn || c.hasText || c.hasEffect) return "unexpected_fields";
      return "";
    }
    if (!config_.actionsEnabled || !config_.credentialsConfigured)
      return "actions_disabled";
    if(c.action=="auto_print")return c.hasOn && !c.hasDuration && !c.hasText && !c.hasEffect ? "" : "unexpected_fields";
    if(focusAction(c.action)) {
      if(c.hasOn || c.hasText || c.hasEffect || c.hasDaily)return "unexpected_fields";
      if(c.action=="focus_start")return !c.hasDuration || c.durationMs<60000 || c.durationMs>7200000 ? "invalid_duration" : "";
      return c.hasDuration?"unexpected_fields":"";
    }
    if (c.action == "water") {
      if (!config_.pumpEnabled) return "pump_disabled";
      if (!c.hasDuration || c.hasOn || c.hasText || c.hasEffect) return "invalid_water_fields";
      if (config_.maxWaterMs == 0 || config_.maxWaterMs > 30000 ||
          c.durationMs <= 0 || c.durationMs > config_.maxWaterMs)
        return "invalid_duration";
    } else if (c.action == "light") {
      if (!config_.lightEnabled) return "light_disabled";
      if (!c.hasOn || c.hasDuration || c.hasText) return "invalid_light_fields";
      if (c.hasEffect) {
        LightEffect effect;
        if (!c.on || !parseLightEffect(c.effect, effect)) return "invalid_light_fields";
      }
    } else if (c.action == "print_scene") {
      if(!config_.printerEnabled)return "printer_disabled";
      if(c.hasDuration || !c.hasOn || !c.hasText || !c.hasEffect || sceneNumber(c.effect)<1 || !validSceneNote(c.text))return "invalid_scene";
    } else if (c.action == "print_calibration") {
      if (!config_.printerEnabled) return "printer_disabled";
      if (c.hasText || c.hasDuration || c.hasOn || c.hasEffect) return "unexpected_fields";
    } else if (c.action == "print_daily") {
      if (!config_.printerEnabled) return "printer_disabled";
      if (c.hasText || c.hasDuration || c.hasOn || c.hasEffect) return "unexpected_fields";
    } else if (c.action == "print") {
      if (!config_.printerEnabled) return "printer_disabled";
      if (!c.hasText || c.hasDuration || c.hasOn || c.hasEffect || !printableText(c.text))
        return "invalid_print_text";
    }
    return "";
  }

  void finish(const std::string& requestId, bool success, const char* error) {
    for (size_t i = 0; i < used_; ++i) {
      if (entries_[i].command.requestId == requestId) {
        Result& r = entries_[i].result;
        r.ok = success;
        r.status = success ? "completed" : "rejected";
        r.error = error;
        if (last_.requestId == requestId) last_ = r;
        break;
      }
    }
  }
  void completePump() {
    if (!pumpOn_) return;
    pumpOn_ = false;
    finish(pumpRequestId_, true, "");
  }
};

inline bool calibrated(int dry, int wet) {
  return dry >= 0 && dry <= 4095 && wet >= 0 && wet <= 4095 && dry != wet;
}
inline double soilPercent(int raw, int dry, int wet) {
  const double value = 100.0 * (raw - dry) / (wet - dry);
  return value < 0.0 ? 0.0 : (value > 100.0 ? 100.0 : value);
}
}  // namespace robo
