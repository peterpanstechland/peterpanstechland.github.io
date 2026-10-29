// Included inside settings_ui's private namespace; uses its shared layout and
// native-size text helpers. No storage or network calls run on the UI task.
constexpr Rect kSoilCalibration{24, 132, 432, 100}, kTankCalibration{24, 258, 432, 100};
constexpr Rect kCalibrationSave{24, 405, 208, 48}, kCalibrationReset{248, 405, 208, 48};
robo::SensorCalibration calibrationDraft;
robo::CalibrationCapture calibrationCapture;
bool calibrationSoil = true, calibrationDirty = false, calibrationWaiting = false;
int calibrationTarget = 0;
const char* calibrationNotice = "";
Rect calibrationRow(unsigned index) { return {24, static_cast<int16_t>(230 + index * 56), 432, 50}; }
bool calibrationReady(const planter::State& s, uint32_t now) {
  return planter::fresh(s, now) && s.calibrationKnown && s.calibrationWritable && s.pumpKnown && !s.pumpOn && !s.commandBlocked;
}
bool calibrationWriting(const planter::State& s) {
  return s.calibrationWrite == planter::CalibrationWrite::Queued || s.calibrationWrite == planter::CalibrationWrite::Saving;
}
void openCalibration(bool soil) {
  calibrationSoil = soil; calibrationDraft = planter::snapshot().calibration;
  calibrationCapture.cancel(); calibrationDirty = calibrationWaiting = false; calibrationNotice = "";
  page = soil ? Page::Soil : Page::Tank;
}
const char* calibrationAvailability(const planter::State& s, uint32_t now) {
  if (!planter::fresh(s, now)) return tr("等待花盆连接与新鲜数据", "Waiting for fresh planter data");
  if (!s.calibrationKnown) return tr("请更新花盆主控固件", "Update the planter firmware");
  if (!s.calibrationWritable) return tr("主控存储不可用，请重启检查", "Planter storage unavailable; restart and check");
  if (s.pumpOn) return tr("浇水中，请等待水泵停止", "Wait for watering to stop");
  if (s.commandBlocked) return tr("请先处理未完成的硬件操作", "Resolve the pending hardware action first");
  return tr("保存到花盆主控，断电后保留", "Saved on the planter, retained after power off");
}
void drawCalibrationMenu(const ui_theme::Theme& t, uint32_t now) {
  const auto s = planter::snapshot();
  text(24, 86, calibrationAvailability(s, now), t.muted, 16);
  button(kSoilCalibration, tr("土壤 · 干湿参考点", "Soil / dry and wet"), t);
  text(40, 207, s.soilCalibrated ? tr("已标定 · 可重新采集", "Calibrated / can recapture") : tr("未标定 · 显示原始值", "Uncalibrated / raw readings"), t.muted, 16);
  button(kTankCalibration, tr("水箱 · 满水与缺水", "Tank / full and low water"), t);
  text(40, 333, s.tankCalibrated ? tr("已标定 · 可重新采集", "Calibrated / can recapture") : tr("未标定 · 显示距离", "Uncalibrated / distance only"), t.muted, 16);
  text(24, 388, tr("校准只记录参考点，不启动水泵", "Calibration records points; it never runs the pump"), t.ink, 16);
  text(24, 420, tr("水箱装好并固定探头后再标定", "Assemble the tank and fix the probe first"), t.muted, 16);
  text(24, 450, tr("未装水箱也能查看实时原始读数", "Live raw readings work before calibration"), t.muted, 16);
}
robo::CalibrationEdit calibrationEdit(bool reset) {
  robo::CalibrationEdit edit;
  edit.kind = calibrationSoil ? robo::CalibrationKind::Soil : robo::CalibrationKind::Tank;
  edit.revision = calibrationDraft.revision; edit.reset = reset;
  edit.a = calibrationSoil ? calibrationDraft.dry : calibrationDraft.tank.fullMm;
  edit.b = calibrationSoil ? calibrationDraft.wet : calibrationDraft.tank.emptyMm;
  edit.c = calibrationDraft.tank.stopMm;
  return edit;
}
const char* calibrationWriteError(const char* error) {
  if (!strcmp(error, "calibration_conflict")) return tr("校准已改变，请返回后重新读取", "Values changed; go back and reopen");
  if (!strcmp(error, "pump_busy")) return tr("水泵忙，停止后再保存", "Pump busy; stop watering before saving");
  return tr("保存未完成，请检查连接与存储", "Save failed; check connection and storage");
}
void drawCalibrationEditor(const ui_theme::Theme& t, uint32_t now) {
  const auto s = planter::snapshot();
  const bool ready = calibrationReady(s, now);
  if (ready && !calibrationDirty && !calibrationWaiting && !calibrationCapture.active()) calibrationDraft = s.calibration;
  const auto reading = calibrationSoil ? s.soilRaw : s.tankDistance;
  const bool ageKnown = calibrationSoil ? s.soilAgeKnown : s.ageKnown;
  const uint32_t age = calibrationSoil ? s.soilAgeMs : s.sampleAgeMs;
  const bool valid = ready && ageKnown && uint64_t(now - s.receivedMs) + age <= 3000 &&
    reading.valid && reading.value >= (calibrationSoil ? 0 : 20) && reading.value <= (calibrationSoil ? 4095 : 3500);
  if (calibrationCapture.active()) {
    int value = 0;
    const int result = calibrationCapture.sample(valid ? static_cast<int>(reading.value) : 0, valid, s.receivedMs, now, value);
    if (result < 0) calibrationNotice = tr("读数无效或不稳定，请重采", "Invalid or unstable reading; try again");
    if (result > 0) {
      if (calibrationSoil) (calibrationTarget == 0 ? calibrationDraft.dry : calibrationDraft.wet) = value;
      else if (calibrationTarget == 0) calibrationDraft.tank.fullMm = value;
      else if (calibrationTarget == 1) calibrationDraft.tank.stopMm = value;
      else calibrationDraft.tank.emptyMm = value;
      calibrationDirty = true; calibrationNotice = tr("已采集，尚未保存", "Captured, not saved yet");
    }
  }
  if (calibrationWaiting && s.calibrationWrite == planter::CalibrationWrite::Saved &&
      s.calibrationKnown && s.calibration.revision > calibrationDraft.revision) {
    calibrationDraft = s.calibration; calibrationWaiting = calibrationDirty = false;
    calibrationNotice = tr("已保存并从主控读回", "Saved and read back from the planter");
  }
  text(24, 84, calibrationAvailability(s, now), t.muted, 16);
  char live[80];
  if (valid) snprintf(live, sizeof(live), calibrationSoil ? tr("实时原始值  %d", "Live raw value  %d") : tr("探头距离  %d mm", "Probe distance  %d mm"), static_cast<int>(reading.value));
  else snprintf(live, sizeof(live), "%s", tr("实时读数  --", "Live reading  --"));
  indicator::display().fillRoundRect(24, 112, 432, 56, 10, t.surface);
  text(40, 127, live, t.ink, 24, 400);
  text(24, 180, calibrationSoil ? tr("干点：同种干燥基质；湿点：浇透沥干", "Dry: dry growing medium. Wet: watered, drained.") : tr("固定探头：依次采满水、最低安全水位、空箱", "Fixed probe: capture full, safe low, then empty."), t.muted, 16);
  text(24, 203, calibrationSoil ? tr("保持插入深度；勿浸湿电路，勿用空气代替土壤", "Keep insertion depth; keep electronics dry.") : tr("缺水点需覆盖泵进水口；此过程不启动水泵", "Low point must cover pump intake; pump stays off."), t.muted, 16);
  const bool awaitingReadback = calibrationWaiting && (s.calibrationWrite == planter::CalibrationWrite::Saved || s.calibrationWrite == planter::CalibrationWrite::Unknown);
  const bool busy = calibrationCapture.active() || calibrationWriting(s) || awaitingReadback;
  const char* labels[] = {calibrationSoil ? tr("干燥参考", "Dry reference") : tr("满水", "Full water"),
    calibrationSoil ? tr("湿润参考", "Wet reference") : tr("缺水停泵", "Low-water stop"), tr("空箱参考", "Empty reference")};
  const int values[] = {calibrationSoil ? calibrationDraft.dry : calibrationDraft.tank.fullMm,
    calibrationSoil ? calibrationDraft.wet : calibrationDraft.tank.stopMm, calibrationDraft.tank.emptyMm};
  for (unsigned i = 0; i < (calibrationSoil ? 2u : 3u); ++i) {
    char label[96], number[16];
    if (values[i] >= 0) snprintf(number, sizeof(number), "%d%s", values[i], calibrationSoil ? "" : " mm");
    else snprintf(number, sizeof(number), "--");
    snprintf(label, sizeof(label), "%s  %s  / %s", labels[i], number, tr("采集", "Capture"));
    button(calibrationRow(i), label, t, calibrationCapture.active() && calibrationTarget == static_cast<int>(i), valid && !busy, 16);
  }
  if (calibrationSoil) text(24, 354, tr("百分比是相对湿润程度，并非体积含水率", "Percent is relative wetness, not water content"), t.muted, 16);
  const bool endpointsValid = calibrationSoil ? calibrationDraft.soilValid() : calibrationDraft.tankValid();
  const bool canSave = ready && !busy && calibrationDirty && endpointsValid;
  button(kCalibrationSave, tr("保存校准", "Save calibration"), t, canSave, canSave, 16);
  button(kCalibrationReset, tr("清除参考点", "Reset points"), t, false, ready && !busy, 16);
  const char* notice = calibrationNotice;
  char progress[80];
  if (calibrationCapture.active()) { snprintf(progress, sizeof(progress), tr("稳定采样 %u / 5，请保持不动", "Stable samples %u / 5; keep still"), calibrationCapture.count()); notice = progress; }
  else if (calibrationWaiting) {
    if (s.calibrationWrite == planter::CalibrationWrite::Unknown) notice = tr("结果未确认，正在读回；请勿重复保存", "Result unknown; reading back. Do not repeat.");
    else if (s.calibrationWrite == planter::CalibrationWrite::Failed) notice = calibrationWriteError(s.calibrationError);
    else notice = tr("正在保存并校验，请稍候", "Saving and verifying; please wait");
  } else if (calibrationDirty && !endpointsValid) notice = calibrationSoil ? tr("干湿差至少 64；请采齐或重采", "Dry/wet gap must be 64+; capture both points") : tr("需满水 < 缺水 < 空箱，各相隔至少 10mm", "Full < low < empty; gaps must be 10+ mm");
  text(24, 459, notice, t.muted, 16);
}
void drawCalibrationReset(const ui_theme::Theme& t) {
  text(24, 100, calibrationSoil ? tr("清除土壤干湿参考点？", "Reset soil reference points?") : tr("清除水箱水位参考点？", "Reset tank reference points?"), t.ink, 24);
  text(24, 164, tr("保存到主控后，断电也不会恢复旧值", "Saved on the planter; old values will not return"), t.muted, 16);
  text(24, 198, calibrationSoil ? tr("土壤恢复显示原始值，直到重新标定", "Soil returns to raw readings until recalibrated") : tr("水位恢复显示距离，浇水将被锁定", "Tank returns to distance; watering will be locked"), t.muted, 16);
  text(24, 249, tr("另一个传感器的校准不受影响", "The other sensor's calibration is kept"), t.muted, 16);
  button(kCalibrationSave, tr("确认清除", "Confirm reset"), t, true, true, 16);
  button(kCalibrationReset, tr("取消", "Cancel"), t, false, true, 16);
}
bool handleCalibration(const ui::TouchGate& touch, uint32_t now) {
  if (page == Page::Calibration) {
    if (tapped(kSoilCalibration, touch)) openCalibration(true);
    else if (tapped(kTankCalibration, touch)) openCalibration(false);
    return true;
  }
  if (page != Page::Soil && page != Page::Tank && page != Page::ResetCalibration) return false;
  const auto s = planter::snapshot();
  if (page == Page::ResetCalibration && tapped(kCalibrationReset, touch)) { page = calibrationSoil ? Page::Soil : Page::Tank; return true; }
  if (!calibrationReady(s, now) || calibrationCapture.active() || calibrationWriting(s) ||
      (calibrationWaiting && (s.calibrationWrite == planter::CalibrationWrite::Saved || s.calibrationWrite == planter::CalibrationWrite::Unknown))) return true;
  if (page == Page::ResetCalibration) {
    if (tapped(kCalibrationSave, touch)) {
      calibrationWaiting = planter::submitCalibration(calibrationEdit(true));
      calibrationNotice = calibrationWaiting ? "" : tr("未发送，请返回重读校准值", "Not sent; reopen to refresh values");
      page = calibrationSoil ? Page::Soil : Page::Tank;
    }
    return true;
  }
  const auto reading = calibrationSoil ? s.soilRaw : s.tankDistance;
  for (unsigned i = 0; i < (calibrationSoil ? 2u : 3u); ++i) if (tapped(calibrationRow(i), touch) && reading.valid) {
    calibrationTarget = i; calibrationWaiting = false; calibrationNotice = "";
    calibrationCapture.start(now, calibrationSoil ? 40 : 4); return true;
  }
  if (tapped(kCalibrationSave, touch) && calibrationDirty && (calibrationSoil ? calibrationDraft.soilValid() : calibrationDraft.tankValid())) {
    calibrationWaiting = planter::submitCalibration(calibrationEdit(false));
    calibrationNotice = calibrationWaiting ? "" : tr("未发送，请返回重读校准值", "Not sent; reopen to refresh values");
  } else if (tapped(kCalibrationReset, touch)) page = Page::ResetCalibration;
  return true;
}
