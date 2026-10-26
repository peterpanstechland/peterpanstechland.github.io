# UART 小票打印机接入

使用 SERVO4/D8 作为发送引脚，连接串口打印机并避免冷启动日志出纸。当前支持英文文本和走纸，中文、切刀和状态反馈仍在开发。

## 为什么一上电就打印日志

`ESP-ROM:esp32s3-20210327` 是主控启动信息，打印机把收到的串口字节当成正文输出了。ESP32-S3 的 UART0 默认 TX 是 GPIO43、RX 是 GPIO44，ROM 日志早于应用运行。因此仅关掉程序中的 `Serial.print` 无法解决冷启动出纸。参考 [Espressif UART 硬件说明](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html)。

`No core dump partition found` 表示固件启用了 Flash 崩溃转储支持，但分区表没有对应分区；这条信息本身不证明发生崩溃。

## D8 发送、原 UART 接收

断电后逐根核对，不能直接把原四芯线不加修改地插回去：

| 打印机端 | Robot Board 端 |
| --- | --- |
| RX | SERVO4 / J14 pin1 / D8 / GPIO7，由固件映射为 TX |
| TX | 确认 3.3V 逻辑或加电平转换后，接 UART / J10 pin2 / D7 / GPIO44；未确认前先断开 |
| GND | J10 pin4 / GND，同时连接打印机电源负极 |
| 电源正极 | 按实物铭牌独立供电，不接 J10 pin3 / 3.3V |
| 无 | J10 pin1 / D6 / GPIO43 留空，不接打印机 |

SERVO4 必须没有水泵或舵机；J14 pin3 是 Motor5V，不接打印机电源。项目原先把 D8 预留给水泵，新方案将其分配给打印 TX，编译检查禁止同时启用水泵与打印机。启动时 D8 保持 UART 空闲高电平，不能沿用旧水泵初始化将其拉低。供电电压与串口逻辑电平是两回事，必须确认打印机 RX 能识别主控的 3.3V 信号。

GPIO44 保留硬件接收能力；当前代码尚未实现该型号的状态查询与解码，接线完成不代表已经能判断缺纸。GPIO44 仅作接收，不作打印发送。两个 I²C 插座和板载 IMU 均保持原连接。

厂家[中文 EM5826H 产品页](https://www.donnwei.com/?page_id=24893&post_type=products)也明确写明“58mm热敏带切刀”。产品资料列出 ESC/POS、384 点宽度及默认 9600 波特；已测试设备使用115200波特；接入时以打印机自检页的设置为准。当前驱动提供初始化、英文打印与走纸。

## 固件配置与保留现有功能

保留当前 Wi-Fi、设备令牌、灯带参数和 Indicator 土壤中继配置；刷写前备份设备 Flash。本地 `config.local.h` 与备份均不提交到 Git。

接线确认后，在本地配置中设置：

```cpp
#define ROBO_ENABLE_ACTIONS 1
#define ROBO_ENABLE_PRINTER 1
#define ROBO_PRINTER_HARDWARE_CONFIRMED 1
#define ROBO_PRINTER_D8_WIRING_CONFIRMED 1
#define ROBO_PRINTER_BAUD 115200 // 按打印机自检页设置调整
```

仍需有效的非默认设备令牌，不能使用编译测试中的占位令牌。水泵保持原来的禁用状态。

## 完整打印流程

1. 冷启动，观察打印机不再输出 ESP32 日志；检查 XIAO 回到原网络，灯带与土壤链路仍可用。
2. 通过已鉴权的 `/api/v1/state` 确认 `printer.enabled:true`、初始状态 `idle`。
3. 首次仅提交一条短 ASCII 小票，保存这次请求 ID；不要因等待时间长再提交新的 ID。
4. 查询 `/api/v1/result?request_id=...`，等待 `accepted` 变为 `completed`；随后人工检查纸面、方向、换行和走纸距离。
5. Indicator 进入今日状态 → 硬件操作 → 打印 → 小票预览 → 确认。屏幕已有该路径，XIAO 启用打印后应显示可用；只确认一次，检查只出一张。
6. 相同启动周期内查询或重复同一 ID 不应重印。设备重启后缓存会丢失，不能跨重启自动重发结果不明的请求。

每张小票先由固件发送固定 ESC/POS 初始化、正常字号、左对齐和默认行距，再发送正文及末尾走纸。正文最多 160 字节，仅 ASCII 和换行；中文、用户传入的 ESC 控制码会被拒绝。当前未实现位图、中文、自动切刀、缺纸或机械完成反馈。

`completed` / `bytes_sent` 仅证明 UART 完成发送，不能代替实际出纸确认。串口失败会终止任务且不会自动重印。当前 D8 分配不允许同时启用打印和水泵；今后另行分配泵引脚后仍须保留动作互斥。云端打印与 YOYO 手机打印仍需单独接入。

## 打印后检查

确认文字清晰、换行正确、只打印一张；断电重启后不应输出主控日志。Indicator 发起打印前需先连接到正确的 XIAO，并在状态页确认打印功能已启用。按钮不可用时，先按 [排障手册](troubleshooting.md) 检查网络与设备状态。
