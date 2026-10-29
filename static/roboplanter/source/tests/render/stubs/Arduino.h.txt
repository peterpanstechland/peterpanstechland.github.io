#pragma once
// Host-only Arduino boundaries. No GPIO, network, serial port, or persistence.
#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <type_traits>
#define PROGMEM
#define __attribute__(x)
class __FlashStringHelper;
using String = std::string;
using std::min;
using std::max;
template<class T, class L, class H> T constrain(T value, L lo, H hi) {
  return value < lo ? static_cast<T>(lo) : value > hi ? static_cast<T>(hi) : value;
}
inline uint32_t renderNow = 0;
inline uint32_t millis() { return renderNow; }
inline void delay(uint32_t ms) { renderNow += ms; }
inline void yield() {}
inline size_t strlcpy(char *dst, const char *src, size_t capacity) {
  const size_t length = std::strlen(src);
  if (capacity) { const size_t n = std::min(length, capacity - 1); std::memcpy(dst, src, n); dst[n] = 0; }
  return length;
}
struct RenderSerial {
  unsigned lineCount = 0;
  std::string lastLine;
  void begin(unsigned long) {}
  void println(const char *value) { ++lineCount; lastLine = value ? value : ""; }
  template<class... T> void printf(const char *, T...) {}
};
inline RenderSerial Serial;
struct RenderEsp {
  uint32_t getFlashChipSize() const { return 8U * 1024 * 1024; }
  uint32_t getPsramSize() const { return 8U * 1024 * 1024; }
};
inline RenderEsp ESP;

inline uint32_t esp_random() { return 95U; } // Deterministic UI-only fixture.
