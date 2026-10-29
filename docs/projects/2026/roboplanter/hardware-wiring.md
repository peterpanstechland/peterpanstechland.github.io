---
title: "当前硬件连接"
description: "2026-10-29接线总表、SEN54分线供电、Indicator土壤与当前验收状态。"
sidebar_position: 3
hide_title: true
---

# 最新硬件接线 · 2026-10-29

适用实物：**XIAO ESP32-S3 Plus + XIAO Robot Board V1.0、SenseCAP Indicator D1**，不是 XIAO Sense。本页替代早期 I²C 水位、GPIO43 打印和 SERVO4 水泵方案。[三维接线小工坊](https://peterpanstechland.github.io/roboplanter/#wiring-lab)使用同一版分配。

## 整机通信

```text
Robot Phone / YOYO Skill ── 加密 BLE ──► XIAO Robot Board
                                              ▲  │
                                  同一 2.4GHz Wi-Fi / HTTP
                                              │  ▼
                                       Indicator ESP32-S3
                                              ▲  │ 内部 UART
                                              │  ▼
                                       Indicator RP2040
                                      土壤 ADC / 蜂鸣器
```

两块开发板分别 USB/5V 供电，**不互接外部 UART、I²C 或 USB 数据线**。当前两板作为客户端连接同一路由器；XIAO SoftAP仍是源码支持的可选方式。手机直接连XIAO BLE，Indicator不是蓝牙中继；阿里云/MQTT不是本地路径的前置条件。

![当前硬件与通信连接](/roboplanter/assets/wiring-overview.svg)

## 接线总表

换线前断电，按实物丝印识别pin1，不按图中的左右方位猜针脚。下表已注明GPIO所属芯片。

| 外设 | 信号连接 | 供电与其他线 | 当前验证 |
| --- | --- | --- | --- |
| Grove SEN54 | Robot IIC1/J11或IIC2/J12：pin2 SDA→XIAO GPIO5，pin1 SCL→GPIO6，地址0x69 | **红线独立5V**，黑线共地；I²C信号/上拉保持3.3V | 温湿度、PM2.5、VOC有效，屏幕显示正常 |
| Grove Ultrasonic Ranger v2.0 | SERVO2/J5 pin1，D9 / XIAO GPIO8→黄线SIG | 红线另取3.3V，黑线共地，白线不接；不用Servo的5V | 距离变化通过；用户确认实际满水35/停泵61/空箱80mm |
| Grove Relay v1.2 | SERVO1/J1 pin1，D15 / XIAO GPIO42→SIG | 模块支持3.3–5V，使用已核对的接口电源和共地；白线不接 | 空载通过；用户确认12V/150mA泵、水箱与进出水完成，本机已启用 |
| Grove Light Sensor v1.2 | SERVO3/J13 pin1，D0 / XIAO GPIO1→黄线OUT | 红线另取3.3V，黑线共地，白线不接 | 遮挡/照亮后ADC明显变化 |
| EM5826H热敏打印机 | **SERVO4/J14 pin1，D8 / GPIO7→打印机RX**；打印机TX→UART/J10 pin2，D7 / GPIO44 | 独立12V、与XIAO共地；本机返回TX已确认3.3V逻辑 | 中文、比例、78牌日签、切纸、屏幕预览一致通过 |
| Grove WS2813灯带 | RGB/J7 pin1，D13 / XIAO GPIO40，经板载缓冲→DIN | 适配5V/GND；10颗，亮度上限24/255 | 已接入；屏幕可保存自动阈值，YOYO开关灯待单独验收 |
| 电容式土壤探头 | Indicator左侧Grove ADC黄线→**RP2040 GPIO27** | 3.3V、GND；白线GPIO26不用 | RP2040→屏幕→HTTP→主控→YOYO读数通过；未标定 |
| Indicator内置蜂鸣器 | RP2040 GPIO19，内部连接 | 无需外接 | 程序已部署、默认关闭；听音待验收 |
| 无源NFC贴 | 无GPIO接线 | 手机读取标签 | 作为入口；直达指定Skill的链接待验证 |

**M2/J9不使用。** SERVO4已被打印机占用，不能接泵或舵机。GPIO43/J10 TX留空，避免ESP32 ROM上电日志被打印出来。Printer TX接GPIO44不代表已实现缺纸/刀具状态读取，当前仍需人工观察。

## SEN54替代关系与供电

SEN54已替代 **Grove Temperature & Humidity v2.0（DHT20）和 Air Quality v1.3**。DHT20可断电后拆下备用；固件已禁用DHT20、SHT31、模拟AIR。UV v1.1也已被Light Sensor v1.2替换。

IIC1与IIC2共用GPIO5/6，是同一总线的两个插座，板载IMU也在这条总线上，**不能牺牲其中一个改UART**。空余IIC插座留作扩展，核对电压与地址后再接。

SEN54本体需要4.5–5.5V。Robot IIC pin3只有3.3V，不能整根Grove线直接供电：将模块红线从IIC电源脚分离，接稳定5V；黑线共地，黄/白信号仍接原总线。转接板若上拉到5V，须改为3.3V或加合适电平转换；不能把5V反灌到IIC的3.3V脚。本机已完成该接法确认。

SEN54提供温湿度、颗粒物及VOC指数，**不提供CO₂或NOx**。驱动检查CRC和无效码；Indicator当前显示温湿度、PM2.5、VOC。D1自身不含D1S等型号的CO₂/VOC模块。

## Indicator内部采集与提示音

土壤接Indicator，不再占用Robot SERVO3。内部连接无需另焊外部线：

| 通道 | 引脚与方式 |
| --- | --- |
| 土壤 | RP2040 GPIO27 ADC，输出归一到0–4095原始值 |
| 内部UART | RP2040 TX16→ESP32 RX20；RP2040 RX17←ESP32 TX19；115200 baud |
| 上传 | RP2040挑战应答/CRC→ESP32→带设备鉴权的HTTP→XIAO |
| 蜂鸣器 | ESP32发送B\|focus行，RP2040 GPIO19产生2400Hz、180ms短音 |
| 另一侧Grove I²C | RP2040 SDA20、SCL21，当前预留；不与Robot IIC互接 |

Wi-Fi设置保存在Indicator非易失存储，断电后仍在，正常启动会重连。Wi-Fi连上不等于花盆HTTP鉴权成功，去“设置 → 花盆连接”查看结果。土壤断线后读数必须失效，未标定不显示百分比。

蜂鸣器可发提示音，不能播放YOYO语音，语音由手机输出。番茄钟页可开启提示音并保存，听音仍待验证。

## 超声波、水箱与水泵

Grove Ranger v2.0是**单SIG双向**测距，不能套用HC-SR04的TRIG/ECHO两线，也不能接I²C口。探头保持干燥、装在水面上方并避开箱壁、水流与冷凝。小水箱能否获得可靠回波需实测。

继电器空载测试通过。用户现已确认独立12V/150mA泵、水箱、进出水和实际标定完成，本机私有固件已设置 `ROBO_ENABLE_PUMP=1` 及硬件确认。公开示例仍默认关闭。新装置需自行核对启动电流、触点、电源、保护与进水条件，并在 **设置 → 花盆连接 → 传感器校准** 中实测保存：

- 满水：日常最高水面时探头距离。
- 空箱参考：空箱参考面的距离。
- 缺水停泵：仍能保护泵进水口的停泵距离。

约束为 `20 <= full < stop < empty <= 3500`，单位mm，相邻点至少相隔10mm；不能仅由箱深推算。水位百分比是高度比例，不是毫升。校准保存在主控NVS中，土壤干湿参考也从此页面采集，无需重刷固件。详见[校准工具教程](/docs/projects/2026/roboplanter/sensor-calibration)。

负载回路：独立12V正极→继电器常开触点一端→另一端→泵正极；泵负极→12V负极。Grove Relay只有两颗负载端子，不存在第三颗NC端子。本机已发送一次500ms命令，主控完成并停泵；用户确认有出水、随后停止。校准或启用功能都不会自动浇水。

源码已有未标定、无回波/过期、低水位、异常距离的禁启/运行中停泵，以及泵/打印互斥。软件测试不代替实体水箱、负载、复位和断线试验。

## 最新验收与固件边界

2026-10-29手机输入Indicator显示的六位码后，主控确认SC+MITM+bonding成功；用户用YOYO“读取工位状态”获取土壤、温度和湿度。详见[日常交互](/docs/projects/2026/roboplanter/yoyo-companion)。

Indicator日签预览/打印/比例/切纸已通过，设备侧共享番茄钟和会议场景小票通过。手机开关灯、自动场景打印、番茄钟、重启重连待分别验收；本机泵已启用，仍受水位保护和单次时限约束。校准工具、新配对提示与48px大码已随2026-10-29校准固件刷入；主控已有一组土壤参考，重启保存验证通过，基质参考条件仍需现场确认。新增 **设置 → 灯光设置** 可保存开/关阈值；自动开关由XIAO独立执行，手动命令优先。

## 核对资料

- 板卡依据：用户套件V1.0原理图、`firmware/xiao/include/robo_config.h`。
- [SEN5x官方驱动](https://github.com/Sensirion/arduino-i2c-sen5x)
- [Grove Ultrasonic Ranger](https://wiki.seeedstudio.com/Grove-Ultrasonic_Ranger/)、[Grove Relay](https://wiki.seeedstudio.com/Grove-Relay/)
- [Indicator ADC](https://wiki.seeedstudio.com/SenseCAP_Indicator_RP2040_Grove_ADC/)、[内置蜂鸣器](https://wiki.seeedstudio.com/SenseCAP_Indicator_RP2040_Buzzer/)
