#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include "../../firmware/xiao/include/controller.h"
#include "../../firmware/xiao/include/ble_session.h"

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

robo::Config enabled() {
  robo::Config c;
  c.actionsEnabled = true;
  c.credentialsConfigured = true;
  c.pumpEnabled = c.lightEnabled = c.printerEnabled = true;
  c.maxWaterMs = 3000;
  return c;
}
robo::Command water(const std::string& id, int64_t duration) {
  robo::Command c;
  c.requestId = id; c.action = "water";
  c.hasDuration = true; c.durationMs = duration;
  return c;
}
robo::Command stop(const std::string& id) {
  robo::Command c; c.requestId = id; c.action = "stop_water"; return c;
}
robo::Command light(const std::string& id, bool on) {
  robo::Command c; c.requestId = id; c.action = "light";
  c.hasOn = true; c.on = on; return c;
}
robo::Command print(const std::string& id, const std::string& text) {
  robo::Command c; c.requestId = id; c.action = "print";
  c.hasText = true; c.text = text; return c;
}

void deadlineAndReplay() {
  robo::Controller c(enabled());
  const auto command = water("dose1", 1000);
  CHECK(c.submit(command, 100).status == "accepted");
  CHECK(c.pumpOn());
  CHECK(c.remainingMs(600) == 500);
  CHECK(c.submit(command, 600).duplicate);
  CHECK(c.remainingMs(600) == 500);  // Replay must not restart the deadline.
  c.tick(1099); CHECK(c.pumpOn());
  c.tick(1100); CHECK(!c.pumpOn());
  CHECK(c.submit(command, 2000).status == "completed");
  CHECK(!c.pumpOn());
  CHECK(c.submit(water("dose1", 500), 2001).error == "request_id_conflict");
  CHECK(!c.pumpOn());
  robo::Result lookup;
  CHECK(c.lookup("dose1", lookup));
  CHECK(lookup.status == "completed");
  CHECK(!c.lookup("absent", lookup));
}

void wrapAndStop() {
  robo::Controller c(enabled());
  const uint32_t start = UINT32_MAX - 499;
  CHECK(c.submit(water("wrap", 1000), start).ok);
  c.tick(499); CHECK(c.pumpOn());
  CHECK(c.remainingMs(499) == 1);
  c.tick(500); CHECK(!c.pumpOn());
  CHECK(c.submit(water("early", 3000), 600).ok);
  CHECK(c.submit(stop("halt"), 650).status == "completed");
  CHECK(!c.pumpOn());
  CHECK(c.submit(water("early", 3000), 700).status == "completed");
  CHECK(!c.pumpOn());
}

void validationAndOverflow() {
  robo::Controller c(enabled());
  CHECK(c.submit(water("zero", 0), 0).error == "invalid_duration");
  CHECK(c.submit(water("negative", -1), 0).error == "invalid_duration");
  CHECK(c.submit(water("over", 3001), 0).error == "invalid_duration");
  CHECK(c.submit(water("huge", std::numeric_limits<int64_t>::max()), 0).error == "invalid_duration");
  CHECK(!c.pumpOn());
  robo::Command unknown; unknown.requestId = "unknown"; unknown.action = "drive";
  CHECK(c.submit(unknown, 0).error == "unknown_action");
  CHECK(c.submit(water("bad id", 100), 0).error == "invalid_request_id");
  CHECK(c.submit(water(std::string(33, 'a'), 100), 0).error == "invalid_request_id");
  auto extra = water("extra", 100); extra.hasOn = true;
  CHECK(c.submit(extra, 0).error == "invalid_water_fields");
  auto invalidStop = stop("badstop"); invalidStop.hasDuration = true;
  CHECK(c.submit(invalidStop, 0).error == "unexpected_fields");
  uint32_t value = 123;
  CHECK(robo::parseUnsigned("4294967295", value)); CHECK(value == UINT32_MAX);
  CHECK(!robo::parseUnsigned("4294967296", value));
  CHECK(!robo::parseUnsigned("18446744073709551615", value));
  CHECK(!robo::parseUnsigned("-1", value));
  CHECK(!robo::parseUnsigned("1.5", value));
  CHECK(!robo::parseUnsigned(" 5", value));
  CHECK(!robo::parseUnsigned("", value));
  CHECK(robo::parseUnsigned("00030", value)); CHECK(value == 30);
}

