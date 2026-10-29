#pragma once
#include <cstdint>
#include <cstring>
namespace robo {
struct AutoLightSettings {
  uint32_t revision = 0;
  bool enabled = false;
  int onBelow = 1200, offAbove = 1800;
  bool valid() const { return onBelow >= 0 && onBelow <= 4095 && offAbove >= 0 && offAbove <= 4095 && offAbove - onBelow >= 64; }
};
inline bool sameAutoLight(const AutoLightSettings& a, const AutoLightSettings& b) {
  return a.revision == b.revision && a.enabled == b.enabled && a.onBelow == b.onBelow && a.offAbove == b.offAbove;
}
struct AutoLightRecord { uint32_t words[7] = {}; };
inline uint32_t autoLightChecksum(const AutoLightRecord& r) {
  uint32_t h = 2166136261u;
  for (unsigned i=0; i<6; ++i) for(unsigned shift=0; shift<32; shift+=8) h=(h^((r.words[i]>>shift)&255u))*16777619u;
  return h;
}
inline AutoLightRecord encodeAutoLight(const AutoLightSettings& s) {
  AutoLightRecord r;
  r.words[0]=0x52504c31; r.words[1]=1; r.words[2]=s.revision;
  r.words[3]=s.enabled?1:0; r.words[4]=uint32_t(s.onBelow); r.words[5]=uint32_t(s.offAbove);
  r.words[6]=autoLightChecksum(r); return r;
}
inline bool decodeAutoLight(const AutoLightRecord& r, AutoLightSettings& s) {
  if(r.words[0]!=0x52504c31 || r.words[1]!=1 || r.words[3]>1 || r.words[4]>4095 || r.words[5]>4095 || r.words[6]!=autoLightChecksum(r))return false;
  AutoLightSettings next; next.revision=r.words[2]; next.enabled=r.words[3]!=0; next.onBelow=int(r.words[4]); next.offAbove=int(r.words[5]);
  if(!next.valid())return false;
  s=next; return true;
}
template<class Storage> bool saveAutoLight(Storage& storage, const AutoLightSettings& s) {
  if(!s.valid())return false;
  const auto record=encodeAutoLight(s); AutoLightRecord readback;
  return storage.putBytes("values",&record,sizeof(record))==sizeof(record) &&
    storage.getBytesLength("values")==sizeof(record) && storage.getBytes("values",&readback,sizeof(readback))==sizeof(readback) &&
    !memcmp(&record,&readback,sizeof(record));
}
// ADC grows with brightness. Three consecutive 1 Hz samples and a two-second
// dwell prevent flicker; the gap between thresholds provides hysteresis.
class AutoLight {
 public:
  const AutoLightSettings& settings() const { return settings_; }
  bool paused() const { return paused_; }
  void configure(const AutoLightSettings& settings) { settings_=settings; paused_=false; count_=0; sampled_=false; }
  void pause() { if(settings_.enabled)paused_=true; count_=0; }
  int sample(int raw, bool valid, uint32_t now, bool on) {
    const bool continuous=sampled_ && uint32_t(now-sampledAt_)<=3000;
    const bool duplicate=sampled_ && now==sampledAt_;
    sampled_=true; sampledAt_=now; valid_=valid && raw>=0 && raw<=4095;
    if(!settings_.enabled || paused_) { count_=0; return -1; }
    if(!valid_) { count_=0; return 0; }
    if(duplicate)return -1;
    const bool requested = on ? raw>=settings_.offAbove : raw<=settings_.onBelow;
    if(!requested) { count_=0; return -1; }
    const bool target=!on;
    if(!continuous || !count_ || target_!=target) { target_=target; started_=now; count_=1; }
    else if(count_<3)++count_;
    if(count_>=3 && uint32_t(now-started_)>=2000) { count_=0; return target?1:0; }
    return -1;
  }
  bool stale(uint32_t now) const { return !sampled_ || !valid_ || uint32_t(now-sampledAt_)>3000; }
  bool shouldFailOff(uint32_t now) const { return settings_.enabled && !paused_ && stale(now); }
 private:
  AutoLightSettings settings_;
  bool paused_=false, sampled_=false, valid_=false, target_=false;
  unsigned count_=0;
  uint32_t sampledAt_=0, started_=0;
};
}
