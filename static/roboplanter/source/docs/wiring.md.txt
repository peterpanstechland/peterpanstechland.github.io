# RoboPlanter 接线与首次联调

本版面向附件中的 XIAO ESP32-S3 Plus + XIAO Robot Board，以及原款 480×480 SenseCAP Indicator。引脚按附件 V1.0 原理图核对；实物 PCB 修订号、外设型号和电流仍需确认。新的固件不运行原小车电机、舵机或加热器业务。

2026-10-26 用户补充现有硬件还包括热敏打印机、空气质量模块、空气温湿度模块。随后确认打印机与 `peterpanstechland/robophone-base` 项目同款。本机该项目的驱动和部署记录采用 **USB 1d81:5721、58mm纸、384点宽** 的打印路径，中文先栅格化，再发送 ESC/POS 位图；当前这台 RoboPlanter 打印机尚待 USB 枚举与出纸验收。空气模块具体型号仍未提供。下文 SHT31、Air Quality v1.3 和 12V TTL 打印机是既有候选方案，不能据此把未知实物视为这些型号，尤其不能默认给当前打印机接12V。

### 同款打印机与当前串口接入方向

用户随后明确选择尝试 **XIAO UART／TTL 侧接入**，不采用电脑 USB 打印作为本轮接线方案。XIAO 使用 J10 的 D6/GPIO43 TX、D7/GPIO44 RX，逻辑侧3.3V。打印机外部接口若确认为 RS232，路径应为 **XIAO 3.3V UART → 匹配的 UART↔RS232 收发器 → 打印机 RS232**；若实物另有明确标注的 TTL 接口，则按其输入／输出电平确认是否直连或需要逻辑电平转换。不能仅因用户选择“TTL方案”就把这款打印机现有的 RS232 口当成 TTL。

原项目尚未给出这台打印机串口的确切针脚、波特率、流控和逻辑／RS232接口详情。下一步须查看实物端口标注、手册或自检页；未确认前不接 D6/D7、不启用打印固件，也不猜测9600波特或电源电压。以下 USB 信息仅用于识别同款设备与参考已有位图协议，不代表用户本轮改走 USB。

- 打印机使用原配电源供电，USB 数据线接 **电脑或 Jetson 的 USB Host**。不接 XIAO 的 J10 Grove UART；`USB + RS232` 机型的 RS232 接口也不能当作3.3V TTL 直连。
- 可复用 `robophone-base/software/jetson-companion-service/image_print_service.py` 的 `UsbReceiptPrinter`：限制一台 `1d81:5721`、接口0、Printer Class、Bulk OUT 01 / IN 81，发送单色分段位图及走纸／切纸指令。`escpos_printer.py` 的默认点宽为384；产品字符串 `80E` 不代表80mm纸宽。
- 该项目2026-10-25部署记录确认一次完整位图与切纸指令传输，但该条记录的 `physical_paper_verified` 为 false，不能据此认定当前这台设备已经实印通过。
- 当前 XIAO 固件仍仅有关闭的可选 UART 文本驱动，**没有 USB Host 打印驱动**。复用 USB 路径需要电脑／Jetson 打印服务；它与现有只读 MQTT 网关、手机一次性土壤读取权限分别处理，不会因读数成功而自动开放打印。
- 当前电脑尚未枚举到该 USB 打印机。若另行采用 USB 验收，须先核对 VID/PID，再由用户确认实际出纸、方向与切纸；主机发送成功只能报告发送完成，不能代替纸面确认。

## 两块板的接口怎么分配

2026-10-25 重新对照套件照片、V1.0 原理图及 Seeed 官方 Indicator Grove 文档。下面区分现有固件的候选接线与新增硬件规划，不代表已经完成实物联调。

### Robot Board：核心采集与执行

附件 V1.0 板明确标为 Grove 扩展的接口是 **4 个：IIC1、IIC2、UART、RGB**。此外有 4 路 Servo 接口和电机/编码器接口；不能将外形相似的插座视作可互换的 Grove 传感器口。若实物有不同数量或丝印，须按该修订版重新核对，不能由这份 V1.0 资料推断。

