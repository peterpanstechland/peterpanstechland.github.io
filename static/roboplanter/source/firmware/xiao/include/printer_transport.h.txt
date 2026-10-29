#pragma once
#include <cstddef>
#include <cstdint>

namespace robo {
// 8N1 consumes ten wire bits per byte. Allow five seconds for rendering and
// scheduling, while retaining a total deadline including the final FIFO drain.
inline uint32_t printerTransmitBudgetMs(size_t wireBytes, uint32_t baud) {
  if (!wireBytes || wireBytes > 75000 || baud < 9600 || baud > 1000000) return 0;
  return static_cast<uint32_t>((static_cast<uint64_t>(wireBytes)*10000+baud-1)/baud+5000);
}
}
