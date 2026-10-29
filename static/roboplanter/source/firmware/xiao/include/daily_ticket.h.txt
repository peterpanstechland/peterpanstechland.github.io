#pragma once
#include <cstdint>
#include <cstdio>
#include <string>
#include <cstring>
#include "printer_text.h"

namespace robo {
// Integer snapshot, copied through the queue. -9999 means unavailable, never zero.
struct DailyTicket {
  int card = 0, reversed = 0, english = 0, species = 0;
  int soil = -9999, raw = -9999, temperature = -9999, humidity = -9999;
  int scene = 0;
  char note[43] = {};
};
inline bool validSceneNote(const std::string& note) {
  if(note.size()>42)return false;
  size_t at=0;uint16_t code;int width=0;
  while(at<note.size()) {
    if(!nextPrinterCode(note,at,code) || code<32 || code==127 || code=='|')return false;
    auto glyph=printer_font::find(code);if(!glyph)return false;width+=glyph->advance*22/32;
  }
  return width<=336;
}
inline int sceneNumber(const std::string& name) {
  const char* names[]={"checkin","lunch","meetings","rest","lowbattery"};
  for(int i=0;i<5;++i)if(name==names[i])return i+1;return -1;
}
inline bool validDaily(const DailyTicket& d) {
  return d.scene>=0 && d.scene<=5 && std::memchr(d.note,0,sizeof(d.note)) && validSceneNote(d.note) && d.card>=0 && d.card<78 && d.reversed>=0 && d.reversed<=1 &&
    d.english>=0 && d.english<=1 && d.species>=0 && d.species<4 &&
    (d.soil==-9999 || (d.soil>=0 && d.soil<=100)) &&
    (d.raw==-9999 || (d.raw>=0 && d.raw<=4095)) &&
    (d.temperature==-9999 || (d.temperature>=-400 && d.temperature<=850)) &&
    (d.humidity==-9999 || (d.humidity>=0 && d.humidity<=100));
}
inline bool sameDaily(const DailyTicket& a,const DailyTicket& b) {
  return a.scene==b.scene && std::memcmp(a.note,b.note,sizeof(a.note))==0 && a.card==b.card && a.reversed==b.reversed && a.english==b.english &&
    a.species==b.species && a.soil==b.soil && a.raw==b.raw &&
    a.temperature==b.temperature && a.humidity==b.humidity;
}
// Rejection sampling avoids modulo bias. Call once when opening a NEW preview.
template<class Random> inline void drawDailyCard(DailyTicket& d,Random random) {
  uint32_t value; do { value=random(); } while(value>=UINT32_MAX-(UINT32_MAX%156));
  d.card=value%78; d.reversed=(value%156)/78;
}
struct TarotMajor { const char *zh,*en,*upZh,*downZh,*upEn,*downEn; };
constexpr TarotMajor TarotMajors[] = {
  {"愚者","The Fool","给新想法一次机会","先看清脚下的一步","Try a fresh idea.","Check your next step."},
  {"魔术师","The Magician","用手边资源开始做","一次只推进一件事","Use what you have.","Focus on one thing."},
  {"女祭司","High Priestess","听听自己的直觉","给疑问多一点时间","Listen within.","Leave room for doubt."},
  {"皇后","The Empress","照顾自己也照顾植物","休息不需要理由","Make room to grow.","Rest without guilt."},
  {"皇帝","The Emperor","为今天安排好边界","计划可以留点弹性","Set kind boundaries.","Leave room to adapt."},
  {"教皇","The Hierophant","向有经验的人请教","试试自己的方法","Ask a trusted guide.","Try your own method."},
  {"恋人","The Lovers","选择与你在意的相符","先说清彼此的期待","Choose what matters.","Share expectations."},
  {"战车","The Chariot","朝一个目标稳步前进","放慢一点校准方向","Take a steady step.","Pause and reorient."},
  {"力量","Strength","温柔也能很有力量","给自己一点宽容","Lead with kindness.","Be gentle with you."},
  {"隐者","The Hermit","留一段安静的时间","需要时可以寻求帮助","Find a quiet moment.","It is fine to ask."},
  {"命运之轮","Wheel of Fortune","拥抱今天的小变化","先稳住能掌握的事","Welcome small change.","Ground your routine."},
  {"正义","Justice","把事实和感受分开看","重新核对一个假设","Check facts kindly.","Review an assumption."},
  {"倒吊人","The Hanged Man","换个角度看看难题","先做一个微小行动","Try another view.","Take one small step."},
  {"死神","Death","给旧习惯一个句号","改变可以从小处开始","Let an old habit go.","Change can be small."},
  {"节制","Temperance","找到工作休息的节奏","为今天减少一点负担","Find a gentle pace.","Lighten today's load."},
  {"恶魔","The Devil","看见消耗你的习惯","放下一个无谓的执念","Notice draining habits.","Release one pressure."},
  {"高塔","The Tower","计划之外也有新空间","先修好最小的一块","Make room for change.","Repair one small thing."},
  {"星星","The Star","记下一个小小的希望","先完成一件能做到的","Keep a little hope.","Start with the doable."},
  {"月亮","The Moon","不确定时先观察","用事实澄清一个担心","Observe uncertainty.","Check a worry gently."},
  {"太阳","The Sun","分享今天的小小开心","不必强迫自己积极","Share a small joy.","All feelings belong."},
  {"审判","Judgement","回顾今天学到的东西","少一点苛责多点理解","Notice what you learn.","Trade blame for care."},
  {"世界","The World","为完成的一步庆祝","收好尾再开启下一步","Celebrate progress.","Finish one loose end."}
};
constexpr const char* TarotSuitsZh[] = {"权杖","圣杯","宝剑","星币"};
constexpr const char* TarotSuitsEn[] = {"Wands","Cups","Swords","Pentacles"};
constexpr const char* TarotRanksZh[] = {"一","二","三","四","五","六","七","八","九","十","侍从","骑士","王后","国王"};
constexpr const char* TarotRanksEn[] = {"Ace","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Page","Knight","Queen","King"};
constexpr const char* TarotUpZh[] = {"从一个小机会开始","想好下一步再出发","分享进度寻求合作","珍惜手边已有的支持","用沟通化解小摩擦","记得肯定自己的进步","守护一件重要的事","保持专注慢慢推进","坚持之外也要休息","把负担分给合适的人","带着好奇学一点东西","行动前确认好方向","温柔照顾自己和伙伴","用成熟的方式做决定"};
constexpr const char* TarotDownZh[] = {"先休息再找新灵感","不用急着做出选择","先把自己的节奏找回","给日常留一个新入口","不必每次都争个输赢","别用别人的进度衡量","少一些防备多点倾听","放慢速度检查细节","累了就允许自己暂停","放下一项多余的任务","先练习再追求完美","冲动时给自己十分钟","把关心也留给自己","放下控制试着去信任"};
constexpr const char* TarotUpEn[] = {"Start with a small spark.","Plan one next step.","Invite collaboration.","Value your support.","Talk through friction.","Notice your progress.","Protect what matters.","Keep a steady focus.","Rest as you persist.","Share the workload.","Learn with curiosity.","Check your direction.","Care for your people.","Choose with patience."};
constexpr const char* TarotDownEn[] = {"Rest before starting.","No need to rush.","Find your own pace.","Try a small new habit.","Not every clash matters.","Drop the comparison.","Listen before reacting.","Slow down; check details.","Allow yourself a pause.","Drop one extra task.","Practice over perfect.","Pause before you act.","Include yourself in care.","Give trust some room."};
inline std::string tarotName(int card,bool english) {
  if(card<0 || card>=78)return "?";
  if(card<22)return english?TarotMajors[card].en:TarotMajors[card].zh;
  int suit=(card-22)/14,rank=(card-22)%14;
  return english?std::string(TarotRanksEn[rank])+" of "+TarotSuitsEn[suit]:
    std::string(TarotSuitsZh[suit])+TarotRanksZh[rank];
}
inline const char* tarotAdvice(const DailyTicket& d) {
  if(!validDaily(d))return "";
  if(d.card<22) { const auto& c=TarotMajors[d.card];return d.english?(d.reversed?c.downEn:c.upEn):(d.reversed?c.downZh:c.upZh); }
  int rank=(d.card-22)%14;
  return d.english?(d.reversed?TarotDownEn[rank]:TarotUpEn[rank]):(d.reversed?TarotDownZh[rank]:TarotUpZh[rank]);
}
}
