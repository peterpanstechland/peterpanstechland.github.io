#pragma once
#include <cstdint>
#include <cstring>

namespace robo {
// One soil read only, RAM-only, and at most ten minutes. This key is never
// accepted by the HTTP API or any actuator command.
class DiagnosticReadSession {
 public:
  bool start(const char* token, uint32_t ttl, uint32_t now) {
    if(!token || std::strlen(token)!=16 || ttl<1000 || ttl>600000)return false;
    for(unsigned i=0;i<16;++i)
      if(!((token[i]>='0'&&token[i]<='9') || (token[i]>='a'&&token[i]<='f')))return false;
    clear();std::memcpy(token_,token,16);ttl_=ttl;started_=now;active_=true;return true;
  }
  bool take(const char* token, uint32_t now) {
    if(!active_ || uint32_t(now-started_)>=ttl_){clear();return false;}
    if(!token || std::strlen(token)!=16)return false;
    uint8_t difference=0;
    for(unsigned i=0;i<16;++i)difference|=uint8_t(token_[i]^token[i]);
    if(difference)return false;
    clear();return true;
  }
  void clear() {
    volatile char* p=token_;
    for(unsigned i=0;i<sizeof token_;++i)p[i]=0;
    started_=ttl_=0;active_=false;
  }
 private:
  char token_[17]={};uint32_t started_=0,ttl_=0;bool active_=false;
};
}
