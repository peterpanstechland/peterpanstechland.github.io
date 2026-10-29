#pragma once
#include "../../xiao/include/printer_receipt.h"
#include "../../xiao/include/daily_receipt.h"

namespace receipt_preview {
constexpr int DailyPreviewRows=256;
constexpr int DailyPreviewStep=224; // 32-row overlap prevents losing clipped text at page boundaries.
constexpr int DailyPreviewPages=(robo::DailyReceiptRows-DailyPreviewRows+DailyPreviewStep-1)/DailyPreviewStep+1;
// A 1:1 dot viewport; paging never rescales a long receipt into tiny text.
template<class Canvas>
void drawDaily(Canvas& g,const robo::DailyTicket& d,int page,int x,int y,uint16_t paper,uint16_t ink) {
  if(page<0||page>=DailyPreviewPages)return;
  g.fillRect(x,y,384,DailyPreviewRows,paper);
  uint8_t bits[robo::PrinterBandRows*robo::PrinterRowBytes];
  const int start=std::min(page*DailyPreviewStep,robo::DailyReceiptRows-DailyPreviewRows);
  for(int row=0;row<DailyPreviewRows;row+=robo::PrinterBandRows){
    const int count=std::min<int>(robo::PrinterBandRows,DailyPreviewRows-row);
    robo::renderDailyBand(d,start+row,count,bits);
    for(int r=0;r<count;++r)for(int col=0;col<384;){
      auto black=[&](int c){return bits[r*48+c/8]&(0x80>>(c%8));};
      if(!black(col)){++col;continue;}int first=col++;while(col<384&&black(col))++col;
      g.drawFastHLine(x+first,y+row+r,col-first,ink);
    }
  }
}
// Fit the complete physical page without changing its aspect ratio. The same
// raster bands drive both this preview and the printer; no second font/layout.
template<class Canvas>
bool draw(Canvas& g, const char* text, int x, int y, int width, int height,
          uint16_t paper, uint16_t ink) {
  const std::string value(text);
  robo::PrinterLayout layout;
  if (!robo::printerTextLayout(value, layout)) return false;
  const int rows = robo::printerReceiptRows(layout);
  const int fittedWidth = width*rows > height*robo::PrinterWidth ? height*robo::PrinterWidth/rows : width;
  const int fittedHeight = (rows*fittedWidth+robo::PrinterWidth-1)/robo::PrinterWidth;
  x += (width-fittedWidth)/2;
  y += (height-fittedHeight)/2;
  g.fillRect(x,y,fittedWidth,fittedHeight,paper);
  uint8_t pixels[robo::PrinterRowBytes*robo::PrinterBandRows];
  for (int start=0; start<rows; start+=robo::PrinterBandRows) {
    const int count = rows-start<robo::PrinterBandRows ? rows-start : robo::PrinterBandRows;
    robo::renderPrinterBand(value,layout,static_cast<uint16_t>(start),static_cast<uint8_t>(count),pixels);
    for (int row=0; row<count; ++row) {
      int col=0;
      const int dy = y+(start+row)*fittedWidth/robo::PrinterWidth;
      while (col<robo::PrinterWidth) {
        const auto black = [&](int c) { return pixels[row*robo::PrinterRowBytes+c/8] & (0x80>>(c%8)); };
        if (!black(col)) { ++col; continue; }
        const int first=col++;
        while (col<robo::PrinterWidth && black(col)) ++col;
        const int left=first*fittedWidth/robo::PrinterWidth;
        const int right=(col*fittedWidth+robo::PrinterWidth-1)/robo::PrinterWidth;
        g.drawFastHLine(x+left,dy,right-left,ink);
      }
    }
  }
  return true;
}
}
