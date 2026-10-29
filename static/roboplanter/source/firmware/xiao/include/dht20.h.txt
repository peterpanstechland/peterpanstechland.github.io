#pragma once

#include <cstddef>
#include <cstdint>

namespace robo {
// Aosong DHT20: 7-bit address 0x38, AC 33 00 single measurement,
// 80 ms conversion, six data bytes followed by CRC-8 (poly 0x31, init 0xff).
// https://wiki.seeedstudio.com/Grove-Temperature-Humidity-Sensor-DH20/
// The bus adapter must bound each I2C transfer (30 ms in the ESP32 adapter).
enum class Dht20Result { Ok, Transport, Busy, Uncalibrated, Crc, Range };

inline Dht20Result decodeDht20(const uint8_t* bytes, size_t count,
                              float& temperature, float& humidity) {
  if (!bytes || count != 7) return Dht20Result::Transport;
  if (bytes[0] & 0x80) return Dht20Result::Busy;
  if ((bytes[0] & 0x18) != 0x18) return Dht20Result::Uncalibrated;
  uint8_t crc = 0xff;
  for (size_t i = 0; i < 6; ++i) {
    crc ^= bytes[i];
    for (int bit = 0; bit < 8; ++bit)
      crc = (crc & 0x80) ? static_cast<uint8_t>((crc << 1) ^ 0x31)
                         : static_cast<uint8_t>(crc << 1);
  }
  if (crc != bytes[6]) return Dht20Result::Crc;
  const uint32_t rh = (uint32_t(bytes[1]) << 12) |
                      (uint32_t(bytes[2]) << 4) | (bytes[3] >> 4);
  const uint32_t t = (uint32_t(bytes[3] & 0x0f) << 16) |
                     (uint32_t(bytes[4]) << 8) | bytes[5];
  const float celsius = t * (200.0f / 1048576.0f) - 50.0f;
  const float percent = rh * (100.0f / 1048576.0f);
  if (celsius < -40 || celsius > 80) return Dht20Result::Range;
  temperature = celsius;
  humidity = percent;
  return Dht20Result::Ok;
}

template <typename Bus>
Dht20Result readDht20(Bus& bus, float& temperature, float& humidity) {
  // 0x71 is the on-wire address + read bit, NOT a register command.
  uint8_t status = 0;
  if (!bus.read(&status, 1)) return Dht20Result::Transport;
  if (status & 0x80) return Dht20Result::Busy;
  // Do not substitute AHT10/DHT10 initialization commands. Factory-calibrated
  // units should report 0x18; an unready unit stays invalid for diagnosis.
  if ((status & 0x18) != 0x18) return Dht20Result::Uncalibrated;
  const uint8_t trigger[] = {0xac, 0x33, 0x00};
  if (!bus.write(trigger, sizeof(trigger))) return Dht20Result::Transport;
  bus.wait(80);
  for (unsigned attempt = 0; attempt < 5; ++attempt) {
    uint8_t frame[7];
    if (!bus.read(frame, sizeof(frame))) return Dht20Result::Transport;
    const auto result = decodeDht20(frame, sizeof(frame), temperature, humidity);
    if (result != Dht20Result::Busy) return result;
    if (attempt < 4) bus.wait(10);
  }
  return Dht20Result::Busy;
}
}  // namespace robo
