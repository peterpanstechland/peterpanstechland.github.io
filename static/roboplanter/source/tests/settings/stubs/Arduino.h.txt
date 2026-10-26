#pragma once
#include <cstdint>
#include <cstring>
#include <string>
inline uint32_t settingsTestNow = 0;
inline uint32_t millis() { return settingsTestNow; }
inline size_t strlcpy(char *target, const char *source, size_t capacity) {
  const size_t size = std::strlen(source);
  if (capacity) { const size_t copied = size < capacity - 1 ? size : capacity - 1; std::memcpy(target, source, copied); target[copied] = 0; }
  return size;
}
using String = std::string;
struct SettingsTestSerial {
  template <typename... Args> void printf(const char *, Args...) {}
};
inline SettingsTestSerial Serial;
