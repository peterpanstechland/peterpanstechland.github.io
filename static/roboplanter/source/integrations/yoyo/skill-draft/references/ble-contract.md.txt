# RoboPlanter BLE v2 契约

本契约用于 0.4.0 联调。V 是公开协议标记，设备必须启用 ROBO_ENABLE_BONDED_YOYO；链路需要 Secure Connections + MITM + bonding，并且只有本机两分钟配对窗口内登记的那一部手机可以操作。端侧检查每次连接，不依赖提示词保密。旧令牌、旧单次读权限、无效 probe 均不是 v2 的回退方案。

固定 GATT 服务 a2f39c10-7e4b-4d21-8a61-0f3bc9d15001，特征 a2f39c11-7e4b-4d21-8a61-0f3bc9d15001，WRITE + NOTIFY，设备 RoboPlanter-A994。先订阅通知，等待写响应和本次业务通知；不把 ACK 或系统配对成功当动作完成。每命令最多240字节；由官方工具/系统处理 ATT 长写，技能不可自行拆串。最长中文场景命令需真机验证。

## 查询（V|S|字段）

- desk → K:raw:temperature10:humidity。温度除10，湿度为%，raw只表示土壤ADC；x为未知，三项分别解释。
- soil → S:raw:percent:valid:calibrated。valid=0时raw不能当新读数；calibrated=0时不判断干湿。
- env → E:temperature:humidity:valid，温度°C，空气湿度%。
- ambient → B:raw:valid，只是环境光ADC，不是lux。
- pm25 → M:value:valid，µg/m³。
- voc → V:value:valid，VOC指数，不是ppb、CO₂或CO浓度。
- tank → W:distance_mm:valid，未完成水箱标定，只报告探头距离，不报余水百分比。
- focus → F:phase:remaining_seconds:duration_seconds；phase 0待机、1计时、2暂停、3完成。
- light → L:enabled:on；pump → P:enabled:on:remaining_ms。
- printer → T:enabled:status；sent仅串口已发，fail需现场恢复，不能继续塞入打印任务。
- auto → AUTO:0/1，跨重启保留的自动打印开关。

未知、过期、未标定不能补零。主控按传感器有效性限制，土壤来自Indicator的独立有效期。每次用户明确读取才按需查询，避免闲聊时反复轮询。

## 动作和结果

`V|C|id|action|参数`，id为1–8位安全字母数字或短横线（技能统一生成8位），命令参数见根SKILL。`V|R|id` 查询原请求。

- A:id：已受理；D:id：软件完成。
- E:id:OFF：对应外设未启用；LOCK：动作锁定；TANK：水箱条件不足。
- E:id:STATE：计时状态不允许；不要重开覆盖正在运行的番茄钟。
- E:id:MUTE：自动打印已关闭；COOL：同场景五分钟限流；正常接着聊。
- E:id:BUSY：设备正忙；不能自动排队重试或换id。
- E:id:IO：打印失败／恢复锁；检查打印机与纸张，不宣称已出纸。
- E:id:ID：相同id不同参数；FULL：当前启动周期的64条去重记录已满。
- E:id:MISS：找不到记录；可能主控重启，不能推断“没有执行”。
- E:PAIR：未通过系统配对和加密连接；到Indicator开启配对。不索取聊天密钥。
- E:STALE／无效读数：当前没有新数据；E:FORMAT／SIZE／ARG：参数不被支持。

动作一旦发送，超时只查询同一个id，最多三次（每次间隔至少一秒）；依然未知就如实告知用户，停止自动重试。打印耗时可以超过工具的3秒回包窗口；A仅代表受理，后续R才读结果。只有用户重新明确要求并知晓上一次可能已执行，才新建id再执行。

请求缓存不跨断电。打印队列和水泵互斥，未校准水箱/无效距离/低水位均不能启动泵。禁止拆短浇水来绕过上限。当前版本完全不发启动泵命令。

## 屏幕与设备

Indicator每秒左右从同一XIAO状态接口刷新，网络耗时会增加显示延迟。远端开始番茄钟时，在不打断设置、确认和养成页的前提下跳到计时页；其他情况下用户稍后进入即可看到共享计时。手机断开不取消计时；主控断电会清零。RP2040 GPIO19仅是无源蜂鸣器，180ms提示音，默认静音，用户可在计时页开启。不是可播放YOYO语音的扬声器。

场景小票采用384点宽、128行带状位图；logo/状态/待办/78牌及正逆位沿用已验收排版。scene: checkin/lunch/meetings/rest/lowbattery；automatic标志1表示自动、0表示用户明确手动。每次有效命令仅生成一次牌面，重复id不重复出纸。标题与短句变体不等于屏幕已经预览了该牌。
