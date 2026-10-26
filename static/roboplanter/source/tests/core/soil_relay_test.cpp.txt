#include "../../firmware/xiao/include/remote_soil.h"
#include "../../firmware/indicator/include/soil_wire.h"
#include <cassert>
#include <string>
#include <iostream>

std::string frame(const std::string& body) {
  char suffix[6];std::snprintf(suffix,sizeof suffix,"*%04x",soil_wire::crc(body.c_str(),body.size()));
  return body+suffix;
}
int main() {
  assert(soil_wire::crc("123456789",9)==0x29b1);
  int raw=-1;
  const auto good=frame("R|0123abcd|2500");
  assert(soil_wire::parse(good.c_str(),0x0123abcd,raw) && raw==2500);
  assert(!soil_wire::parse(good.c_str(),0x0123abce,raw));
  auto corrupt=good;corrupt[12]='9';assert(!soil_wire::parse(corrupt.c_str(),0x0123abcd,raw));
  for(const auto& body:{"R|0123abcd|4096","R|0123abcd|-1","R|0123abcd|+1","R|0123abcd|4294967296","R|0123abcd|","R|0123ABCD|2500"})
    assert(!soil_wire::parse(frame(body).c_str(),0x0123abcd,raw));
  assert(soil_wire::parse(frame("R|0123abcd|0").c_str(),0x0123abcd,raw) && raw==0);
  assert(soil_wire::parse(frame("R|0123abcd|4095").c_str(),0x0123abcd,raw) && raw==4095);
  robo::RemoteSoil relay;
  assert(!relay.valid(0) && relay.raw()==-1);
  assert(!relay.accept("short",1,2500,0,0));
  assert(!relay.accept("0123ABCD",1,2500,0,0));
  assert(!relay.accept("0123abcd",0,2500,0,0));
  assert(!relay.accept("0123abcd",1,-1,0,0));
  assert(!relay.accept("0123abcd",1,4096,0,0));
  assert(!relay.accept("0123abcd",1,2500,1501,0));
  assert(relay.accept("0123abcd",1,2500,100,1000));
  assert(relay.valid(2400) && !relay.valid(2401));
  assert(!relay.accept("0123abcd",1,2500,0,2401));
  assert(!relay.valid(2401));
  assert(relay.accept("0123abcd",2,1600,0,2500) && relay.valid(2500));
  assert(relay.accept("ffffffff",1,0,0,0xffffff00));
  assert(relay.valid(0x100) && relay.age(0x100)==2012);
  assert(!relay.valid(0x1000));
  std::cout << "soil wire and relay checks passed\n";
}
