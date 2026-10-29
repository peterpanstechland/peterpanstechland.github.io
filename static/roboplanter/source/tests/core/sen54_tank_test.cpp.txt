#include <cassert>
#include <cmath>
#include <iostream>
#include <cstring>
#include "../../firmware/xiao/include/sen54.h"
#include "../../firmware/xiao/include/controller.h"

void frame(uint8_t* out, const uint16_t* words) {
  for (unsigned i=0;i<8;++i) {
    out[3*i]=uint8_t(words[i]>>8);out[3*i+1]=uint8_t(words[i]);
    out[3*i+2]=robo::sen54Crc(out+3*i);
  }
}
struct Bus {
  uint16_t last=0; bool fail=false, ready=true; uint8_t data[24]{};
  bool command(uint16_t c,unsigned ms) { assert(ms==20);last=c;return !fail; }
  bool read(uint8_t* out,size_t n) {
    if(fail)return false;
    if(last==0x0202){assert(n==3);out[0]=0;out[1]=ready?1:0;out[2]=robo::sen54Crc(out);}
    else {assert(last==0x03c4&&n==24);memcpy(out,data,n);}
    return true;
  }
};
robo::Command water(const char* id) {
  robo::Command c;c.requestId=id;c.action="water";c.hasDuration=true;c.durationMs=5000;return c;
}
int main() {
  const uint8_t crcVector[]={0xbe,0xef};assert(robo::sen54Crc(crcVector)==0x92);
  uint8_t bytes[24];uint16_t words[]={101,123,150,201,5025,uint16_t(-1000),1000,0x7fff};
  frame(bytes,words);robo::Sen54Sample sample;
  assert(robo::decodeSen54(bytes,24,sample));
  assert(std::abs(sample.pm25-12.3f)<0.001f&&sample.temperature==-5&&sample.humidity==50.25f&&sample.voc==100);
  for(unsigned i=0;i<24;++i){bytes[i]^=1;assert(!robo::decodeSen54(bytes,24,sample));bytes[i]^=1;}
  assert(!robo::decodeSen54(bytes,23,sample));
  words[0]=words[1]=0xffff;words[4]=words[5]=words[6]=0x7fff;frame(bytes,words);
  assert(robo::decodeSen54(bytes,24,sample)&&std::isnan(sample.pm25)&&std::isnan(sample.humidity)&&std::isnan(sample.temperature)&&std::isnan(sample.voc));
  words[6]=0;frame(bytes,words);assert(robo::decodeSen54(bytes,24,sample)&&std::isnan(sample.voc));
  Bus bus;memcpy(bus.data,bytes,24);assert(robo::readSen54(bus,sample)==robo::Sen54Result::Ok);
  bus.ready=false;assert(robo::readSen54(bus,sample)==robo::Sen54Result::NotReady);
  bus.fail=true;assert(robo::readSen54(bus,sample)==robo::Sen54Result::Transport);
  assert(robo::ultrasonicDistanceMm(0)==-1&&robo::ultrasonicDistanceMm(100)==-1);
  assert(robo::ultrasonicDistanceMm(1000)==170&&robo::ultrasonicDistanceMm(25000)==-1);
  robo::Config cfg;cfg.actionsEnabled=cfg.credentialsConfigured=cfg.pumpEnabled=true;
  cfg.maxWaterMs=5000;cfg.tankRequired=true;
  robo::Controller uncalibrated(cfg);uncalibrated.updateTank(100,0);
  assert(uncalibrated.submit(water("uncalibrated"),1).error=="tank_uncalibrated");
  cfg.tankCalibration.fullMm=50;cfg.tankCalibration.emptyMm=250;cfg.tankCalibration.stopMm=220;
  assert(robo::tankLevelPercent(150,cfg.tankCalibration)==50);
  robo::Controller c(cfg);
  assert(c.submit(water("no-sensor"),0).error=="tank_unavailable");
  c.updateTank(150,10);assert(c.submit(water("start"),11).ok&&c.pumpOn());
  c.updateTank(220,100);assert(!c.pumpOn());robo::Result result;
  assert(c.lookup("start",result)&&!result.ok&&result.error=="tank_low");
  c.updateTank(150,200);assert(c.submit(water("start"),201).duplicate&&!c.pumpOn());
  assert(c.submit(water("fresh"),202).ok);c.tick(3201);assert(!c.pumpOn());
  assert(c.lookup("fresh",result)&&result.error=="tank_unavailable");
  c.updateTank(10,4000);assert(c.submit(water("bad-echo"),4001).error=="tank_unavailable");
  c.updateTank(40,4002);assert(c.submit(water("obstruction"),4003).error=="tank_out_of_range");
  c.updateTank(150,4004);assert(c.submit(water("disconnect"),4005).ok);
  c.updateTank(-1,4006);assert(!c.pumpOn());
  robo::TankGuard guard(cfg.tankCalibration);guard.update(100,UINT32_MAX-1000);
  assert(!*guard.error(500));assert(!strcmp(guard.error(2001),"tank_unavailable"));
  std::cout<<"SEN54 frame/transport and tank interlock tests passed\n";
}
