#pragma once
#include "FreeRTOS.h"
#include <mutex>
using SemaphoreHandle_t = std::mutex *;
inline unsigned settingsTestMutexCreates = 0, settingsTestFailMutexOn = 0, settingsTestLiveMutexes = 0;
inline SemaphoreHandle_t xSemaphoreCreateMutex() {
  if (++settingsTestMutexCreates == settingsTestFailMutexOn) return nullptr;
  ++settingsTestLiveMutexes; return new std::mutex;
}
inline void vSemaphoreDelete(SemaphoreHandle_t lock) { delete lock; --settingsTestLiveMutexes; }
inline BaseType_t xSemaphoreTake(SemaphoreHandle_t lock, uint32_t) { lock->lock(); return pdTRUE; }
inline BaseType_t xSemaphoreGive(SemaphoreHandle_t lock) { lock->unlock(); return pdTRUE; }
