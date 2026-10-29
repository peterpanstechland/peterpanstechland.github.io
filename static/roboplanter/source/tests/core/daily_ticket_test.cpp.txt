#include <fstream>
#include <iostream>
#include <set>
#include <vector>
#include <cstdlib>
#include "../../firmware/xiao/include/controller.h"
#include "../../firmware/xiao/include/daily_receipt.h"
#include "../../firmware/indicator/include/receipt_preview.h"
#define REQUIRE(x) do { if(!(x)){std::cerr<<"FAIL "<<__LINE__<<": "<<#x<<'\n';return 1;} }while(0)
struct PreviewCanvas {
  std::vector<uint8_t> image=std::vector<uint8_t>(384*receipt_preview::DailyPreviewRows,0);
  void fillRect(int x,int y,int w,int h,uint16_t c){for(int j=y;j<y+h;++j)for(int i=x;i<x+w;++i)image.at(j*384+i)=c;}
  void drawFastHLine(int x,int y,int w,uint16_t c){fillRect(x,y,w,1,c);}
};
bool fontCovered(const std::string& text){size_t i=0;uint16_t code;while(i<text.size()){if(!robo::nextPrinterCode(text,i,code)||!printer_font::find(code))return false;}return true;}
int main(int argc,char** argv) {
  std::set<std::string> names;
  for(int lang=0;lang<2;++lang)for(int card=0;card<78;++card)for(int rev=0;rev<2;++rev){
    robo::DailyTicket d;d.card=card;d.reversed=rev;d.english=lang;
    REQUIRE(robo::validDaily(d));REQUIRE(fontCovered(robo::tarotName(card,lang)));REQUIRE(fontCovered(robo::tarotAdvice(d)));
    if(!lang&&!rev)names.insert(robo::tarotName(card,false));
    robo::DailyTicket drawn;robo::drawDailyCard(drawn,[=]{return static_cast<uint32_t>(card+rev*78);});REQUIRE(drawn.card==card&&drawn.reversed==rev);
  }
  REQUIRE(names.size()==78);
  robo::DailyTicket d;int calls=0;robo::drawDailyCard(d,[&]{return calls++?155U:UINT32_MAX;});REQUIRE(calls==2&&d.card==77&&d.reversed==1);
  d.card=78;REQUIRE(!robo::validDaily(d));d.card=17;d.raw=2301;
  robo::Config cfg;cfg.actionsEnabled=cfg.credentialsConfigured=cfg.printerEnabled=true;
  robo::Controller core(cfg);robo::Command c;c.requestId="daily-one";c.action="print_daily";c.hasDaily=true;c.daily=d;
  REQUIRE(core.submit(c,0).status=="accepted");REQUIRE(core.submit(c,1).duplicate);
  ++c.daily.card;REQUIRE(core.submit(c,2).error=="request_id_conflict");--c.daily.card;
  core.finishPrint(c.requestId,false);c.requestId="daily-two";REQUIRE(core.submit(c,3).error=="printer_recovery_required");
  robo::Controller other(cfg);c.hasText=true;c.text="hidden";REQUIRE(!other.submit(c,0).ok);
  c.requestId="daily-three";c.hasText=false;c.action="light";c.hasOn=true;REQUIRE(other.submit(c,1).error=="unexpected_fields");
  // Encoder and paged preview must produce exactly the same pixels.
  std::vector<uint8_t> wire;REQUIRE(robo::writeDailyReceipt(d,[&](uint8_t b){wire.push_back(b);return true;},true));
  REQUIRE(wire.size()==robo::DailyReceiptBytes+6);
  std::vector<uint8_t> raster;size_t at=2;
  for(int row=0;row<1536;row+=128){REQUIRE(wire[at]==0x1D&&wire[at+3]==0&&wire[at+4]==48&&wire[at+6]==128);at+=8;raster.insert(raster.end(),wire.begin()+at,wire.begin()+at+6144);at+=6144;}
  REQUIRE(wire[at]==0x1B&&wire[at+3]==0x1D&&wire[at+4]=='V');
  for(int page=0;page<receipt_preview::DailyPreviewPages;++page){PreviewCanvas canvas;receipt_preview::drawDaily(canvas,d,page,0,0,0,1);
    for(int row=0;row<receipt_preview::DailyPreviewRows;++row)for(int x=0;x<384;++x){int y=std::min(page*receipt_preview::DailyPreviewStep,1536-receipt_preview::DailyPreviewRows)+row;bool black=y<1536&&(raster[y*48+x/8]&(0x80>>(x%8)));REQUIRE((canvas.image[row*384+x]!=0)==black);}}
  // A failure in a raster body must never reach feed/cut, nor send further bytes.
  size_t sent=0;REQUIRE(!robo::writeDailyReceipt(d,[&](uint8_t){return ++sent<2000;},true));REQUIRE(sent==2000);
  if(argc==2){std::string path=argv[1];std::ofstream bin(path+".bin",std::ios::binary);bin.write(reinterpret_cast<char*>(wire.data()),wire.size());
    std::ofstream pgm(path+".pgm",std::ios::binary);pgm<<"P5\n384 1536\n255\n";for(int y=0;y<1536;++y)for(int x=0;x<384;++x)pgm.put((raster[y*48+x/8]&(0x80>>(x%8)))?0:255);
  }
  std::cout<<"PASS: 78 cards, both orientations/languages, dedupe, failure latch, all preview pixels\n";
}
