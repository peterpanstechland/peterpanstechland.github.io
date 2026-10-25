#pragma once
#include "FreeRTOS.h"
#include <cstring>
#include <vector>
struct TestQueue { explicit TestQueue(size_t size) : data(size) {} std::vector<uint8_t> data; bool occupied = false; };
using QueueHandle_t = TestQueue *;
inline unsigned settingsTestQueueCreates = 0, settingsTestFailQueueOn = 0, settingsTestLiveQueues = 0;
inline QueueHandle_t xQueueCreate(size_t, size_t size) {
  if (++settingsTestQueueCreates == settingsTestFailQueueOn) return nullptr;
  ++settingsTestLiveQueues; return new TestQueue(size);
}
inline void vQueueDelete(QueueHandle_t queue) { delete queue; --settingsTestLiveQueues; }
inline BaseType_t xQueueOverwrite(QueueHandle_t queue, const void *value) { std::memcpy(queue->data.data(), value, queue->data.size()); queue->occupied = true; return pdTRUE; }
inline BaseType_t xQueueSend(QueueHandle_t queue, const void *value, uint32_t) {
  return queue->occupied ? pdFALSE : xQueueOverwrite(queue, value);
}
inline size_t uxQueueMessagesWaiting(QueueHandle_t queue) { return queue->occupied ? 1 : 0; }
inline BaseType_t xQueueReceive(QueueHandle_t queue, void *out, uint32_t) {
  if (!queue->occupied) return pdFALSE;
  std::memcpy(out, queue->data.data(), queue->data.size()); queue->occupied = false; return pdTRUE;
}
inline void xQueueReset(QueueHandle_t queue) { queue->occupied = false; }
