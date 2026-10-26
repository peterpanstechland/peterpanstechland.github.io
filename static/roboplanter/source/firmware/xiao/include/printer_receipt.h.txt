#pragma once
#include "controller.h"

namespace robo {
// Only the firmware emits control codes. User text remains bounded ASCII/LF.
// This first verified revision feeds paper; cutter support is being added.
// A failed write stops immediately; never auto-replay.
template <typename Write>
bool writeReceipt(const std::string& text, Write write) {
  if (!printableText(text)) return false;
  const uint8_t setup[] = {0x1b, '@', 0x1b, '!', 0, 0x1b, 'a', 0, 0x1b, '2'};
  for (uint8_t byte : setup) if (!write(byte)) return false;
  for (unsigned char byte : text) if (!write(byte)) return false;
  if (text.back() != '\n' && !write('\n')) return false;
  for (unsigned i = 0; i < 3; ++i) if (!write('\n')) return false;
  return true;
}
}
