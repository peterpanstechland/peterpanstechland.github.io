#pragma once
#include <algorithm>
#include <cmath>
#include <cstring>
#include "daily_ticket.h"
#include "printer_text.h"

namespace robo {
constexpr const char* DailyLayoutVersion="garden-daily-v2";
constexpr int DailyReceiptRows=1536;
constexpr size_t DailyReceiptBytes=2+(DailyReceiptRows/PrinterCommandRows)*8+DailyReceiptRows*PrinterRowBytes;
// Original one-bit artwork. Coordinates are printer dots, not display pixels.
// This small band canvas is shared by physical printing and screen preview.
struct TicketCanvas {
  uint8_t* bits; int start,rows;
  void pixel(int x,int y) {
    if(x>=0&&x<384&&y>=start&&y<start+rows)bits[(y-start)*48+x/8]|=0x80>>(x%8);
  }
  void fill(int x,int y,int w,int h) {
    for(int py=std::max(y,start);py<std::min(y+h,start+rows);++py)
      for(int px=std::max(0,x);px<std::min(384,x+w);++px)pixel(px,py);
  }
  void box(int x,int y,int w,int h,int stroke=2) {
    fill(x,y,w,stroke);fill(x,y+h-stroke,w,stroke);fill(x,y,stroke,h);fill(x+w-stroke,y,stroke,h);
  }
  void line(int x,int y,int x2,int y2,int stroke=2) {
    int dx=std::abs(x2-x),sx=x<x2?1:-1,dy=-std::abs(y2-y),sy=y<y2?1:-1,err=dx+dy;
    for(;;){fill(x,y,stroke,stroke);if(x==x2&&y==y2)break;int e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
  }
  void circle(int cx,int cy,int radius,int stroke=2) {
    for(int y=std::max(cy-radius,start);y<=std::min(cy+radius,start+rows-1);++y)
      for(int x=cx-radius;x<=cx+radius;++x){int v=(x-cx)*(x-cx)+(y-cy)*(y-cy);if(v<=radius*radius&&v>=(radius-stroke)*(radius-stroke))pixel(x,y);}
  }
  int textWidth(const std::string& text,int size=32) {
    int width=0;size_t at=0;uint16_t code;
    while(nextPrinterCode(text,at,code)){auto g=printer_font::find(code);if(g)width+=g->advance*size/32;}
    return width;
  }
  void text(const std::string& text,int x,int y,int size=32) {
    size_t at=0;uint16_t code;
    while(nextPrinterCode(text,at,code)) {
      auto g=printer_font::find(code);if(!g)continue;
      const int stride=(g->width+7)/8;
      // Scale both axes equally, with coverage-preserving mapping for small labels.
      if(y+40*size/32>=start && y<start+rows)
        for(int r=0;r<g->height;++r)for(int c=0;c<g->width;++c)
          if(printer_font::kBitmap[g->offset+r*stride+c/8]&(0x80>>(c%8)))
            fill(x+(g->x+c)*size/32,y+(g->y+r)*size/32,
              size<=32?1:std::max(1,((g->x+c+1)*size+31)/32-(g->x+c)*size/32),
              size<=32?1:std::max(1,((g->y+r+1)*size+31)/32-(g->y+r)*size/32));
      x+=g->advance*size/32;
    }
  }
  void center(const std::string& value,int y,int size=32){text(value,(384-textWidth(value,size))/2,y,size);}
  void wrapped(const std::string& value,int x,int y,int width,int size=28) {
    std::string line;size_t at=0;
    while(at<value.size()) {
      const size_t begin=at;uint16_t code;if(!nextPrinterCode(value,at,code))return;
      std::string next=value.substr(begin,at-begin);
      if(textWidth(line+next,size)>width){text(line,x,y,size);y+=size+10;line.clear();}
      line+=next;
    }
    text(line,x,y,size);
  }
  void star(int x,int y,int size){line(x-size,y,x+size,y);line(x,y-size,x,y+size);}
  void divider(int y){for(int x=16;x<368;x+=10)fill(x,y,5,2);}
};
inline void ticketSprout(TicketCanvas& c,int cx,int y) {
  c.line(cx,y,cx,y+30,3);
  for(int r=0;r<15;++r){c.fill(cx-24+r,y-7+r,19-r/2,3);c.fill(cx+6-r/2,y-7+r,19-r/2,3);}
}
inline void ticketLogo(TicketCanvas& c) {
  ticketSprout(c,192,34);c.box(142,67,100,76,4);c.box(150,75,84,54,2);
  c.fill(168,94,8,7);c.fill(207,94,8,7);c.line(184,111,191,115);c.line(191,115,199,110);
  c.fill(164,141,7,7);c.fill(213,141,7,7);c.fill(171,153,42,3);
  c.star(107,89,8);c.star(271,116,6);c.circle(268,62,3);c.circle(113,139,3);
}
// Card artwork rotates 180 degrees for reversed cards; names remain readable.
inline void ticketTarotArt(TicketCanvas& out,const DailyTicket& d) {
  // Render into the current output band directly through a coordinate transform.
  struct Art {
    TicketCanvas& c; bool flip;
    void p(int x,int y){c.pixel(flip?383-x:x,flip?2081-y:y);}
    void line(int x,int y,int x2,int y2){int dx=std::abs(x2-x),sx=x<x2?1:-1,dy=-std::abs(y2-y),sy=y<y2?1:-1,e=dx+dy;for(;;){p(x,y);p(x+1,y);if(x==x2&&y==y2)break;int z=2*e;if(z>=dy){e+=dy;x+=sx;}if(z<=dx){e+=dx;y+=sy;}}}
    void ring(int x,int y,int r){for(int i=0;i<360;++i){double a=i*3.141592653589793/180;int px=x+int(r*std::cos(a)),py=y+int(r*std::sin(a));p(px,py);p(px+1,py);}}
  } a{out,d.reversed!=0};
  // Interior bounds x=112..271, y=942..1139, center=(191.5,1040.5).
  int suit=d.card<22?-1:(d.card-22)/14;
  a.ring(192,1030,55);a.line(192,954,192,971);a.line(192,1092,192,1109);
  if(suit==0){a.line(175,1067,208,991);a.line(179,1014,202,1014);a.line(179,1014,171,1000);}
  else if(suit==1){a.line(169,1005,215,1005);a.line(169,1005,179,1038);a.line(215,1005,204,1038);a.line(179,1038,204,1038);a.line(192,1038,192,1060);a.line(177,1061,207,1061);}
  else if(suit==2){a.line(192,987,192,1071);a.line(185,1000,192,987);a.line(199,1000,192,987);a.line(174,1048,210,1048);}
  else if(suit==3){int px[5]={192,215,155,229,169},py[5]={994,1063,1020,1020,1063};for(int i=0;i<5;++i)a.line(px[i],py[i],px[(i+1)%5],py[(i+1)%5]);}
  else {
    // Celestial emblem varies with each major arcana, with its printed number.
    int rays=5+d.card%7;
    for(int i=0;i<rays;++i){double t=i*6.283185307/rays; a.line(192+int(18*std::cos(t)),1030+int(18*std::sin(t)),192+int(42*std::cos(t)),1030+int(42*std::sin(t)));}
    a.ring(192,1030,12+d.card%8);
  }
  for(int i=0;i<4;++i){int x=126+(i%2)*130,y=963+(i/2)*157;a.line(x-4,y,x+4,y);a.line(x,y-4,x,y+4);}
}
inline void renderDailyBand(const DailyTicket& d,uint16_t start,uint8_t rows,uint8_t* bits) {
  std::memset(bits,0,PrinterRowBytes*rows);if(!validDaily(d))return;
  TicketCanvas c{bits,start,rows}; const bool en=d.english;
  ticketLogo(c);
  const char* titlesZh[]={"工位小花园","上班打卡签","午饭灵感签","会议幸存签","摸鱼许可证","低电量补给签"};
  const char* titlesEn[]={"OFFICE OASIS","CHECK IN","LUNCH BREAK","MEETING SURVIVOR","REST PERMIT","RECHARGE"};
  c.center(en?titlesEn[d.scene]:titlesZh[d.scene],172,36);
  c.center(d.note[0]?d.note:en?"A little room to grow.":"好好工作，也好好生长。",222,22);
  c.divider(270);
  c.text("01",18,289,24);c.text(en?"PLANT CHECK-IN":"植物状态",66,286,32);
  constexpr const char* zh[]={"薄荷","九层塔","蔷薇","多肉"};
  constexpr const char* english[]={"Mint","Basil","Rose","Succulent"};
  c.text(en?std::string("Garden: ")+english[d.species]:std::string("花园选择：")+zh[d.species],18,332,28);
  char value[64];
  if(d.soil!=-9999)std::snprintf(value,sizeof(value),en?"Soil moisture: %d%%":"土壤湿度：%d%%",d.soil);
  else if(d.raw!=-9999)std::snprintf(value,sizeof(value),en?"Soil ADC: %d":"土壤原始值：%d",d.raw);
  else std::snprintf(value,sizeof(value),"%s",en?"Soil: unavailable":"土壤：暂无读数");
  c.text(value,18,376,28);
  c.text(d.soil==-9999?(en?"Uncalibrated / no percentage":"未标定，不估算湿度百分比"):(en?"Sensor snapshot at preview":"打开预览时的传感器读数"),18,419,22);
  std::string env=en?"Temp ":"温度 ";
  if(d.temperature==-9999)env+="--";else{std::snprintf(value,sizeof(value),"%.1fC",d.temperature/10.0);env+=value;}
  env+=en?" / RH ":" / 湿度 ";
  if(d.humidity==-9999)env+="--";else{std::snprintf(value,sizeof(value),"%d%%",d.humidity);env+=value;}
  c.text(env,18,458,26);
  c.text(en?"Check soil before watering.":"先看土壤，再决定是否浇水。",18,501,24);
  c.divider(553);
  c.text("02",18,579,24);c.text(en?"TODAY / TO-DO":"今天的小目标",66,575,30);
  c.text(en?"Three things. One at a time.":"写下三件事，一件一件来。",18,622,22);
  for(int i=0;i<3;++i){int y=678+i*57;c.box(20,y,22,22,2);c.line(60,y+24,363,y+24,1);}
  c.divider(844);
  c.text("03",18,869,24);c.text(en?"YOUR DAILY CARD":"今日塔罗运势",66,865,30);
  c.box(102,927,180,228,2);c.box(108,933,168,216,1);ticketTarotArt(c,d);
  c.center(tarotName(d.card,en),1176,32);
  c.center(d.reversed?(en?"REVERSED / turn inward":"逆位 / 向内看一看"):(en?"UPRIGHT / take a step":"正位 / 向前走一步"),1222,24);
  if(d.card>=22){constexpr const char* topicsZh[]={"行动与创造","感受与关系","思考与沟通","日常与积累"};constexpr const char* topicsEn[]={"Energy & creativity","Feelings & connection","Thought & communication","Routine & resources"};c.center(en?topicsEn[(d.card-22)/14]:topicsZh[(d.card-22)/14],1261,22);}
  c.wrapped(tarotAdvice(d),24,1301,336,28);
  c.divider(1402);
  c.center(en?"A prompt, not a prediction.":"娱乐与自省，不是未来的预言。",1424,22);
  c.center(en?"GROW AT YOUR OWN PACE":"按自己的节奏，慢慢生长。",1467,24);
  c.star(192,1517,6);
}
template<class Write> bool writeDailyReceipt(const DailyTicket& d,Write write,bool cut) {
  if(!validDaily(d))return false;
  if(!write(0x1B)||!write('@'))return false;
  uint8_t bits[PrinterBandRows*PrinterRowBytes];
  for(int top=0;top<DailyReceiptRows;top+=PrinterCommandRows){
    const uint8_t header[]={0x1D,0x76,0x30,0,48,0,128,0};
    for(uint8_t b:header)if(!write(b))return false;
    for(int y=top;y<top+PrinterCommandRows;y+=PrinterBandRows){
      renderDailyBand(d,y,PrinterBandRows,bits);
      for(uint8_t b:bits)if(!write(b))return false;
    }
  }
  const uint8_t tail[]={0x1B,0x64,6,0x1D,0x56,0};
  for(int i=0;i<(cut?6:3);++i)if(!write(tail[i]))return false;
  return true;
}
}
