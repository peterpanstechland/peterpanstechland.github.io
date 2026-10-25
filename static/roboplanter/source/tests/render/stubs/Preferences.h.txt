#pragma once
#include <Arduino.h>
class Preferences {
 public:
  bool begin(const char *, bool = false) { return true; }
  uint8_t getUChar(const char *, uint8_t fallback = 0) const { return fallback; }
  size_t putUChar(const char *, uint8_t) { return 1; }
};
