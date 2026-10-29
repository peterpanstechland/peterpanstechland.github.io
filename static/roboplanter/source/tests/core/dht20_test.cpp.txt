#include <array>
#include <cstdlib>
#include <iostream>
#include <vector>
#include "../../firmware/xiao/include/dht20.h"

int checks = 0;
#define CHECK(x) do { ++checks; if (!(x)) { std::cerr << "FAIL " << __LINE__ << '\n'; std::exit(1); } } while (0)
using Result = robo::Dht20Result;
const std::array<uint8_t, 7> valid = {0x18, 0x80, 0, 6, 0, 0, 0x23}; // 50% / 25C

struct Bus {
  std::vector<std::vector<uint8_t>> responses;
  std::vector<unsigned> waits;
  std::vector<uint8_t> command;
  size_t reads = 0;
  bool nack = false;
  bool read(uint8_t* out, size_t n) {
    if (reads >= responses.size()) return false;
    const auto& bytes = responses[reads++];
    if (bytes.size() != n) return false;
    for (size_t i = 0; i < n; ++i) out[i] = bytes[i];
    return true;
  }
  bool write(const uint8_t* p, size_t n) { command.assign(p, p + n); return !nack; }
  void wait(unsigned ms) { waits.push_back(ms); }
};

int main() {
  float t = -999, h = -999;
  CHECK(robo::decodeDht20(valid.data(), 7, t, h) == Result::Ok);
  CHECK(t == 25 && h == 50);
  // Every single-bit corruption in the payload/CRC must be rejected, and must
  // never partially overwrite the caller's previous values.
  for (size_t byte = 0; byte < 7; ++byte) for (int bit = 0; bit < 8; ++bit) {
    auto bad = valid; bad[byte] ^= uint8_t(1 << bit); t = h = -999;
    CHECK(robo::decodeDht20(bad.data(), 7, t, h) != Result::Ok);
    CHECK(t == -999 && h == -999);
  }
  CHECK(robo::decodeDht20(nullptr, 7, t, h) == Result::Transport);
  CHECK(robo::decodeDht20(valid.data(), 6, t, h) == Result::Transport);
  Bus ok; ok.responses = {{0x18}, {valid.begin(), valid.end()}};
  CHECK(robo::readDht20(ok, t, h) == Result::Ok);
  CHECK(ok.command == std::vector<uint8_t>({0xac, 0x33, 0x00}));
  CHECK(ok.waits == std::vector<unsigned>({80}));
  CHECK(t == 25 && h == 50);
  Bus absent; CHECK(robo::readDht20(absent, t, h) == Result::Transport);
  CHECK(absent.command.empty());
  Bus uncal; uncal.responses = {{0x08}};
  CHECK(robo::readDht20(uncal, t, h) == Result::Uncalibrated);
  CHECK(uncal.command.empty());
  Bus busy; busy.responses = {{0x98}};
  CHECK(robo::readDht20(busy, t, h) == Result::Busy);
  CHECK(busy.command.empty());
  Bus nack; nack.responses = {{0x18}}; nack.nack = true;
  CHECK(robo::readDht20(nack, t, h) == Result::Transport);
  CHECK(nack.waits.empty());
  Bus stuck; stuck.responses = {{0x18}};
  for (int i = 0; i < 5; ++i) stuck.responses.push_back({0x98,0,0,0,0,0,0});
  CHECK(robo::readDht20(stuck, t, h) == Result::Busy);
  CHECK(stuck.reads == 6);
  CHECK(stuck.waits == std::vector<unsigned>({80,10,10,10,10}));
  Bus recovery; recovery.responses = {{0x18}, {0x98,0,0,0,0,0,0}, {valid.begin(), valid.end()}};
  CHECK(robo::readDht20(recovery, t, h) == Result::Ok);
  CHECK(recovery.waits == std::vector<unsigned>({80,10}));
  Bus shortRead; shortRead.responses = {{0x18}, {0x18,0,0}};
  CHECK(robo::readDht20(shortRead, t, h) == Result::Transport);
  std::cout << checks << " DHT20 checks passed\n";
}
