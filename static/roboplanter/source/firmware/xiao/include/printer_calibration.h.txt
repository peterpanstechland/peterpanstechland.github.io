#pragma once
#include "daily_receipt.h"
namespace robo {
// Same 128-dot square/circle, normal raster mode, two command band sizes.
// At 203 dpi each should be ~16 mm in both directions. No font-size guesses.
constexpr size_t CalibrationWireBytes=2+(8+2)*8+512*PrinterRowBytes+6;
template<class Write> bool writePrinterCalibration(Write write,bool cut) {
  if(!write(0x1B)||!write('@'))return false;
  uint8_t bits[32*48];
  for(int panel=0;panel<2;++panel){const int band=panel?128:32;
    for(int top=0;top<256;top+=band){
      uint8_t head[]={0x1D,0x76,0x30,0,48,0,static_cast<uint8_t>(band),0};
      for(uint8_t b:head)if(!write(b))return false;
      for(int start=top;start<top+band;start+=32){
        std::memset(bits,0,sizeof(bits));TicketCanvas c{bits,start,32};
        c.text(panel?"B / 128-row bands":"A / 32-row bands",16,8,28);
        c.box(24,65,128,128,2);c.circle(268,129,64,2);c.line(24,65,151,192,1);
        c.text("128 x 128 dots / 1:1",16,210,24);
        for(uint8_t b:bits)if(!write(b))return false;
      }
    }
  }
  const uint8_t tail[]={0x1B,0x64,6,0x1D,0x56,0};for(int i=0;i<(cut?6:3);++i)if(!write(tail[i]))return false;
  return true;
}
}