- **IIC1 / IIC2（J11 / J12）**：共用 GPIO5 SDA、GPIO6 SCL 和 3.3V，是同一条总线的两个插座。候选分配为一路接已确认型号的 I²C 温湿度传感器，另一路接 I²C 水位传感器。现有固件只有可选 SHT31 驱动；DHT11/DHT22 不能直接当作 I²C 模块接入，DHT20 虽为 I²C，也需要对应驱动，不能套用 SHT31 协议。水位型号仍待水箱尺寸确定，尚无水位驱动。若采用 Grove Water Level Sensor 10cm，需同时处理 `0x77`、`0x78` 两个地址，不能只检查其中一个；10cm 是检测范围，整板长 133mm，不保证适合当前水箱。
- **RGB（J7）**：接已确认供电和协议的 WS2812 灯带 DIN；该口有 GPIO40 的板载缓冲输出。灯带电流按灯数与亮度核算。
- **UART（J10）**：仅适用于已确认的 TTL 串口打印机，XIAO TX → 打印机 RX，公共地；打印机按其铭牌要求另行供电，不使用 J10 的 3.3V 给打印机供电。原候选为 12V 型号，新增实物尚未确认；USB 型打印机不能套用此接法。
- **Servo3（J13）的信号脚**：复用为土壤湿度模拟输入 GPIO1。使用转接线并按传感器规格另取 3.3V，不能把 Servo 电源脚当成 3.3V。
- **Servo4（J14）的信号脚**：GPIO7 接外置水泵驱动 IN；12V 水泵由独立支路供电，不能直接插到 Servo 或板载 5V 电机输出。
- **Servo2（J5）的信号脚**：断开原舵机后，可复用 GPIO8 为已核实的 Air Quality v1.3 模拟输入。
- **UV**：现有 GPIO9 / M2 ENC B 仅为待验证候选，存在上拉负载，默认不接。不要为凑齐接口而直接插入。

原方案将核心土壤、水位采集与泵控制集中在 XIAO。本轮实际接法改为 Indicator 左侧 Grove 采集土壤，经过内部 UART 与 Wi-Fi HTTP 汇总到 XIAO；泵仍由 XIAO 控制。远端土壤数据断线必须失效，不能拿旧值决定浇水。当前没有启用自动浇水。**水位参与禁止启动/运行中停泵的逻辑目前尚未实现**；现有单次限时停泵不能代替低水位保护。新增水位时还需实现标定、读数有效期，以及低水位/传感器故障的处理。

上述 IIC2 水位分配只适用于真正的 I²C 型号。若改用普通 Grove Ultrasonic Ranger，它使用单根 SIG 的触发/回波信号，需要另行核对可用数字 GPIO 并编写测距驱动，不能直接插到 I²C 口套用该分配。

### Indicator：显示与可选环境扩展

原款 Indicator 的两个 Grove 口分别为 **I²C** 与 **可配置数字/模拟口**，都由内部 **RP2040** 管理，并非直接接到用于屏幕的 ESP32-S3：

- **Grove I²C**：RP2040 GPIO20 SDA、GPIO21 SCL。可留作后续照度或温湿度等经过电气和地址核对的 I²C 环境模块；不要把它与 XIAO 的 I²C 总线直接互连。当前首版温湿度仍放在 XIAO，不在两端重复安排同一只传感器。
- **Grove ADC**：引出 RP2040 GPIO26 / GPIO27；普通单输出 Grove 模块通常只使用其中一根信号线，接线应按具体模块及插座方向确认。可作为后续 UV 模拟输入的候选，避开 Robot Board GPIO9 的既有上拉；仍须核对模块供电及输出电压，模拟输入不得超过 3.3V。若引出两路独立 ADC，必须分别接各自信号，不能用并联 Hub 合并两个模拟输出。

