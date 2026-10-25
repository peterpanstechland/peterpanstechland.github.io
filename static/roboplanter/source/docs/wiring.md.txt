# RoboPlanter 接线与首次联调

本版面向附件中的 XIAO ESP32-S3 Plus + XIAO Robot Board，以及原款 480×480 SenseCAP Indicator。引脚按附件 V1.0 原理图核对；实物 PCB 修订号、外设型号和电流仍需确认。新的固件不运行原小车电机、舵机或加热器业务。

## XIAO 与 Indicator 的连接

首版不接两块板的 UART 或 I²C。XIAO 建立 2.4 GHz Wi-Fi 热点，Indicator 作为客户端连接，查询 `http://192.168.4.1/api/v1/state` 并发送操作请求。两端使用相同的设备令牌。

1. 首先只给两块板 USB 供电，编译并烧录各自程序。
2. 在 XIAO 的串口输出中取得 `RoboPlanter-XXXX` 名称。
3. 将名称、热点密码和设备令牌填入 Indicator 的 `include/local_config.h`，重新编译 Indicator。
4. 屏幕应显示设备标识与未启用的传感器状态。未启用的数据不是 0，也不是模拟读数。
5. 逐项接传感器并修改 XIAO 配置。执行器在供电、驱动和参数确认后启用。

