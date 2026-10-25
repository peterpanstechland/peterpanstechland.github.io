#include "garden_ui.h"
#include "garden_art.h"
#include "garden_store.h"
#include "device_settings.h"
#include "indicator_board.h"
#include "ui_text.h"
#include "ui_theme.h"
#include <cstdio>

namespace garden_ui {
namespace {
enum class Page : uint8_t { Closed, Care, Species, Mood };
struct Rect { int16_t x, y, w, h; };
constexpr Rect kSpecies{320,76,136,44}, kCare{24,380,278,48}, kMood{316,380,140,48};
constexpr Rect kTiles[]={{24,132,210,126},{246,132,210,126},{24,270,210,126},{246,270,210,126}};
constexpr Rect kActions[]={{24,228,210,70},{246,228,210,70},{24,310,210,70},{246,310,210,70}};
Page page = Page::Closed;
uint32_t messageStarted=0;
bool hasMessage=false,celebrating=false;
const char *messageZh="", *messageEn="";
const char *tr(const char *zh,const char *en) {
  return device_settings::getLanguage()==device_settings::Language::English?en:zh;
}
garden::Model &game() { return garden_store::model(); }
bool inside(const Rect &r,int x,int y) {return x>=r.x && x<r.x+r.w && y>=r.y && y<r.y+r.h;}
bool tapped(const Rect &r,const ui::TouchGate &t) {
  return inside(r,t.startX(),t.startY()) && inside(r,t.lastX(),t.lastY());
}
void text(int x,int y,const char *s,uint16_t ink,uint8_t size=16) {
  ui_text::drawSized(indicator::display(),x,y,s,ink,size);
}
void center(int x,int y,int width,const char *s,uint16_t ink,uint8_t size=16) {
  text(x+(width-ui_text::widthSized(s,size))/2,y,s,ink,size);
}
void button(const Rect &r,const char *s,const ui_theme::Theme &t,bool accent=false) {
  auto &g=indicator::display();g.fillRoundRect(r.x,r.y,r.w,r.h,10,accent?t.accent:t.surface);
  const uint8_t size=ui_text::widthSized(s,24)<=r.w-24?24:16;
  center(r.x,r.y+(r.h-size)/2-1,r.w,s,accent?t.cardInk:t.ink,size);
}
void bar(int x,int y,int width,uint8_t value,uint16_t ink,uint16_t track) {
  auto &g=indicator::display();g.fillRoundRect(x,y,width,6,3,track);
  const int fill=width*(value>100?100:value)/100;
  if(fill>0)g.fillRoundRect(x,y,fill,6,3,ink);
}
const char *speciesName(garden::Species species) {
  switch(species) {
    case garden::Species::Basil:return tr("九层塔","Basil");
    case garden::Species::Rose:return tr("蔷薇","Rose");
    case garden::Species::Succulent:return tr("多肉","Succulent");
    default:return tr("薄荷","Mint");
  }
}
const char *stageName(garden::Stage stage,garden::Species species) {
  switch(stage) {
    case garden::Stage::Sprout:return tr("萌芽","Sprout");
    case garden::Stage::Leafy:return tr("枝叶舒展","Leafy");
    case garden::Stage::Bloom:return tr("花开时刻","Bloom");
    case garden::Stage::Mature:
      return species==garden::Species::Rose?tr("结出果实","Rose hips"):
             species==garden::Species::Succulent?tr("长出新伙伴","New pups"):tr("结籽丰收","Seed harvest");
    default:return tr("一颗小种子","Little seed");
  }
}
const char *moodName(uint8_t value) {
  return value>=80?tr("开心","Happy"):value>=55?tr("自在","Content"):value>=35?tr("想你啦","Miss you"):tr("想歇一歇","Need a rest");
}
const char *atmosphereName(garden::Atmosphere atmosphere) {
  switch(atmosphere) {
    case garden::Atmosphere::Busy:return tr("忙碌工位","Busy desk");
    case garden::Atmosphere::Tired:return tr("低电量模式","Low energy");
    case garden::Atmosphere::Happy:return tr("开心营业","Good vibes");
    default:return tr("松弛时光","Calm time");
  }
}
const char *atmosphereLine() {
  switch(game().atmosphere()) {
    case garden::Atmosphere::Busy:return tr("我陪你，一次做好一件事","One thing at a time. I'm here.");
    case garden::Atmosphere::Tired:return tr("今天慢一点也没关系","It's okay to take it slow.");
    case garden::Atmosphere::Happy:return tr("把今天的小开心种下来","Let's grow a little joy today.");
    default:return tr("在工位，留一小片绿意","A little green, a little peace.");
  }
}
void message(const char *zh,const char *en,uint32_t now,bool success=false) {
  messageZh=zh;messageEn=en;messageStarted=now;hasMessage=true;celebrating=success;
}
bool showingMessage(uint32_t now) {return hasMessage && now-messageStarted<7000;}
void hint(int y,uint32_t now,const ui_theme::Theme &t) {
  if(!garden_store::available())center(24,y,432,tr("成长暂未保存","Progress could not be saved"),t.second);
  else center(24,y,432,showingMessage(now)?tr(messageZh,messageEn):atmosphereLine(),t.muted);
}
void character(int x,int y,int r,uint32_t now,uint8_t themeId) {
  const auto &p=game().current();
  garden_art::draw(indicator::display(),themeId,static_cast<uint8_t>(game().selected()),
    static_cast<uint8_t>(game().stage()),x,y,r,p.health,p.mood,p.weeds,now,
    celebrating&&showingMessage(now));
}
void progress(int y,const ui_theme::Theme &t) {
  char line[80];
  if(game().stage()==garden::Stage::Mature) {
    center(24,y,432,tr("长大啦，继续一起过日子","All grown up. Keep me company."),t.ink);
  } else {
    const unsigned minutes=(game().nextStageSeconds()+59)/60;
    snprintf(line,sizeof(line),tr("下一阶段：陪伴 %u 分 · 成长值 %u","Next: %u min together / %u growth"),
      minutes,static_cast<unsigned>(game().nextStageXp()));
    center(24,y,432,line,t.muted);
  }
  bar(24,y+23,432,game().progressPercent(),t.accent,t.surface);
}
void drawCare(uint32_t now,uint8_t themeId) {
  const auto &t=ui_theme::get(themeId);const auto &p=game().current();auto &g=indicator::display();
  text(24,80,tr("照料小精灵","Care for your spirit"),t.ink,24);
  text(24,113,tr("这里照顾的是屏幕里的植物","These actions care for your screen plant."),t.muted);
  character(92,176,48,now,themeId);
  char line[80];
  snprintf(line,sizeof(line),tr("水分 %u    养分 %u","Water %u    Food %u"),p.moisture,p.nutrition);text(174,145,line,t.ink);
  snprintf(line,sizeof(line),tr("杂草 %u    成长值 %lu","Weeds %u    Growth %lu"),p.weeds,static_cast<unsigned long>(p.xp));text(174,173,line,t.ink);
  text(174,201,stageName(game().stage(),game().selected()),t.accent);
  const char *names[]={tr("浇水","Water"),tr("施肥","Feed"),tr("除草","Weed"),tr("陪一陪","Comfort")};
  for(uint8_t i=0;i<4;++i) {
    const auto &r=kActions[i];g.fillRoundRect(r.x,r.y,r.w,r.h,12,t.card);
    text(r.x+16,r.y+10,names[i],t.cardInk,24);
    const uint32_t wait=game().remainingSeconds(static_cast<garden::Care>(i));
    if(wait)snprintf(line,sizeof(line),tr("休息 %lu:%02lu","Rest %lu:%02lu"),
      static_cast<unsigned long>(wait/60),static_cast<unsigned long>(wait%60));
    else if(i==2 && !p.weeds)snprintf(line,sizeof(line),"%s",tr("花盆很干净","All tidy"));
    else if(i==1 && game().stage()==garden::Stage::Seed)snprintf(line,sizeof(line),"%s",tr("萌芽后再施肥","Wait for a sprout"));
    else snprintf(line,sizeof(line),"%s",tr("轻点照料","Tap to care"));
    text(r.x+16,r.y+44,line,t.cardMuted);
  }
  hint(405,now,t);
}
void drawSpecies(uint32_t now,uint8_t themeId) {
  const auto &t=ui_theme::get(themeId);auto &g=indicator::display();
  text(24,80,tr("我的小花园","My little garden"),t.ink,24);
  text(24,113,tr("四株独立成长，切换保留进度","Four plants. Switching keeps your progress."),t.muted);
  for(uint8_t i=0;i<4;++i) {
    const auto species=static_cast<garden::Species>(i);const auto &p=game().plant(species);const auto &r=kTiles[i];
    g.fillRoundRect(r.x,r.y,r.w,r.h,12,t.surface);
    if(species==game().selected())g.drawRoundRect(r.x,r.y,r.w,r.h,12,t.accent);
    garden_art::draw(g,themeId,i,static_cast<uint8_t>(game().stage(species)),r.x+51,r.y+69,43,p.health,p.mood,p.weeds,now);
    text(r.x+102,r.y+20,speciesName(species),t.ink,ui_text::widthSized(speciesName(species),24)<102?24:16);
    const char *shortStages[]={tr("种子","Seed"),tr("萌芽","Sprout"),tr("长叶","Leafy"),tr("开花","Bloom"),tr("成熟","Mature")};
    text(r.x+102,r.y+57,shortStages[static_cast<uint8_t>(game().stage(species))],t.muted);
    text(r.x+102,r.y+90,species==game().selected()?tr("陪伴中","Together"):tr("来陪我","Choose me"),t.accent);
  }
  center(24,414,432,tr("不在身边时，小精灵会安心休息","Your other plants rest while you're away."),t.muted);
}
void drawMood(uint32_t /*now*/,uint8_t themeId) {
  const auto &t=ui_theme::get(themeId);auto &g=indicator::display();
  text(24,80,tr("今天的工位氛围","Today's desk mood"),t.ink,24);
  text(24,113,tr("按你的感受选，小精灵会陪着你","Pick how you feel. Your spirit stays with you."),t.muted);
  const char *lines[]={tr("留一点呼吸的空隙","Room to breathe"),tr("一件一件慢慢来","One thing at a time"),tr("允许自己歇一歇","Take a little break"),tr("分享一点小开心","Share a little joy")};
  for(uint8_t i=0;i<4;++i) {
    const auto &r=kTiles[i];const auto value=static_cast<garden::Atmosphere>(i);const bool active=value==game().atmosphere();
    g.fillRoundRect(r.x,r.y,r.w,r.h,12,active?t.accent:t.surface);
    const uint16_t ink=active?t.cardInk:t.ink;
    ui_theme::icon(g,i==1?ui_theme::Icon::Clock:i==2?ui_theme::Icon::Humidity:i==3?ui_theme::Icon::Light:ui_theme::Icon::Leaf,r.x+16,r.y+16,24,ink);
    text(r.x+16,r.y+53,atmosphereName(value),ink,ui_text::widthSized(atmosphereName(value),24)<180?24:16);
    text(r.x+16,r.y+92,lines[i],active?t.cardInk:t.muted);
  }
  center(24,414,432,tr("氛围由你决定，不给心情打分","Your mood is yours. There is no score."),t.muted);
}
}
bool isOpen(){return page!=Page::Closed;}
void close(){page=Page::Closed;}
void openCare(){page=Page::Care;}
void openSpecies(){page=Page::Species;}
void openMood(){page=Page::Mood;}
const char *title(){return page==Page::Species?tr("小花园","Garden"):page==Page::Mood?tr("工位氛围","Desk mood"):tr("精灵照料","Spirit care");}
void drawHome(uint32_t now,uint8_t themeId) {
  const auto &t=ui_theme::get(themeId);const auto &p=game().current();auto &g=indicator::display();
  text(24,80,speciesName(game().selected()),t.ink,24);button(kSpecies,tr("小花园 >","Garden >"),t);
  text(24,113,stageName(game().stage(),game().selected()),t.muted);
  center(320,122,136,atmosphereName(game().atmosphere()),t.muted);
  g.fillRoundRect(24,140,140,48,10,t.surface);g.fillRoundRect(316,140,140,48,10,t.surface);
  char hp[48];snprintf(hp,sizeof(hp),tr("精灵生命 %u","Spirit HP %u"),p.health);text(35,148,hp,t.ink);
  bar(35,174,118,p.health,t.accent,t.background);
  center(316,148,140,tr("精灵心情","Spirit mood"),t.muted);center(316,169,140,moodName(p.mood),t.second);
  character(240,233,80,now,themeId);
  hint(318,now,t);
  progress(343,t);
  button(kCare,tr("照料小精灵","Care for spirit"),t,true);button(kMood,tr("工位氛围","Desk mood"),t);
  // A single, permanent label distinguishes game HP from the real sensor page.
  center(24,432,432,tr("植物精灵 · 养成游戏","Plant spirit / raising game"),t.muted);
}
void draw(uint32_t now,uint8_t themeId) {
  if(page==Page::Care)drawCare(now,themeId);
  else if(page==Page::Species)drawSpecies(now,themeId);
  else if(page==Page::Mood)drawMood(now,themeId);
}
bool handleHome(ui::Gesture gesture,const ui::TouchGate &touch,uint32_t /*now*/) {
  if(gesture!=ui::Gesture::Tap)return false;
  if(tapped(kSpecies,touch))openSpecies();
  else if(tapped(kCare,touch))openCare();
  else if(tapped(kMood,touch))openMood();
  else return false;
  return true;
}
bool handle(ui::Gesture gesture,const ui::TouchGate &touch,uint32_t now) {
  if(!isOpen())return false;
  if(gesture!=ui::Gesture::Tap)return true;
  if(page==Page::Species || page==Page::Mood) {
    for(uint8_t i=0;i<4;++i)if(tapped(kTiles[i],touch)) {
      if(page==Page::Species) {game().select(static_cast<garden::Species>(i));hasMessage=false;close();}
      else {game().setAtmosphere(static_cast<garden::Atmosphere>(i));message("今天按你的节奏来","We'll go at your pace today.",now,true);close();}
      return true;
    }
  } else if(page==Page::Care) {
    for(uint8_t i=0;i<4;++i)if(tapped(kActions[i],touch)) {
      const auto result=game().care(static_cast<garden::Care>(i));
      if(result==garden::Result::Applied)message("收到你的照顾啦！","Thanks for looking after me!",now,true);
      else if(result==garden::Result::CoolingDown)message("慢慢来，陪我待一会儿","No rush. Stay with me a little.",now);
      else if(result==garden::Result::NotReady)message("等小芽长出来再施肥","Let me sprout before feeding.",now);
      else message("现在刚刚好，歇一歇吧","I'm doing fine. Take a little break.",now);
      return true;
    }
  }
  return true;
}
void focusCompleted(uint32_t now) {
  if(game().rewardFocus()==garden::Result::Applied)
    message("专注完成！小精灵也长大一点","Focus complete! A little more growth.",now,true);
}
}
