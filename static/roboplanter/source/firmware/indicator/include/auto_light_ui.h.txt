// Included in settings_ui's private namespace.
constexpr Rect kLightMode{24,144,432,50}, kLightSave{24,410,432,48};
constexpr Rect kOnMinus{24,234,56,50}, kOnCapture{96,234,288,50}, kOnPlus{400,234,56,50};
constexpr Rect kOffMinus{24,324,56,50}, kOffCapture{96,324,288,50}, kOffPlus{400,324,56,50};
robo::AutoLightSettings lightDraft;
bool lightDirty=false, lightWaiting=false;
const char* lightNotice="";
bool lightSettingsReady(const planter::State& s,uint32_t now) {
  return planter::fresh(s,now) && s.autoLightKnown && s.autoLightAvailable && s.autoLightWritable &&
    s.pumpKnown && !s.pumpOn && !s.commandBlocked && !calibrationWriting(s);
}
bool lightWriting(const planter::State& s) {
  return s.autoLightWrite==planter::CalibrationWrite::Queued || s.autoLightWrite==planter::CalibrationWrite::Saving ||
    (lightWaiting && (s.autoLightWrite==planter::CalibrationWrite::Unknown || s.autoLightWrite==planter::CalibrationWrite::Saved));
}
bool freshAmbient(const planter::State& s,uint32_t now) {
  return planter::fresh(s,now) && s.ambientLightEnabled && s.ambientLightRaw.valid &&
    uint64_t(now-s.receivedMs)+s.sampleAgeMs<=3000;
}
void openAutoLight() {
  lightDraft=planter::snapshot().autoLight;lightDirty=lightWaiting=false;lightNotice="";page=Page::AutoLight;
}
void drawAutoLight(const ui_theme::Theme& t,uint32_t now) {
  const auto s=planter::snapshot();const bool ready=lightSettingsReady(s,now);
  if(lightWaiting && s.autoLightWrite==planter::CalibrationWrite::Saved && s.autoLightKnown && s.autoLight.revision>lightDraft.revision) {
    lightDraft=s.autoLight;lightWaiting=lightDirty=false;lightNotice=tr("已保存，断电后保留","Saved; retained after power off");
  }
  if(ready && !lightDirty && !lightWaiting)lightDraft=s.autoLight;
  char live[96];
  if(freshAmbient(s,now))snprintf(live,sizeof(live),tr("环境光  %d   灯带 %s","Light ADC  %d   Strip %s"),int(s.ambientLightRaw.value),s.lightOn?tr("开","ON"):tr("关","OFF"));
  else snprintf(live,sizeof(live),"%s",tr("环境光  --","Light ADC  --"));
  text(24,84,live,t.ink,24);
  text(24,118,!ready?tr("等待设备就绪；浇水时不能保存","Wait for device; cannot save while watering"):
    s.autoLightPaused?tr("手动优先中；保存可恢复自动","Manual override; save to resume automatic"):
    tr("连续稳定三次才切换，避免反复闪烁","Three stable readings before switching"),t.muted,16);
  const bool busy=lightWriting(s);
  button(kLightMode,lightDraft.enabled?tr("自动模式：开","Automatic: ON"):tr("自动模式：关","Automatic: OFF"),t,lightDraft.enabled,ready&&!busy,24);
  text(24,204,tr("低于或等于此值开灯","Turn ON at or below"),t.ink,16);
  text(24,294,tr("高于或等于此值关灯","Turn OFF at or above"),t.ink,16);
  char value[96];
  button(kOnMinus,"-",t,false,ready&&!busy);button(kOnPlus,"+",t,false,ready&&!busy);
  snprintf(value,sizeof(value),"%d  / %s",lightDraft.onBelow,tr("采当前值","Use current"));button(kOnCapture,value,t,false,ready&&!busy&&freshAmbient(s,now),16);
  button(kOffMinus,"-",t,false,ready&&!busy);button(kOffPlus,"+",t,false,ready&&!busy);
  snprintf(value,sizeof(value),"%d  / %s",lightDraft.offAbove,tr("采当前值","Use current"));button(kOffCapture,value,t,false,ready&&!busy&&freshAmbient(s,now),16);
  text(24,384,tr("ADC 越大越亮；加减为 100，阈值差至少 64","ADC: brighter is higher; step 100; gap 64+"),t.muted,16);
  const bool canSave=ready&&!busy&&lightDraft.valid()&&(lightDirty||s.autoLightPaused);
  button(kLightSave,s.autoLightPaused&&lightDraft.enabled?tr("保存并恢复自动","Save and resume automatic"):tr("保存灯光设置","Save light settings"),t,canSave,canSave,24);
  const char* notice=lightNotice;
  if(!lightDraft.valid())notice=tr("关灯阈值需比开灯阈值大至少 64","OFF threshold must exceed ON by at least 64");
  else if(lightWaiting) {
    if(s.autoLightWrite==planter::CalibrationWrite::Unknown)notice=tr("结果待确认，正在读回；请勿重复保存","Awaiting readback; do not save again");
    else if(s.autoLightWrite==planter::CalibrationWrite::Failed)notice=!strcmp(s.autoLightError,"settings_conflict")?tr("设置已改变，请返回后重新打开","Settings changed; go back and reopen"):tr("保存失败，请检查连接与存储","Save failed; check connection and storage");
    else notice=tr("正在保存并读回","Saving and reading back");
  }
  text(24,459,notice,t.muted,16);
}
void handleAutoLight(const ui::TouchGate& touch,uint32_t now) {
  const auto s=planter::snapshot();if(!lightSettingsReady(s,now)||lightWriting(s))return;
  if(tapped(kLightSave,touch)) {
    if(lightDraft.valid() && (lightDirty || s.autoLightPaused)) {
      lightWaiting=planter::submitAutoLight(lightDraft);
      lightNotice=lightWaiting?"":tr("未发送，请返回重读设置","Not sent; reopen to refresh settings");
    }
    return;
  }
  bool changed=true;
  if(tapped(kLightMode,touch))lightDraft.enabled=!lightDraft.enabled;
  else if(tapped(kOnMinus,touch))lightDraft.onBelow=lightDraft.onBelow>=100?lightDraft.onBelow-100:0;
  else if(tapped(kOnPlus,touch))lightDraft.onBelow=lightDraft.onBelow<=3995?lightDraft.onBelow+100:4095;
  else if(tapped(kOffMinus,touch))lightDraft.offAbove=lightDraft.offAbove>=100?lightDraft.offAbove-100:0;
  else if(tapped(kOffPlus,touch))lightDraft.offAbove=lightDraft.offAbove<=3995?lightDraft.offAbove+100:4095;
  else if(tapped(kOnCapture,touch)&&freshAmbient(s,now))lightDraft.onBelow=int(s.ambientLightRaw.value);
  else if(tapped(kOffCapture,touch)&&freshAmbient(s,now))lightDraft.offAbove=int(s.ambientLightRaw.value);
  else changed=false;
  if(changed){lightDirty=true;lightWaiting=false;lightNotice=tr("尚未保存","Not saved yet");}
}
