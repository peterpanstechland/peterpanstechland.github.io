---
title: "UART 小票打印机"
description: "D8 接线、中英文点阵、可选切纸、屏幕配对与冷启动检查。"
sidebar_position: 10
hide_title: true
---

# UART 小票打印机接入

使用 SERVO4/D8 作为发送引脚，连接串口打印机并避免冷启动日志出纸。固件支持中文/英文点阵小票、走纸及显式启用的自动切纸。缺纸、过热与机械完成反馈尚未实现。

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

SERVO4 必须没有水泵或舵机；J14 pin3 是 Motor5V，不接打印机电源。项目原先把 D8 预留给水泵，新方案将其分配给打印 TX，泵已另配SERVO1/GPIO42，编译检查禁止两者同脚；运行时仍不能同时泵水和打印。启动时 D8 保持 UART 空闲高电平，不能沿用旧水泵初始化将其拉低。供电电压与串口逻辑电平是两回事，必须确认打印机 RX 能识别主控的 3.3V 信号。

GPIO44 保留硬件接收能力；当前代码尚未实现该型号的状态查询与解码，接线完成不代表已经能判断缺纸。GPIO44 仅作接收，不作打印发送。两个 I²C 插座和板载 IMU 均保持原连接。

厂家[中文 EM5826H 产品页](https://www.donnwei.com/?page_id=24893&post_type=products)也明确写明“58mm热敏带切刀”。产品资料列出 ESC/POS、384 点宽度及默认 9600 波特；此前英文出纸测试使用 115200 波特；接入时以打印机自检页的设置为准。

中文和切纸实现依据提供的 [escpos-sample 示例](https://github.com/peterpanstechland/escpos-sample/tree/60f85d4e8cbcce8956528c7a2d1d0344aa2adf55)：有效宽度 **384 点**，使用 `GS v 0` 光栅指令。正文不是 GBK 字节，而是由固件字库渲染的黑白点阵。结束时发送 `ESC d 6`（`1B 64 06`），开启切刀后紧接 `GS V 0`（`1D 56 00`）；不要替换成示例说明不适用的 65/66 变体。示例的 USB 传输已改为本项目 UART；串口出纸与切刀效果仍需逐台验收。

## 固件配置与保留现有功能

保留当前 Wi-Fi、设备令牌、灯带参数和 Indicator 土壤中继配置；刷写前备份设备 Flash。本地 `config.local.h` 与备份均不提交到 Git。

接线确认后，在本地配置中设置：

```cpp
#define ROBO_ENABLE_ACTIONS 1
#define ROBO_ENABLE_PRINTER 1
#define ROBO_PRINTER_HARDWARE_CONFIRMED 1
#define ROBO_PRINTER_D8_WIRING_CONFIRMED 1
#define ROBO_PRINTER_BAUD 115200 // 按打印机自检页设置调整
#define ROBO_PRINTER_CUTTER_CONFIRMED 1 // 仅适用于已确认带刀且兼容上述指令的打印机
```

仍需有效的非默认设备令牌，不能使用编译测试中的占位令牌。水泵保持原来的禁用状态。公开默认配置关闭打印与切刀；无刀机保留 `ROBO_PRINTER_CUTTER_CONFIRMED 0`。

## 连接 Indicator

两板使用 Wi-Fi/HTTP，Indicator 不接打印机串口。只连接同一 Wi-Fi 并不足够，还需匹配花盆地址和设备令牌。电脑能访问 XIAO 后，可以从已有的私有配置生成屏幕配置：

```powershell
python tools/pair_indicator.py --url http://<XIAO当前IP> --device-id <实际device_id>
```

工具读取 `firmware/xiao/include/config.local.h`，仅执行一次鉴权状态查询，核对设备后写入 Git 忽略的 `firmware/indicator/include/local_config.h`，不发送打印或其他动作，不输出凭据。已有文件需显式加 `--replace`；它只更新四个配对字段并保留其他配置。生成后重新构建、刷写 Indicator。默认不启用本地土壤中继，只有安装 RP2040 土壤应答固件后才启用该选项。

屏幕“设置 → 花盆连接”显示地址、网络及 HTTP 诊断，不显示令牌。它可恢复使用已配对网络；任意新 Wi-Fi 不会自动改变花盆地址或令牌。按钮禁用会区分未连接、网络不匹配、认证失败、状态过期、外设未启用及打印恢复锁定。

## 完整打印流程

1. 冷启动，观察打印机不再输出 ESP32 日志；检查 XIAO 回到原网络，灯带与土壤链路仍可用。
2. 通过已鉴权的 `/api/v1/state` 确认 `printer.enabled:true`、初始状态 `idle`、`text_format:"utf8-raster"`、`paper_width_dots:384`，以及符合本机配置的 `autocut`。
3. 提交一张短中文/英文小票，例如“工位盆栽\n照料植物，也记得休息。”，保存这次请求 ID；不要因等待时间长再提交新的 ID。
4. 查询 `/api/v1/result?request_id=...`，等待 `accepted` 变为 `completed`；随后人工检查纸面、方向、换行和走纸距离。
5. Indicator 进入今日状态 → 硬件操作 → 打印 → 小票预览 → 确认。中文界面在设备声明光栅能力时使用中文，英文界面或旧固件使用英文。预览正文会冻结到这次提交；只确认一次，检查只出一张，带刀配置下检查纸张是否实际切断。
6. 相同启动周期内查询或重复同一 ID 不应重印。设备重启后缓存会丢失，不能跨重启自动重发结果不明的请求。

## 字库与传输限制

正文为严格 UTF-8，最多 **160 字节**，不等于 160 个汉字。字库包含 7,540 个 ASCII/GB2312 映射字符，使用 Noto Sans SC 的 32 像素点阵和 44 像素行高；最多自动换行到 8 行。首行居中，标题与正文间有额外留白和分隔线；左右各留 16 点，中文一行最多约 11 字。支持换行，不支持用户传入的 ESC、其他控制码、emoji 或字库外字符。不合法正文会在发送任何打印字节前拒绝。

新布局通过 `printer.layout:"receipt32-v2"` 声明。Indicator 对该布局直接使用打印机同一套字库、换行和点阵渲染，整页按等比例缩小到预览区；它不代表纸张的实际毫米尺寸。预览后若设备降级到不支持该布局的版本，需重新打开预览后确认，不能沿用旧预览直接发送。

固件每条光栅命令固定发送 **128 行**，末尾不足 128 行补白；每块仍分四次使用 32 行临时缓冲生成，单个缓冲区 1,536 字节，无整页大缓冲。EM5826H 实机对照发现 32 行命令会导致纵向压缩，128 行正常，因此不能把渲染缓冲大小直接用作打印分块高度。超时预算按实际光栅字节数和波特率计算，另留 5 秒余量，覆盖 9600 波特的长小票。字库随源码提交，正常编译不需要下载原始字体；再生成使用 `tools/build_printer_font.py`，字体版权与 OFL 见 [字体说明](/roboplanter/source/firmware/indicator/assets/fonts/README.md.txt)。

离线检查可将 `tests/core/printer_preview.cpp` 编译成主机程序，运行 `printer_preview.exe note.txt receipt.bin cut`，再运行 `python tools/render_printer_preview.py receipt.bin preview.png`。这会调用与设备相同的编码器，不访问打印机。PNG 只预览纸面点阵，不模拟切刀效果。

`completed` / `bytes_sent` 仅证明 UART 完成发送，不能代替实际出纸或切刀确认；`feedback:"unavailable"` 明确表示没有机械反馈。发送中断后本次请求为 `printer_write_failed`，状态锁定为 `recovery_required`，后续新打印拒绝为 `printer_recovery_required`。这避免下一张被未收完的光栅包吞掉；检查纸张和线路后，应重启打印机与主控清除残留，不能只重发请求。重启前结果不明的原任务不可自动重放。

当前D8只接打印机，继电器已另配GPIO42且负载空着；两种动作运行时互斥。本地 MCP 可提交同样的受限 UTF-8 正文；云端写操作仍禁用，YOYO 0.4.0场景打印已实现但手机端仍待验收，本次固件变更不会自动开放它们。

## 工位日签

新固件声明 `printer.daily_layout:"garden-daily-v2"` 后，Indicator 的打印预览会切换为 Logo、植物快照、三行待办、78 张牌随机正逆位塔罗的完整日签。左右滑动查看全部内容，确认只提交一次；详见 [工位日签](/docs/projects/2026/roboplanter/daily-ticket)。旧固件保留短文字便签。

## 打印后检查

确认文字清晰、换行正确、只打印一张；断电重启后不应输出主控日志。Indicator 发起打印前需先连接到正确的 XIAO，并在状态页确认打印功能已启用。按钮不可用时，先按 [排障手册](/docs/projects/2026/roboplanter/troubleshooting) 检查网络与设备状态。
