#pragma once
#include <cstddef>
#include <cstdint>
using BaseType_t = int;
constexpr BaseType_t pdTRUE = 1, pdFALSE = 0;
constexpr BaseType_t pdPASS = 1;
constexpr uint32_t portMAX_DELAY = 0xffffffffU;
inline uint32_t pdMS_TO_TICKS(uint32_t value) { return value; }
