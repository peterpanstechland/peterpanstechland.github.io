#pragma once
#include <Arduino.h>
class Print {
 public:
  virtual ~Print() = default;
  virtual size_t write(uint8_t) = 0;
  size_t write(const uint8_t *data, size_t count) {
    size_t written = 0;
    while (count--) written += write(*data++);
    return written;
  }
};
