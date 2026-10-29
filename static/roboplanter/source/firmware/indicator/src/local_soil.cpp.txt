#include "local_soil.h"
#include "config.h"
#include "soil_wire.h"
#include <esp_system.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/task.h>

namespace {
HardwareSerial rpUart(2);
SemaphoreHandle_t soilLock=nullptr;
local_soil::Sample current;
bool chimePending=false;
void worker(void*) {
  // Original Indicator internal wiring: ESP RX20/TX19 <-> RP TX16/RX17.
  rpUart.begin(115200,SERIAL_8N1,20,19);
  for(;;) {
    xSemaphoreTake(soilLock,portMAX_DELAY);
    const bool chime=chimePending;chimePending=false;
    xSemaphoreGive(soilLock);
    if(chime)rpUart.print("B|focus\n");
    while(rpUart.available())rpUart.read();
    const uint32_t nonce=esp_random();
    rpUart.printf("S|%08lx\n",static_cast<unsigned long>(nonce));
    char line[49]={};size_t used=0;bool overflow=false;
    const uint32_t start=millis();
    while(millis()-start<250) {
      if(!rpUart.available()){vTaskDelay(pdMS_TO_TICKS(2));continue;}
      const char c=char(rpUart.read());
      if(c=='\n') {
        line[used]=0;int raw=-1;
        if(!overflow && soil_wire::parse(line,nonce,raw)) {
          xSemaphoreTake(soilLock,portMAX_DELAY);
          current.raw=raw;current.valid=true;current.receivedMs=millis();++current.sequence;
          const uint32_t sequence=current.sequence;
          xSemaphoreGive(soilLock);
          if(sequence%10==1)Serial.printf("Indicator local soil: raw=%d sequence=%lu\n",raw,static_cast<unsigned long>(sequence));
          break;
        }
        used=0;overflow=false;
      }else if(c!='\r') {
        if(used<sizeof(line)-1)line[used++]=c;else overflow=true;
      }
    }
    vTaskDelay(pdMS_TO_TICKS(500));
  }
}
}
namespace local_soil {
bool notifyFocusComplete() {
  if(!soilLock)return false;
  xSemaphoreTake(soilLock,portMAX_DELAY);chimePending=true;xSemaphoreGive(soilLock);return true;
}
bool begin() {
  if(!PLANTER_ENABLE_LOCAL_SOIL)return true;
  soilLock=xSemaphoreCreateMutex();
  snprintf(current.boot,sizeof current.boot,"%08lx",static_cast<unsigned long>(esp_random()));
  if(soilLock && xTaskCreate(worker,"rp-soil",4096,nullptr,1,nullptr)==pdPASS)return true;
  if(soilLock)vSemaphoreDelete(soilLock);
  soilLock=nullptr;return false;
}
Sample snapshot() {
  if(!soilLock)return Sample();
  xSemaphoreTake(soilLock,portMAX_DELAY);Sample out=current;xSemaphoreGive(soilLock);
  out.valid=out.valid && millis()-out.receivedMs<=1500;return out;
}
}