**默认构建仍不开启 Grove 采集；2026-10-26 的可选联调版已实现左侧土壤 ADC。**RP2040 通过自定义挑战应答／CRC16 内部 UART 协议交给屏幕 ESP32，再经鉴权 HTTP 上传 XIAO。该路径不是原厂 COBS 协议，须单独安装 `soil_uart.py` 并开启 `PLANTER_ENABLE_LOCAL_SOIL`。右侧 I²C 环境采集仍未实现；手机 YOYO 的实际调用也须另行验收。

2026-10-26 桌面接线检查：**背面标签朝上、两个 Grove 口在标签下方时，左侧为 ADC，右侧为 I²C；两个口的电源均标为 3V3。**蓝色 Grove Capacitive Moisture Sensor (Corrosion Resistant) 是模拟土壤湿度探头，只测相对湿度变化，不测温度，应接左侧 ADC 口，黄色 SIG 对应 GPIO27。接在右侧 I²C 口时，左侧 ADC 的任何数值都不能作为该探头的测量结果。湿土对比只接触探头刻线以下的感应部分，接口和上方元件保持干燥。

这台设备原来保留的 RP2040 程序会通过 USB 串口 115200 输出 `grove adc: <GPIO26>,<GPIO27>`，须开启 DTR。`tools/indicator_grove_probe.py` 适用于该原程序。2026-10-26 经用户授权，完整备份并回读校验 2 MiB RP2040 闪存后，已刷入 [USB 诊断固件](../firmware/indicator-rp2040-diagnostics/README.md)。USB 单项诊断可用 `tools/indicator_diagnostic_cli.py` 输出 12 位 ADC JSON，不能直接与原程序比例混用。两板联调时 RP2040 的 `main.py` 运行 `soil_uart.serve()`；USB REPL 中断会暂停采样，软重启可恢复。

**实测结果：土壤探头接左侧后具有干湿响应。**湿纸巾稳定段 20 次 GPIO27 读数为 1557–1655，中位数 1583；用户取下纸巾并擦干后，读数恢复至约 2460。首组干燥数据异常偏低、原因未确定，不用于标定。这里仅确认响应，不提供土壤含水率百分比，也不声称已完成长期稳定性验证。串口读数与 RoboPlanter 屏幕／YOYO 接入仍是不同验收项目。

灯带在 Indicator 右侧 GPIO21 上完成两轮低亮度单灯 RGB 指令，用户报告**完全没有亮**，因此尚未通过点亮验收。照片中 5V 灯带不能直接按 Indicator Grove 的 3.3V 电源设计正式供电；需核实型号、灯数、电源容量及数据电平。若由 Indicator 控制，需独立合适电源、共地和必要的电平转换，不能把外部 5V 回接到 Grove 的 3V3 电源脚。后续使用 Robot Board 的 RGB 口复测时，应注意其 VSYS_5V 来自载板供电；只给 XIAO 小板自身 USB 供电，不能据此认定载板 RGB 口已有 5V，原理图页 5 的隔离路径需一并核对。

同日 [XIAO 临时诊断程序](../firmware/xiao-led-diagnostics/README.md) 首轮在载板 RGB / D13 / GPIO40 上执行六阶段单灯测试，用户确认完全没亮。随后 v0.2.0 改用附件 WS2813 专用时序、亮度 24/255，并逐颗扫描前十颗：30 个阶段和关灯帧均由 RMT 完成，**用户确认能看到红、绿、蓝逐颗移动，灯带基础控制通过**。由于时序、亮度、灯珠选择同时变化，未单独定位首轮失败原因。随后主 RoboPlanter 增加了显式启用的 `ROBO_WS2813_RMT` 后端，默认仍保留旧驱动。本轮 BLE 设置追逐、HTTP 读取状态、HTTP 关闭及 BLE 查询均已通过；本轮用户已现场确认新版固件的灯带开关正常。

