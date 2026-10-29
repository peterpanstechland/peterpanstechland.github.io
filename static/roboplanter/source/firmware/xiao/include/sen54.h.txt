#pragma once
#include <cstddef>
#include <cstdint>
#include <cmath>

namespace robo {
// SEN5x protocol: address 0x69, CRC per 16-bit word. SEN54 has no NOx channel.
// Reference: Sensirion/arduino-i2c-sen5x (signed invalid = 0x7fff).
struct Sen54Sample {
  float pm1 = NAN, pm25 = NAN, pm4 = NAN, pm10 = NAN;
  float temperature = NAN, humidity = NAN, voc = NAN;
};
inline uint8_t sen54Crc(const uint8_t* data) {
  uint8_t crc = 0xff;
  for (unsigned i = 0; i < 2; ++i) {
    crc ^= data[i];
    for (unsigned bit = 0; bit < 8; ++bit)
      crc = (crc & 0x80) ? uint8_t((crc << 1) ^ 0x31) : uint8_t(crc << 1);
  }
  return crc;
}
inline bool decodeSen54(const uint8_t* data, size_t size, Sen54Sample& out) {
  out = Sen54Sample{};
  if (!data || size != 24) return false;
  uint16_t words[8];
  for (unsigned i = 0; i < 8; ++i) {
    if (sen54Crc(data + i * 3) != data[i * 3 + 2]) return false;
    words[i] = uint16_t(data[i * 3]) * 256 + data[i * 3 + 1];
  }
  auto pm = [](uint16_t v) { return v == 0xffff || v > 10000 ? NAN : v / 10.0f; };
  auto signedValue = [](uint16_t v, float scale) {
    const int32_t signedWord = v < 0x8000 ? int32_t(v) : int32_t(v) - 65536;
    return v == 0x7fff ? NAN : signedWord / scale;
  };
  out.pm1 = pm(words[0]); out.pm25 = pm(words[1]);
  out.pm4 = pm(words[2]); out.pm10 = pm(words[3]);
  out.humidity = signedValue(words[4], 100);
  out.temperature = signedValue(words[5], 200);
  out.voc = signedValue(words[6], 10);
  if (out.humidity < 0 || out.humidity > 100) out.humidity = NAN;
  if (out.temperature < -40 || out.temperature > 85) out.temperature = NAN;
  // VOC index 0 is startup/blackout, not evidence of clean air.
  if (out.voc < 1 || out.voc > 500) out.voc = NAN;
  return true;
}
enum class Sen54Result { Ok, NotReady, Transport, Crc };
template<class Bus> Sen54Result readSen54(Bus& bus, Sen54Sample& out) {
  out = Sen54Sample{};
  uint8_t ready[3];
  if (!bus.command(0x0202, 20) || !bus.read(ready, sizeof(ready))) return Sen54Result::Transport;
  if (sen54Crc(ready) != ready[2]) return Sen54Result::Crc;
  if (ready[0] != 0 || ready[1] != 1) return Sen54Result::NotReady;
  uint8_t frame[24];
  if (!bus.command(0x03c4, 20) || !bus.read(frame, sizeof(frame))) return Sen54Result::Transport;
  return decodeSen54(frame, sizeof(frame), out) ? Sen54Result::Ok : Sen54Result::Crc;
}
} // namespace robo