void disabledAndInterlock() {
  robo::Controller defaults(robo::Config{});
  CHECK(defaults.submit(water("default", 100), 0).error == "actions_disabled");
  CHECK(defaults.submit(stop("safe"), 0).ok);
  auto configuration = enabled(); configuration.credentialsConfigured = false;
  robo::Controller weakToken(configuration);
  CHECK(weakToken.submit(water("token", 100), 0).error == "actions_disabled");
  configuration = enabled(); configuration.pumpEnabled = false;
  configuration.lightEnabled = configuration.printerEnabled = false;
  robo::Controller peripheralsOff(configuration);
  CHECK(peripheralsOff.submit(water("pump", 100), 0).error == "pump_disabled");
  CHECK(peripheralsOff.submit(light("lamp", true), 0).error == "light_disabled");
  CHECK(peripheralsOff.submit(print("paper", "Hi"), 0).error == "printer_disabled");
  robo::Controller c(enabled());
  CHECK(c.submit(water("first", 1000), 0).ok);
  CHECK(c.submit(water("second", 100), 10).error == "pump_busy");
  CHECK(c.submit(print("blocked", "Hi"), 10).error == "pump_busy");
  CHECK(c.submit(stop("stop"), 20).ok);
  CHECK(c.submit(print("receipt", "Hello\nPlant"), 30).status == "accepted");
  CHECK(c.submit(water("during", 100), 40).error == "printer_busy");
  CHECK(c.submit(print("receipt", "Hello\nPlant"), 40).duplicate);
  c.finishPrint("receipt", true);
  CHECK(std::string(c.printerStatus()) == "bytes_sent");
  CHECK(c.submit(print("receipt", "Hello\nPlant"), 50).status == "completed");
  CHECK(!c.printerBusy());
  // A busy rejection is stable under retry; a deliberate new request is needed.
  CHECK(c.submit(water("during", 100), 60).error == "printer_busy");
  CHECK(!c.pumpOn());
  CHECK(c.submit(water("new", 100), 70).ok);
}

void printerAndCalibration() {
  robo::Controller c(enabled());
  CHECK(c.submit(print("escape", std::string("x\x1b") + "@"), 0).error == "invalid_print_text");
  CHECK(c.submit(print("empty", ""), 0).error == "invalid_print_text");
  CHECK(c.submit(print("long", std::string(161, 'x')), 0).error == "invalid_print_text");
  CHECK(c.submit(print("utf8", "\xe6\xa4\x8d\xe7\x89\xa9"), 0).error == "invalid_print_text");
  CHECK(c.submit(print("failure", "Receipt"), 0).ok);
  c.finishPrint("failure", false);
  CHECK(c.submit(print("failure", "Receipt"), 1).error == "printer_write_failed");
  CHECK(!c.printerBusy());
  CHECK(!robo::calibrated(-1, -1)); CHECK(!robo::calibrated(100, 100));
  CHECK(robo::calibrated(3000, 1000));
  CHECK(robo::soilPercent(2000, 3000, 1000) == 50.0);
  CHECK(robo::soilPercent(4000, 3000, 1000) == 0.0);
  CHECK(robo::soilPercent(0, 3000, 1000) == 100.0);
  CHECK(robo::soilPercent(1500, 1000, 2000) == 50.0);
}

void cacheCapacity() {
  robo::Controller c(enabled());
  CHECK(c.submit(water("old", 10), 0).ok);
  c.tick(10);
  for (size_t i = 1; i < robo::CacheCapacity; ++i)
    CHECK(c.submit(light("light" + std::to_string(i), i % 2), 20).ok);
  CHECK(c.submit(water("old", 10), 30).status == "completed");
  CHECK(!c.pumpOn());
  CHECK(c.submit(water("overflow", 10), 30).error == "idempotency_cache_full");
  CHECK(c.submit(stop("always"), 30).ok);
  CHECK(!c.pumpOn());
  CHECK(c.submit(water("always", 10), 30).error == "idempotency_cache_full");

  robo::Controller active(enabled());
  for (size_t i = 0; i < robo::CacheCapacity - 1; ++i)
    CHECK(active.submit(light("lamp" + std::to_string(i), false), 0).ok);
  CHECK(active.submit(water("last", 3000), 0).ok);
  CHECK(active.submit(stop("haltfull"), 1).ok);
  CHECK(!active.pumpOn());
}

