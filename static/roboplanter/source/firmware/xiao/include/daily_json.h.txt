#pragma once
#include <ArduinoJson.h>
#include <cstring>
#include "daily_ticket.h"
namespace robo {
constexpr const char* DailyFields[]={"card","reversed","english","species","soil","raw","temperature","humidity"};
constexpr int DailyTicket::* DailyMembers[]={&DailyTicket::card,&DailyTicket::reversed,&DailyTicket::english,&DailyTicket::species,&DailyTicket::soil,&DailyTicket::raw,&DailyTicket::temperature,&DailyTicket::humidity};
inline bool readDaily(JsonVariantConst value,DailyTicket& d) {
  if(!value.is<JsonObjectConst>())return false;
  auto object=value.as<JsonObjectConst>();if(object.size()!=8 && object.size()!=10)return false;
  d.scene=0;std::memset(d.note,0,sizeof(d.note));
  if(object.size()==10) {
    if(!object["scene"].is<int>() || object["scene"].is<bool>() || !object["note"].is<const char*>())return false;
    d.scene=object["scene"];const auto jsonNote=object["note"].as<JsonString>();const char* note=jsonNote.c_str();if(jsonNote.size()!=std::strlen(note) || !validSceneNote(note))return false;
    std::memcpy(d.note,note,std::strlen(note));
  }
  for(int i=0;i<8;++i){auto field=object[DailyFields[i]];if(field.is<bool>()||!field.is<int>())return false;d.*DailyMembers[i]=field.as<int>();}
  return validDaily(d);
}
inline void writeDaily(JsonObject object,const DailyTicket& d) {
  for(int i=0;i<8;++i)object[DailyFields[i]]=d.*DailyMembers[i];
  if(d.scene || d.note[0]){object["scene"]=d.scene;object["note"]=d.note;}
}
}
