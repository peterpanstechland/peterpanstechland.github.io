#pragma once
#include "planter_client.h"
#include "device_settings.h"
#include <cstring>
#include <cmath>

namespace planter_presentation {
inline int snapshotValue(const planter::Reading& reading,int scale,int low,int high) {
  if(!reading.valid || !std::isfinite(reading.value))return -9999;
  const float value=reading.value*scale;
  if(value<low || value>high)return -9999;
  return static_cast<int>(std::lround(value));
}
template<class Random>
inline planter::PrintReceipt dailyReceipt(const planter::State& s,bool english,int species,Random random) {
  planter::PrintReceipt out;
  out.isDaily=true;out.requiresRaster=true;
  out.daily.english=english;out.daily.species=species;
  out.daily.soil=s.soilCalibrationKnown&&s.soilCalibrated?snapshotValue(s.soilPercent,1,0,100):-9999;
  out.daily.raw=snapshotValue(s.soilRaw,1,0,4095);
  out.daily.temperature=snapshotValue(s.temperature,10,-400,850);
  out.daily.humidity=snapshotValue(s.humidity,1,0,100);
  robo::drawDailyCard(out.daily,random);
  return out;
}
// The bytes displayed in the confirmation page are copied into the command
// queue. Neither a language change nor a later capability poll rewrites them.
inline planter::PrintReceipt receipt(const planter::State &state, bool english) {
  constexpr char zh[] = "工位盆栽\n今日花园签到\n先看植物，再决定浇水。\n照料植物，也记得休息。\n";
  constexpr char en[] = "RoboPlanter\nDaily garden check-in\nCheck your plant\nbefore watering.\nCare for your plant.\nTake a little break.\n";
  static_assert(sizeof(zh) <= 161 && sizeof(en) <= 161, "Receipt exceeds device byte limit");
  planter::PrintReceipt out;
  out.requiresRaster = !english && state.printerRaster;
  out.layout32 = state.printerLayout32;
  strcpy(out.text, out.requiresRaster ? zh : en);
  return out;
}

enum class Link : uint8_t { Ready, Unavailable, Offline, WrongNetwork, Authentication, Configuration, NoResponse, InvalidState, Stale };
inline Link link(const planter::State &state, const device_settings::WifiSnapshot &wifi, uint32_t now, bool ready = true) {
  if (!ready || !wifi.ready) return Link::Unavailable;
  if (wifi.phase != device_settings::WifiPhase::Connected) return Link::Offline;
  if (!wifi.planterNetwork) return Link::WrongNetwork;
  switch (state.networkFailure) {
    case planter::NetworkFailure::Authentication: return Link::Authentication;
    case planter::NetworkFailure::Configuration: return Link::Configuration;
    case planter::NetworkFailure::InvalidState: return Link::InvalidState;
    case planter::NetworkFailure::Http: return Link::NoResponse;
    default: break;
  }
  if (!state.received || !state.wifi) return Link::NoResponse;
  return planter::fresh(state, now) ? Link::Ready : Link::Stale;
}
inline const char *linkText(Link status, bool english) {
  switch (status) {
    case Link::Ready: return english ? "Planter connected" : "花盆已连接";
    case Link::Unavailable: return english ? "Connection not ready" : "连接服务未就绪";
    case Link::Offline: return english ? "Connect Wi-Fi first" : "请先连接无线网络";
    case Link::WrongNetwork: return english ? "Use paired Wi-Fi" : "请连接已配对网络";
    case Link::Authentication: return english ? "Pairing token rejected" : "配对认证失败";
    case Link::Configuration: return english ? "Check planter address" : "请检查花盆地址";
    case Link::InvalidState: return english ? "Update planter firmware" : "请更新花盆固件";
    case Link::Stale: return english ? "Waiting for fresh data" : "等待新的花盆读数";
    default: return english ? "Planter not responding" : "花盆暂未响应";
  }
}
}