用户确认上述测试使用载板 USB、开关 ON、RGB 接口，其它执行器已断开，没有万用表，实际电压未经测量。照片中 DI/BI、DO/BO 标记对应主／备用数据线，并非数据／时钟；J7 第二脚在所附原理图为 NC。此次保持原 Grove 接法已成功点亮，没有要求额外改接 BI；其电位与具体芯片修订版仍未测定。XIAO 原有 16 MiB 桥接固件在测试前完整备份并校验，每轮临时测试后恢复原备份。

依据：[官方接口图及 ADC 说明](https://wiki.seeedstudio.com/SenseCAP_Indicator_RP2040_Grove_ADC/)、[电容式探头规格](https://wiki.seeedstudio.com/Grove-Capacitive_Moisture_Sensor-Corrosion-Resistant/)、[Seeed 灯带供电规格列表](https://wiki.seeedstudio.com/led_driver_board/)。

新增模块核对依据示例：[SHT31 的 I²C 接口及供电](https://wiki.seeedstudio.com/Grove-TempAndHumi_Sensor-SHT31/)、[DHT20 的 I²C 接口](https://wiki.seeedstudio.com/Grove-Temperature-Humidity-Sensor-DH20/)、[Air Quality v1.3 的定性测量限制](https://wiki.seeedstudio.com/Grove-Air_Quality_Sensor_v1.3/)。这些参考不表示用户手上的模块已被识别。主固件的空气 ADC 和 UART 文本发送功能，也不等于已经验证气体浓度或打印机实际出纸。

新增器材优先级：匹配实际水箱的水位传感器、必要的 Grove 转接线、合适的外置泵驱动及供电。I²C Hub 只在同一总线的插座不足且地址、电平及负载允许时使用；它不能增加模拟输入通道。若扩展植物光照判断，应另选适合该用途的光照传感器，不用 UV 原始值代替照度或 PAR。

官方依据：[Indicator Grove ADC](https://wiki.seeedstudio.com/SenseCAP_Indicator_RP2040_Grove_ADC/)、[Indicator Grove I²C](https://wiki.seeedstudio.com/SenseCAP_Indicator_RP2040_Grove_IIC/)、[Indicator 双 MCU 与内部通信](https://wiki.seeedstudio.com/SenseCAP_Indicator_Dive_into_the_Hardware/)、[Grove Water Level Sensor](https://wiki.seeedstudio.com/Grove-Water-Level-Sensor/)。Robot Board 依据用户附件 V1.0 原理图第5–6页和套件照片，不用其他通用 XIAO Grove 扩展板的规格替代。

### Sense 摄像头扩展板与 Plus 的兼容性

2026-10-26 用户确认把标准 XIAO ESP32-S3 Sense 摄像头扩展板扣到了原来的 ESP32-S3 Plus 上。此次只做 USB 设备识别和资料核对，没有初始化摄像头或刷写相机固件；摄像头未通过识别、拍照验收。Seeed 官方明确指出：**Plus 的 B2B 连接器兼容 Wio-SX1262 扩展板，不兼容标准插接式摄像头传感器板**。因此应断电取下，不能以连接器能够扣合为兼容依据。

推荐保留已验证的 Plus + Robot Board 作为外设控制端，标准 XIAO ESP32-S3 / Sense 主板配 Sense 摄像头扩展板作为单独的相机节点。标准 Sense 摄像头使用 GPIO40 作为 SCCB SDA，而现有 Robot Board 的 RGB / D13 灯带也用 GPIO40；摄像头和灯带不能按这两套默认引脚在同一 MCU 上同时驱动。将 Sense 主板直接替换进 Plus Robot Board，也须重新核对板上所有扩展连接，不能当作已经验证的替换方式。Plus 如需使用相机，应另行设计／确认兼容适配与完整引脚分配。

依据：[Seeed 官方引脚复用与 Plus 兼容性说明](https://wiki.seeedstudio.com/xiao_esp32s3_pin_multiplexing/)、[S3 系列与 Sense 摄像头引脚表](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)。

## 2026-10-26 本地联调记录

本轮 XIAO 和 Indicator 使用同一实际 2.4GHz 路由器，经 HTTP 通信；未使用 ESP-NOW。土壤探头接 Indicator 背面左侧，灯带接 Robot Board RGB / D13。用户确认已取下不兼容的 Sense 摄像头扩展板。泵、加热及打印未启用。

- Indicator 完整 8MiB Flash 已备份并通过设备 MD5 对照；RP2040 原完整备份、现有脚本备份和 XIAO 原 16MiB 备份均保存在私有 `build/device-backups/`。两板刷写均通过 Flash 哈希校验，未擦除 Indicator 保存的界面设置。
- Indicator 启动报告显示、触摸、HTTP 任务和存储正常；内部 UART 取得 GPIO27 真实值，HTTP 上传返回 200。
- 连续 12 次土壤有效读数为 2529–2538，中位数 2533。电脑通过 XIAO BLE 读回 `S:2529:x:1:0`，表示原始值 2529、无百分比、有效但未校准。不是手机 YOYO 的结果。
- 暂停 RP2040 采样约 4.5 秒后，XIAO 正确返回 `soil.valid:false`；恢复采样后重新返回有效原始值 2536。没有用旧值冒充实时读数。
- BLE 鉴权、灯带追逐设置、HTTP 状态同步、HTTP 关灯、BLE 关灯状态以及旧请求不重放已通过。已实际捕获 Indicator 发出的 `screen-…` 开灯请求，XIAO 返回完成；用户现场确认 ADC 显示和灯带开关正常。
- 已通过既有跳板 SSH 恢复本项目专用云配置，以当前电脑运行只读网关；公网 MCP 经 MQTT 查询读到真实 ADC 2516、有效但未校准。没有改 Broker 权限，没有开放云端写操作；这不是 Indicator 原生 MQTT。用户手机原0.2.0查询实际回复“联调中／未接入”；后续私有0.2.2单次读取联调见[荣耀平台记录](deployment/honor-platform-status.md)，不能将电脑 BLE 测试当作手机已通过。
- 私有0.2.2单次读取测试中，用户现场反馈 Robot Phone“读出来2529了”，完成 Indicator → XIAO → YOYO 手机端的真实读数验收。临时会话随后主动撤销；该值是未校准 ADC，不是湿度百分比。手机灯带、水泵、打印和长期连续读数仍未在本次验收范围内。

日志和逐项结果保存在私有 `tmp/three-device-test/`。这些短时联调结果不代表长时间稳定性、土壤标定或其他未识别模块已经通过。

## XIAO 与 Indicator 的连接

首版不接两块板的 UART 或 I²C。XIAO 建立 2.4 GHz Wi-Fi 热点，Indicator 作为客户端连接，查询 `http://192.168.4.1/api/v1/state` 并发送操作请求。两端使用相同的设备令牌。

代码中热点名为该板的 `RoboPlanter-XXXX`，Indicator 默认每 1000ms 查询一次，并在 HTTP 请求头中附带 `X-Device-Token`。Wi-Fi 名称、热点密码、花盆地址和令牌均须与实际 XIAO 匹配；仅 Wi-Fi 图标亮起不代表花盆鉴权通过。

```text
Indicator ── Wi-Fi / HTTP ──→ XIAO ──→ 传感器、灯带、外置泵驱动、打印机
                                 ↑
Robot Phone 上的 YOYO ── BLE ────┘  （目标链路，手机鉴权/回包仍待验收）
             ↑
NFC 贴 ── 手机入口/任务转发 ──────┘  （碰贴入口探索中）
```

手机不必连接花盆的无互联网热点；目标是由手机通过 BLE 控制 XIAO，并继续使用自己的互联网访问 YOYO。Indicator 通过 XIAO 的 HTTP 状态读取同一控制器的结果。NFC 不插在两块开发板上，不传送传感器数据，也不能替代 BLE 配对或业务鉴权。具体手机入口实验见 [荣耀平台教程](handbook/honor-platform.md#61-robot-phone-的-nfc-入口探索)。

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
