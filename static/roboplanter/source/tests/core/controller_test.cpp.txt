#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include <vector>
#include "../../firmware/xiao/include/controller.h"
#include "../../firmware/xiao/include/ble_session.h"
#include "../../firmware/xiao/include/printer_receipt.h"
#include "../../firmware/xiao/include/printer_transport.h"
#include "../../firmware/indicator/include/receipt_preview.h"

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

void lightEffectCommands() {
  robo::Controller c(enabled());
  CHECK(c.lightEffect() == "solid");
  CHECK(!c.lightOn());
  auto plain = light("plain", true);
  CHECK(c.submit(plain, 0).ok);
  CHECK(c.lightOn());
  CHECK(c.lightEffect() == "solid");
  auto explicitSolid = plain;
  explicitSolid.hasEffect = true;
  explicitSolid.effect = "solid";
  CHECK(c.submit(explicitSolid, 1).duplicate);
  auto differentEffect = explicitSolid;
  differentEffect.effect = "breath";
  CHECK(c.submit(differentEffect, 2).error == "request_id_conflict");
  CHECK(c.lightEffect() == "solid");
  differentEffect.requestId = "breath";
  CHECK(c.submit(differentEffect, 3).ok);
  CHECK(c.lightEffect() == "breath");
  for (const char* effect : {"chase", "rainbow", "solid"}) {
    auto next = light(effect, true);
    next.hasEffect = true; next.effect = effect;
    CHECK(c.submit(next, 4).ok);
    CHECK(c.lightEffect() == effect);
  }
  auto offWithEffect = light("bad_off", false);
  offWithEffect.hasEffect = true; offWithEffect.effect = "solid";
  CHECK(c.submit(offWithEffect, 5).error == "invalid_light_fields");
  CHECK(c.lightOn());
  int invalidIndex = 0;
  for (const char* invalid : {"", "Breath", "pulse", "solid ", "rainbow|x"}) {
    auto bad = light(std::string("invalid") + std::to_string(invalidIndex++), true);
    bad.hasEffect = true; bad.effect = invalid;
    CHECK(c.submit(bad, 6).error == "invalid_light_fields");
    CHECK(c.lightEffect() == "solid");
  }
  auto waterWithEffect = water("badwater", 500);
  waterWithEffect.hasEffect = true; waterWithEffect.effect = "solid";
  CHECK(c.submit(waterWithEffect, 7).error == "invalid_water_fields");
  auto printWithEffect = print("badprint", "Hello");
  printWithEffect.hasEffect = true; printWithEffect.effect = "breath";
  CHECK(c.submit(printWithEffect, 7).error == "invalid_print_text");
  auto stopWithEffect = stop("badstopfx");
  stopWithEffect.hasEffect = true; stopWithEffect.effect = "solid";
  CHECK(c.submit(stopWithEffect, 7).error == "unexpected_fields");
  CHECK(!c.pumpOn());
  CHECK(!c.printerBusy());
  auto breatheAgain = light("breath2", true);
  breatheAgain.hasEffect = true; breatheAgain.effect = "breath";
  CHECK(c.submit(breatheAgain, 8).ok);
  CHECK(c.submit(light("off", false), 9).ok);
  CHECK(!c.lightOn());
  CHECK(c.lightEffect() == "solid");
  CHECK(c.submit(light("again", true), 10).ok);
  CHECK(c.lightEffect() == "solid");

  // Explicit solid first is also equivalent to a later legacy payload.
  robo::Controller reversed(enabled());
  explicitSolid.requestId = "reverse";
  plain.requestId = "reverse";
  CHECK(reversed.submit(explicitSolid, 0).ok);
  CHECK(reversed.submit(plain, 1).duplicate);

  // Lamp updates neither restart nor extend an outstanding pump deadline.
  CHECK(c.submit(water("pumpfx", 500), 100).ok);
  auto flowing = light("flowing", true);
  flowing.hasEffect = true; flowing.effect = "chase";
  CHECK(c.submit(flowing, 599).ok);
  CHECK(c.remainingMs(599) == 1);
  c.tick(600);
  CHECK(!c.pumpOn());
  CHECK(c.lightOn());
  CHECK(c.lightEffect() == "chase");

  auto disabled = enabled(); disabled.actionsEnabled = false;
  robo::Controller noActions(disabled);
  CHECK(noActions.submit(flowing, 0).error == "actions_disabled");
  CHECK(!noActions.lightOn());
  disabled = enabled(); disabled.credentialsConfigured = false;
  robo::Controller noCredentials(disabled);
  CHECK(noCredentials.submit(flowing, 0).error == "actions_disabled");
  disabled = enabled(); disabled.lightEnabled = false;
  robo::Controller noLight(disabled);
  CHECK(noLight.submit(flowing, 0).error == "light_disabled");
}