void bleConnectionBoundary() {
  robo::BleSession session;
  CHECK(!session.ticketFor(7).valid());
  CHECK(!session.matches({}));
  CHECK(session.connect(7));
  const auto oldJob = session.ticketFor(7);
  CHECK(session.matches(oldJob));
  CHECK(!session.mayReply(oldJob));  // A new peer must subscribe itself.
  session.setNotifications(7, true);
  CHECK(session.mayReply(oldJob));
  CHECK(!session.connect(8));
  CHECK(!session.ticketFor(8).valid());
  session.setNotifications(8, false);
  CHECK(session.mayReply(oldJob));
  CHECK(!session.disconnect(8));  // Rejecting another peer cannot reset the owner.
  CHECK(session.matches(oldJob));
  CHECK(session.disconnect(7));
  CHECK(!session.matches(oldJob));
  CHECK(!session.mayReply(oldJob));

  // ESP-IDF reuses connection IDs. A job already dequeued before disconnect
  // must neither actuate nor return its response to the replacement peer.
  CHECK(session.connect(7));
  const auto newJob = session.ticketFor(7);
  CHECK(newJob.connectionId == oldJob.connectionId);
  CHECK(newJob.generation != oldJob.generation);
  CHECK(!session.matches(oldJob));
  session.setNotifications(7, true);
  CHECK(!session.mayReply(oldJob));
  CHECK(session.mayReply(newJob));
  robo::Controller controller(enabled());
  if (session.matches(oldJob)) controller.submit(water("stale", 1000), 0);
  CHECK(!controller.pumpOn());
  CHECK(controller.submit(water("current", 1000), 0).ok);
  CHECK(session.disconnect(7));
  controller.tick(1000);  // Accepted work still stops independently of BLE.
  CHECK(!controller.pumpOn());
  CHECK(!session.mayReply(newJob));
}

void blePreparedWriteBoundary() {
  robo::BlePreparedWrite<32> buffer;
  const robo::BleTicket owner{1, 7}, replacement{2, 7}, stranger{1, 8};
  const std::string first = "S|test-token-12345|", last = "soil";
  auto bytes = [](const std::string& text) { return reinterpret_cast<const uint8_t*>(text.data()); };
  char output[33]{};
  CHECK(buffer.append(owner, 0, bytes(first), first.size()));
  CHECK(buffer.append(owner, first.size(), bytes(last), last.size()));
  CHECK(buffer.finish(owner, output));
  CHECK(std::string(output) == first + last);
  CHECK(!buffer.finish(owner, output));  // Execute is consumed exactly once.

  CHECK(buffer.append(owner, 0, bytes(first), first.size()));
  CHECK(!buffer.append(stranger, first.size(), bytes(last), last.size()));
  CHECK(!buffer.finish(owner, output));
  CHECK(buffer.append(owner, 0, bytes(first), first.size()));
  CHECK(!buffer.finish(replacement, output));
  CHECK(buffer.append(owner, 0, bytes(first), first.size()));
  buffer.reset();  // Disconnect or ATT cancel: no residual authenticated bytes.
  CHECK(!buffer.finish(replacement, output));
  CHECK(!buffer.append(replacement, first.size(), bytes(last), last.size()));
  CHECK(!buffer.append(replacement, 0, bytes(last), last.size())); // Invalid until cancel/execute.
  CHECK(!buffer.finish(replacement, output));
  CHECK(buffer.append(replacement, 0, bytes(last), last.size()));
  CHECK(buffer.finish(replacement, output));
  CHECK(std::string(output) == last);

  const std::string full(32, 'a'), tooLarge(33, 'a');
  CHECK(buffer.append(owner, 0, bytes(full), full.size()));
  CHECK(buffer.finish(owner, output));
  CHECK(std::string(output) == full);
  CHECK(!buffer.append(owner, 0, bytes(tooLarge), tooLarge.size()));
  CHECK(!buffer.finish(owner, output));
  CHECK(buffer.append(owner, 0, bytes(first), first.size()));
  CHECK(!buffer.append(owner, 0, bytes(first), first.size())); // Duplicate/out-of-order fragment.
  CHECK(!buffer.finish(owner, output));
  const uint8_t embeddedNul[] = {'S', '\0', 'x'};
  CHECK(buffer.append(owner, 0, embeddedNul, sizeof(embeddedNul)));
  CHECK(!buffer.finish(owner, output));
  CHECK(!buffer.append({}, 0, bytes(last), last.size()));
  CHECK(!buffer.finish(owner, output));
}
}  // namespace

int main() {
  deadlineAndReplay(); wrapAndStop(); validationAndOverflow();
  disabledAndInterlock(); printerAndCalibration(); cacheCapacity();
  bleConnectionBoundary(); blePreparedWriteBoundary();
  std::cout << "PASS " << checks << " controller checks\n";
  return 0;
}