Indicator 内部 ESP32-S3 与 RP2040 已有自己的通信与连接；本版只替换 ESP32 程序，不改 RP2040，也不占用两芯片的内部 UART。屏幕初始化来自 Seeed 原款 ST7701 方案，触摸及显示方向仍需在实机验收。来源：[Seeed Indicator Arduino 指南](https://wiki.seeedstudio.com/SenseCAP_Indicator_ESP32_Arduino/)。

## XIAO 外设接线

表中连接器编号来自原理图，不是实物插座的“从左到右”顺序。接线时按 PCB 丝印与万用表确认 GND、电源、信号，不能只按线色或看入方向套用。

| 器件 | 信号连接 | 电源与地 | 本版条件 |
| --- | --- | --- | --- |
| 电容式土壤湿度 | 模拟 OUT → D0 / GPIO1，Servo3 的信号 J13 pin1 | 传感器规格允许时用 3.3V；GND 共地 | 转接线只取 Servo3 信号，另接 3.3V；不要拿 Servo3 的 5V 脚当 3.3V。具体 SKU 未定，默认禁用。 |
| Grove Air Quality v1.3 | OUT → D9 / GPIO8，Servo2 的信号 J5 pin1 | 3.3V、GND | 断开原 Servo2；独立模拟输入，保留原始 ADC 值，不换算为 CO₂。 |
| Grove UV v1.1 | 预留 D10 / GPIO9，M2 ENC B / J9 pin4 | 按实物规格确认，ADC 信号不得超出 3.3V | 候选接口带 22Ω 串阻及 4.7kΩ 上拉，可能改变输出；默认禁用，测量确认前不接。若不适合，增加外部 ADC 后再改实现。 |
| 温湿度传感器 | 若为 SHT31：SDA→D4/GPIO5，SCL→D5/GPIO6 | Grove I²C 的 3.3V、GND | 代码提供 SHT31 0x44 可选驱动。若实际是 DHT11/DHT22/AHT 等，不能直接启用该配置。 |
| Grove 灯带 | DIN → Grove RGB J7 pin1，对应 GPIO40 的板载缓冲输出 | 仅对已确认的 5V 型灯带使用 J7 的 5V/GND | 代码为 NeoPixel 类单线灯带；型号、协议、灯数和电流需匹配。不是所有 Grove 灯带都兼容。 |
| 12V 水泵 | D8 / GPIO7，Servo4 J14 pin1 → 外置驱动模块 IN | 泵由独立 12V 支路供电；驱动和 XIAO 控制地共地 | 接受 3.3V 输入、低电平关闭的合适 MOSFET/驱动。不能接板载 M1/M2 的 5V 电机输出。 |
| 12V TTL 打印机 | XIAO TX D6/GPIO43 → 打印机 RX；可选打印机 TX → D7/GPIO44 | 打印机独立接 12V/GND | 核实 TTL 电平后直连或加电平转换；不接 Grove 的电源脚给打印机供电。本版只发送 ASCII，不读取打印机反馈。 |
| NFC 贴 | 无电线，由手机读取 | 无源 | 保存入口链接，直接唤起 YOYO 的方式仍待验证。 |

模拟传感器不能接到 Grove I²C 的 SDA/SCL 当作模拟口。I²C Hub 可给多个真正的 I²C 设备共用总线，但不能把多个模拟输出合并。模拟传感器可使用 Grove 转杜邦/分线转接，将电源与信号分别连接。

## 载板连接器对照

| V1.0 连接器 | 原理图 pin1 | pin2 | pin3 | pin4 |
| --- | --- | --- | --- | --- |
| J13 Servo3 | D0 / GPIO1 | NC | Motor_5V | GND |
| J14 Servo4 | D8 / GPIO7 | NC | Motor_5V | GND |
| J5 Servo2 | D9 / GPIO8 | NC | Motor_5V | GND |
| J11 / J12 Grove I²C | SCL D5 / GPIO6 | SDA D4 / GPIO5 | 3.3V | GND |
| J10 Grove UART | TX D6 / GPIO43 | RX D7 / GPIO44 | 3.3V | GND |
| J7 Grove RGB | 缓冲后的 RGB 信号 | NC | VSYS_5V | GND |

Servo2/3/4 信号经 0Ω 电阻到对应 GPIO，未经过单向缓冲。RGB 信号则经过 5V 供电的 SN74LVC1G17 缓冲，只用于匹配的灯带。I²C 总线还连接 IMU 地址 0x6A；当前可选 SHT31 默认 0x44，不与其冲突。

## 12V 与 5V 的供电分配

```text
12V 电源
  ├── 打印机 +12V
  ├── 水泵 +12V / 适合的外置驱动
  └── 12V → 稳压 5V 降压
       ├── Robot Board 指定 USB-C 5V 电源入口
       └── SenseCAP Indicator USB-C

3.3V 传感器从已确认的 3.3V 分支供电
所有电气相连的驱动、传感器、打印机与 XIAO 共享 GND
```

若 Indicator 使用独立 USB 电源，Wi-Fi 通信不要求再额外拉一根信号地线。共享同一个降压电源时自然共地。

水泵采用外置低侧 MOSFET 驱动时，通常为泵正极接 +12V，负极接驱动开关端，驱动电源地接公共 GND；具体端子按模块说明接。驱动需要默认关闭的输入偏置，并按泵类型配置续流保护。泵电流、打印峰值电流和灯带电流未知，当前不指定适配器安培数或 MOSFET 型号。

12V 不能直接接 XIAO、Grove、Indicator 或载板的 5V 输入。载板电池口仍按原设计使用，不能把 12V 支路接到其 7.4V 电池口。USB 下载和外部供电同时使用前须核对供电路径；首轮建议逐板 USB 调试。

## 软件配置顺序

先启用土壤原始值，分别记录实际探头的干、湿参考值，再填写标定参数。百分比是这两点之间的相对值，不是实验室测得的体积含水率。之后再启用温湿度、空气质量、灯带、打印机，最后启用外部泵。

泵默认最大单次运行时间为短脉冲，按实际流量调整配置。`duration_ms` 是运行时间，不是毫升数；没有流量计时不能声称准确浇水体积。断开手机或屏幕后，泵仍应在 XIAO 端到时停止。

接线事实依据：本机附件 V1.0 原理图第5–6页（见[参考资料定位](../reference/README.md)）、[XIAO S3 系列官方引脚表](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)。载板原代码与该图的 M1/加热器脚有版本差异，已记录在[可行性核对](feasibility-review.md)。