void printerAndCalibration() {
  robo::Controller c(enabled());
  CHECK(c.submit(print("escape", std::string("x\x1b") + "@"), 0).error == "invalid_print_text");
  CHECK(c.submit(print("empty", ""), 0).error == "invalid_print_text");
  CHECK(c.submit(print("long", std::string(161, 'x')), 0).error == "invalid_print_text");
  CHECK(c.submit(print("utf8", "\xe6\xa4\x8d\xe7\x89\xa9"), 0).ok);
  c.finishPrint("utf8", true);
  CHECK(c.submit(print("failure", "Receipt"), 0).ok);
  c.finishPrint("failure", false);
  CHECK(c.submit(print("failure", "Receipt"), 1).error == "printer_write_failed");
  CHECK(!c.printerBusy());
  CHECK(std::string(c.printerStatus()) == "recovery_required");
  CHECK(c.submit(print("after-failure", "Another receipt"), 2).error == "printer_recovery_required");
  CHECK(!c.printerBusy());
  CHECK(std::string(c.printerStatus()) == "recovery_required");
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
void receiptTypography() {
  const std::string text = "M\nM";
  std::string encoded;
  CHECK(robo::writeReceipt(text,[&](uint8_t b) { encoded.push_back(static_cast<char>(b)); return true; }));
  std::vector<uint8_t> raster;
  size_t offset=2;
  while (encoded.compare(offset,4,std::string("\x1dv0\0",4))==0) {
    const size_t rows=static_cast<uint8_t>(encoded[offset+6]);
    offset+=8;
    raster.insert(raster.end(),encoded.begin()+offset,encoded.begin()+offset+rows*48);
    offset+=rows*48;
  }
  const auto* glyph=printer_font::find('M');
  CHECK(glyph!=nullptr);
  bool allPixelsMatch=true;
  const int height=static_cast<int>(raster.size()/48);
  for (int y=0;y<height;++y) for(int x=0;x<384;++x) {
    bool expected=false;
    for(int line=0;line<2;++line) {
      const int gx=x-(line?16:(384-glyph->advance)/2)-glyph->x;
      const int gy=y-(line?72:16)-glyph->y;
      if(gx>=0&&gx<glyph->width&&gy>=0&&gy<glyph->height)
        expected|=(printer_font::kBitmap[glyph->offset+gy*((glyph->width+7)/8)+gx/8]&(0x80>>(gx%8)))!=0;
    }
    expected|=y==64&&x>=16&&x<368&&(x-16)%8<4;
    allPixelsMatch &= expected == ((raster[y*48+x/8]&(0x80>>(x%8)))!=0);
  }
  CHECK(allPixelsMatch); // Independent glyph positioning across 32-row boundaries.
  struct Canvas {
    int w,h; bool bounds=true; std::vector<uint8_t> bits;
    Canvas(int width,int height):w(width),h(height),bits(width*height,0){}
    void fillRect(int x,int y,int width,int height,uint16_t color) {
      for(int row=y;row<y+height;++row) drawFastHLine(x,row,width,color);
    }
    void drawFastHLine(int x,int y,int width,uint16_t color) {
      if(x<0||y<0||x+width>w||y>=h) { bounds=false;return; }
      for(int col=x;col<x+width;++col) bits[y*w+col]=static_cast<uint8_t>(color);
    }
  } canvas(384,height);
  CHECK(receipt_preview::draw(canvas,text.c_str(),0,0,384,height,0,1));
  bool previewMatches=true;
  for(int y=0;y<height;++y) for(int x=0;x<384;++x)
    previewMatches &= canvas.bits[y*384+x] == ((raster[y*48+x/8]>>(7-x%8))&1);
  CHECK(previewMatches&&canvas.bounds);
  Canvas small(372,204);
  CHECK(receipt_preview::draw(small,"1\n2\n3\n4\n5\n6\n7\n8",0,0,372,204,0,1));
  CHECK(small.bounds);
  robo::PrinterLayout layout;
  CHECK(robo::printerTextLayout("RoboPlanter\nDaily garden check-in\nCheck your plant\nbefore watering.\nCare for your plant.\nTake a little break.\n",layout));
  CHECK(layout.count<=8);
}

void receiptTransport() {
  CHECK(robo::printerTransmitBudgetMs(0, 115200) == 0);
  CHECK(robo::printerTransmitBudgetMs(75001, 115200) == 0);
  CHECK(robo::printerTransmitBudgetMs(1, 9599) == 0);
  CHECK(robo::printerTransmitBudgetMs(1, 1000001) == 0);
  CHECK(robo::printerTransmitBudgetMs(1, 9600) == 5002);
  CHECK(robo::printerTransmitBudgetMs(robo::MaxReceiptWireBytes, 9600) == 30642);
  CHECK(robo::printerTransmitBudgetMs(robo::MaxReceiptWireBytes, 115200) == 7137);
  CHECK(robo::printerTransmitBudgetMs(14000, 1000000) == 5140);
  std::string output;
  const auto append = [&](uint8_t b) { output.push_back(static_cast<char>(b)); return true; };
  const std::string chinese = "\xE5\xB7\xA5\xE4\xBD\x8D\xE8\x8A\xB1\xE5\x9B\xAD";
  const std::string text = "RoboPlanter\n" + chinese + "\nReady!";
  CHECK(robo::writeReceipt(text, append, true));
  const std::string expected = output;
  const std::string cut("\x1b\x64\x06\x1d\x56\x00", 6);
  CHECK(output.substr(output.size()-6) == cut);
  CHECK(output.size() == robo::plannedReceiptBytes(text, true));
  CHECK(output.size() <= robo::MaxReceiptWireBytes);
  CHECK(output.substr(0,2) == "\x1b@");
  // Parse framing independently: no raster width may consume the cutter bytes.
  size_t offset = 2, rows = 0, bands = 0, ink = 0;
  while (offset < output.size()-6) {
    CHECK(output.substr(offset,4) == std::string("\x1d\x76\x30\x00",4));
    const auto byte = [&](size_t i) { return static_cast<unsigned char>(output[offset+i]); };
    const size_t width = byte(4) + 256U*byte(5), height = byte(6) + 256U*byte(7);
    CHECK(width == 48); CHECK(height == 128);
    offset += 8; CHECK(offset+width*height <= output.size()-6);
    for (size_t i=0; i<width*height; ++i) if (output[offset+i]) ++ink;
    offset += width*height; rows += height; ++bands;
  }
  CHECK(offset == output.size()-6); CHECK(rows == 256); CHECK(bands == 2); CHECK(ink > 0);
  output.clear(); CHECK(robo::writeReceipt(text, append));
  CHECK(output == expected.substr(0,expected.size()-3)); // Cutter is opt-in.
  output.clear(); CHECK(robo::writeReceipt(text+"\n", append,true));
  CHECK(output == expected); // Trailing LF terminates the final line.
  const std::vector<std::string> invalid = {std::string(), std::string(161,'x'),
    std::string("cut\x1dV"), std::string("x\0y",3), std::string("\t"), std::string("\r"),
    std::string("\x7f"), std::string("\xc2\x85"), std::string("\x80"), std::string("\xc0\xaf"),
    std::string("\xe0\x80\xaf"), std::string("\xed\xa0\x80"), std::string("\xf0\x9f\x8c\xb1"),
    std::string("\xe4\xb8"), std::string("\xe4\x41\xad"), std::string("\xe2\x98\x83"),
    std::string("1\n2\n3\n4\n5\n6\n7\n8\n9"), std::string(160,'W')};
  for (const auto& bad : invalid) {
    output.clear(); CHECK(!robo::writeReceipt(bad,append,true)); CHECK(output.empty());
    CHECK(!robo::printableText(bad)); CHECK(robo::plannedReceiptBytes(bad,true) == 0);
  }
  robo::PrinterLayout layout;
  CHECK(robo::printerTextLayout("1\n2\n3\n4\n5\n6\n7\n8\n",layout)); CHECK(layout.count == 8);
  CHECK(robo::plannedReceiptBytes("1\n2\n3\n4\n5\n6\n7\n8\n",true) == robo::MaxReceiptWireBytes);
  std::string row;
  for (int i=0;i<11;++i) row += "\xe4\xb8\xad";
  CHECK(robo::printerTextLayout(row,layout)); CHECK(layout.count == 1);
  row += "\xe4\xb8\xad";
  CHECK(robo::printerTextLayout(row,layout)); CHECK(layout.count == 2);
  // Test failures at framing, data, band boundaries, feed and every cutter byte.
  // Sampling avoids an O(ticket_size^2) failure sweep of a raster payload.
  const std::vector<size_t> failures = {0,1,2,9,10,393,394,401,402,
    expected.size()/2,expected.size()-7,expected.size()-6,expected.size()-5,
    expected.size()-4,expected.size()-3,expected.size()-2,expected.size()-1};
  for (size_t failed : failures) {
    output.clear(); size_t calls = 0;
    CHECK(!robo::writeReceipt(text,[&](uint8_t byte) {
      if (calls++ == failed) return false;
      output.push_back(static_cast<char>(byte)); return true;
    },true));
    CHECK(calls == failed+1); CHECK(output == expected.substr(0,failed));
  }
}

}  // namespace

int main() {
  deadlineAndReplay(); wrapAndStop(); validationAndOverflow();
  disabledAndInterlock(); printerAndCalibration(); cacheCapacity();
  lightEffectCommands();
  receiptTransport();
  receiptTypography();
  bleConnectionBoundary(); blePreparedWriteBoundary();
  std::cout << "PASS " << checks << " controller checks\n";
  return 0;
}
