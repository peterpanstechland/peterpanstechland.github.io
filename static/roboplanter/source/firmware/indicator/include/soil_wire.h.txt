#pragma once
#include <cstdint>
#include <cstdio>
#include <cstring>
namespace soil_wire {
inline uint16_t crc(const char* text, size_t n) {
  uint16_t value=0xffff;
  for(size_t i=0;i<n;++i) {
    value^=uint16_t(uint8_t(text[i]))<<8;
    for(unsigned bit=0;bit<8;++bit)value=(value&0x8000)?uint16_t((value<<1)^0x1021):uint16_t(value<<1);
  }
  return value;
}
inline bool parse(const char* line, uint32_t nonce, int& raw) {
  if(!line || std::strlen(line)>48)return false;
  const char* star=std::strchr(line,'*');
  if(!star || std::strlen(star+1)!=4)return false;
  if(star-line<12 || star-line>15 || line[0]!='R' || line[1]!='|' || line[10]!='|')return false;
  unsigned received=0,challenge=0,reading=0;
  for(unsigned i=0;i<12;++i) {
    const char c=i<8?line[2+i]:star[1+i-8];
    const int digit=c>='0'&&c<='9'?c-'0':c>='a'&&c<='f'?c-'a'+10:-1;
    if(digit<0)return false;
    if(i<8)challenge=(challenge<<4)|unsigned(digit);else received=(received<<4)|unsigned(digit);
  }
  for(const char* p=line+11;p<star;++p){if(*p<'0'||*p>'9')return false;reading=reading*10+unsigned(*p-'0');}
  if(received!=crc(line,star-line) || challenge!=nonce || reading>4095)return false;
  raw=int(reading);return true;
}
}
