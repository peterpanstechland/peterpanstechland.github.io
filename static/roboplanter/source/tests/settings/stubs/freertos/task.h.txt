#pragma once
#include "FreeRTOS.h"
using TaskFunction_t = void (*)(void *);
inline bool settingsTestTaskFail = false;
inline TaskFunction_t settingsTestTask = nullptr;
inline unsigned settingsTestTaskCreates = 0;
inline BaseType_t xTaskCreatePinnedToCore(TaskFunction_t fn, const char *, uint32_t,
                                        void *, unsigned, void *, unsigned) {
  ++settingsTestTaskCreates;
  if (settingsTestTaskFail) return pdFALSE;
  settingsTestTask = fn; return pdPASS;
}
struct SettingsTestEndIteration {};
inline void vTaskDelay(uint32_t) { throw SettingsTestEndIteration{}; }
