#include <cassert>
#include <iostream>
#include <vector>
#include "../../firmware/xiao/include/controller.h"
#include "../../firmware/xiao/include/auto_light_json.h"
struct Storage {
  std::vector<uint8_t> bytes; bool fail=false,corrupt=false;
  size_t putBytes(const char*,const void* p,size_t n) { if(fail)return 0;auto b=static_cast<const uint8_t*>(p);bytes.assign(b,b+n);if(corrupt)bytes.back()^=1;return n; }
  size_t getBytesLength(const char*) { return bytes.size(); }
  size_t getBytes(const char*,void* p,size_t n) { if(n!=bytes.size())return 0;memcpy(p,bytes.data(),n);return n; }
};
int main() {
  using namespace robo;
  AutoLightSettings s;s.enabled=true;
  AutoLight automatic;automatic.configure(s);
  assert(automatic.sample(1000,true,0,false)==-1);
  assert(automatic.sample(1000,true,0,false)==-1); // repeated snapshot is not a new sample
  assert(automatic.sample(1000,true,1000,false)==-1);
  assert(automatic.sample(1000,true,2000,false)==1);
  for(int raw:{1201,1500,1799})assert(automatic.sample(raw,true,3000,true)==-1);
  assert(automatic.sample(2000,true,4000,true)==-1);
  assert(automatic.sample(1500,true,5000,true)==-1); // noise interrupts the off candidate
  assert(automatic.sample(2000,true,6000,true)==-1);
  assert(automatic.sample(2000,true,7000,true)==-1);
  assert(automatic.sample(2000,true,8000,true)==0);
  assert(!automatic.shouldFailOff(11000));assert(automatic.shouldFailOff(11001));
  automatic.pause();assert(!automatic.shouldFailOff(20000));assert(automatic.sample(1000,true,20000,false)==-1);
  automatic.configure(s);assert(!automatic.paused());assert(automatic.sample(-1,true,10,true)==0);
  automatic.configure(s);assert(automatic.sample(1000,true,10,false)==-1);
  assert(automatic.sample(1000,true,10000,false)==-1); // long gap starts a new dwell
  assert(automatic.sample(1000,true,11000,false)==-1);assert(automatic.sample(1000,true,12000,false)==1);
  automatic.configure(s);automatic.sample(1000,true,UINT32_MAX-999,false);
  automatic.sample(1000,true,0,false);assert(automatic.sample(1000,true,1000,false)==1);
  s.enabled=false;automatic.configure(s);assert(automatic.sample(0,true,0,false)==-1);
  for(int v:{-1,4096,INT32_MIN,INT32_MAX}) { s.onBelow=v;assert(!s.valid()); }
  s.onBelow=1200;s.offAbove=1263;assert(!s.valid());s.offAbove=1264;assert(s.valid());
  s.offAbove=1800;s.enabled=true;s.revision=9;
  const auto record=encodeAutoLight(s);AutoLightSettings restored;
  assert(decodeAutoLight(record,restored)&&sameAutoLight(s,restored));
  for(unsigned i=0;i<7;++i) { auto corrupt=record;corrupt.words[i]^=1;assert(!decodeAutoLight(corrupt,restored)); }
  Storage storage;assert(saveAutoLight(storage,s));storage.fail=true;assert(!saveAutoLight(storage,s));storage.fail=false;storage.corrupt=true;assert(!saveAutoLight(storage,s));
  for(const char* body:{R"({"revision":0,"enabled":true,"on_below":1200,"off_above":1800})"}) {
    StaticJsonDocument<256> doc;assert(!deserializeJson(doc,body));assert(parseAutoLight(doc.as<JsonVariantConst>(),restored));
  }
  for(const char* body:{R"({"revision":true,"enabled":true,"on_below":1200,"off_above":1800})",R"({"revision":0,"enabled":1,"on_below":1200,"off_above":1800})",R"({"revision":0,"enabled":true,"on_below":1800,"off_above":1200})",R"({"revision":0,"enabled":true,"on_below":1200.5,"off_above":1800})",R"({"revision":0,"enabled":true,"on_below":1200,"off_above":1800,"extra":0})"}) {
    StaticJsonDocument<256> doc;assert(!deserializeJson(doc,body));assert(!parseAutoLight(doc.as<JsonVariantConst>(),restored));
  }
  Config config;config.actionsEnabled=config.credentialsConfigured=config.lightEnabled=config.pumpEnabled=true;
  Controller controller(config);controller.finishLightSettings(s);
  controller.updateAmbient(800,true,0);controller.updateAmbient(800,true,1000);controller.updateAmbient(800,true,2000);assert(controller.lightOn());
  Command manual;manual.action="light";manual.requestId="manual-off";manual.hasOn=true;manual.on=false;
  assert(controller.submit(manual,2100).ok);assert(controller.autoLight().paused());
  controller.updateAmbient(100,true,3000);controller.updateAmbient(100,true,4000);controller.updateAmbient(100,true,5000);assert(!controller.lightOn());
  assert(controller.beginLightSettings());
  Command water;water.action="water";water.requestId="blocked-save";water.hasDuration=true;water.durationMs=500;
  assert(controller.submit(water,5100).error=="light_settings_busy");
  manual.requestId="blocked-light";assert(controller.submit(manual,5100).error=="light_settings_busy");
  assert(!controller.beginCalibration());controller.finishLightSettings(s);
  manual.requestId="manual-off";assert(controller.submit(manual,5200).duplicate);assert(!controller.autoLight().paused());
  controller.updateAmbient(800,true,6000);controller.updateAmbient(800,true,7000);controller.updateAmbient(800,true,8000);assert(controller.lightOn());
  controller.tick(11001);assert(!controller.lightOn());
  water.requestId="water-ready";assert(controller.submit(water,12000).ok);assert(!controller.beginLightSettings());
  controller.tick(12500);assert(!controller.pumpOn());
  std::cout<<"PASS: auto-light hysteresis, dwell, stale data, manual priority, persistence, strict JSON and pump interlock\n";
}
