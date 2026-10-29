---
title: "排障与恢复"
description: "从电源、串口、构建、显示、HTTP 到 BLE 的故障诊断。"
sidebar_position: 19
hide_title: true
---

# RoboPlanter 排障：从供电到手机回包

配合 [硬件教程](/docs/projects/2026/roboplanter/hardware-quickstart) 与 [BLE 教程](/docs/projects/2026/roboplanter/ble-integration) 使用。例子中的端口和 ID 必须替换为当前真实值；不凭旧 COM 号选择设备。

## 先止损，再定位

如果水泵不停、驱动异常发热、板子冒烟/异味或电源反复重启：立即切断**负载支路的物理电源**，不要等待 YOYO 回答、HTTP 重试或串口连接。排查时断开泵、打印机、原车电机/舵机/加热器，仅保留一块控制板的已知安全 USB 供电。

如果仅是请求超时：记录原 `request_id`，将结果记为未知。可以查询原 ID 和状态，**不要换 ID 再发浇水/打印**。如有负载正在运行，使用现场停止控件/物理断电确认状态。

按下面顺序缩小范围：

1. 电脑能否识别正确目标的串口？
2. 固件能否在正确环境编译、上传校验并正常启动？
3. XIAO 自己的 HTTP 只读状态是否可信？
4. 单个传感器/执行器在本地是否通过？
5. 普通 BLE 客户端是否收到完整业务回包？
6. 荣耀手机的官方工具是否得到相同结果？
7. 最后才查 Skill 的自然语言映射和平台分发。

不要一次改接线、库版本、网络和 Skill，再凭一次成功猜测原因。

## 编译失败或工具命令找不到

### `python` / `py` / `platformio` 找不到

使用硬件教程创建的本地 Python，避免依赖全局 `pio` 路径：

```powershell
$rpPython = Join-Path (Get-Location) '.tools\handbook-venv\Scripts\python.exe'
& $rpPython --version
& $rpPython -m platformio --version
& $rpPython -m pip show platformio esptool
```

```bash
rp_python="$PWD/.tools/handbook-venv/bin/python"
"$rp_python" --version
"$rp_python" -m platformio --version
"$rp_python" -m pip show platformio esptool
```

确认当前目录是项目根目录。缺失环境时重做安装步骤，不把终端里存在另一个版本当成这个虚拟环境已安装。命令中的 `--project-dir firmware/xiao` 和 `firmware/indicator` 不能混用。

### 下载慢、TLS 或代理错误

首次 PlatformIO 构建会下载工具链和库，需要可访问官方仓库的网络。记录错误域名、包名、版本和最后一段日志；检查电脑日期、代理和网络。不要通过关闭 TLS 校验或从未知网盘替换工具链解决。XIAO 热点无互联网，下载依赖时先用有互联网的网络，硬件只读测试时再切到设备热点。

### 直接换成最新 Arduino/GFX 后不编译

回到仓库固定依赖，不随机升级。XIAO 与 Indicator 当前固定 Espressif32 6.12.0 / Arduino ESP32 2.0.17；Indicator 固定 Arduino_GFX 1.4.7。当前 Seeed 通用教程的新版核心/库组合不等于此仓库已经迁移成功。不要用 Arduino IDE 把附件旧车例程当作此工程重新编译。

### `Confirm ... first` / `Token must contain ...` 等编译断言

这是配置门禁，不是编译器坏了。读取 `firmware/xiao/include/robo_config.h` 对应的 `static_assert`：

- 令牌 16–64 字符；热点密码 8–63 字符。
- 泵上限 1–30000 ms，LED 数量 1–120，亮度 0–255。
- 启用泵、打印或辅助 ADC 前分别完成硬件确认标志。

只有完成实际硬件检查才改确认标志。想继续软件调试时把未确认外设保持 `0`，不要删断言。

## 电脑看不到串口 / 不能进入下载模式

先换已知可传数据的 USB 线、USB 口，绕开不可靠 Hub；一次只接一块板。检查两种操作前后的端口清单：

```powershell
& $rpPython -m platformio device list
```

```bash
"$rp_python" -m platformio device list
ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
id -nG
```

Indicator 使用 CH340 对应的 ESP32-S3 端口；RP2040 也可能呈现串口，不能误刷。若 Windows 缺 CH340 驱动，从芯片厂商/Seeed 官方来源安装，不从随机下载站安装。Linux 如权限不足，按发行版及管理员要求授予串口组权限并重新登录；不要 `chmod 777` 整类设备，也不要一直以管理员权限运行整个开发环境。

XIAO 如果现有程序没有 USB CDC 或陷入重启，普通串口名可能暂时不存在。可按 Seeed 的 XIAO ESP32-S3 官方下载模式说明，先断开负载，按住 BOOT 接入 USB，必要时在按住 BOOT 时按一下 RESET，然后释放；重新列出下载器端口。**不要把载板的业务按键当作已核实的 BOOT 键**，以你的 XIAO 丝印/官方图为准。复位后端口可能变化，再次识别后才上传。

出现 `Access denied` / `Port busy` 时，退出串口监视器、Arduino Serial Monitor、另一个烧录器。不要同时开两个软件占用同一端口。

## 上传到一半失败 / 哈希不一致 / 备份失败

1. 先保持负载断开，检查 USB 线、电源与端口选择。
2. 关闭其他串口程序；重新进入下载模式并重新识别端口。
3. 备份/校验的 esptool 波特率可从 460800 降到 115200，再读一个新文件；失败或长度不对的文件不当成备份。
4. 不用 `--force` 绕过芯片类型、Secure Boot 或 Flash Encryption 拒绝；先确认实际硬件与原配置。
5. 上传没有成功校验就不进入执行器测试。校验成功但启动异常，继续下一节定位 Flash/PSRAM 或配置问题。

不要在失败后随手执行整片 `erase_flash`。它会删除配置与原有程序，也不能修复错引脚、错电源或错误容量。

## 上传成功但重启循环 / 黑屏 / 触摸异常

### 所有板都适用

通过 115200 串口观察从复位开始的完整日志。记录 panic、brownout、找不到 PSRAM 等第一处异常，不只截图最后一行。确认目标是 ESP32-S3，XIAO Plus 是 16 MB、Indicator 是 8 MB，所选工程支持实际 PSRAM。先空载启动；若接泵或打印就重启，优先查供电峰值、地线、线径、续流保护和压降。

### Indicator

- 当前驱动面向原款 480×480 ST7701，触摸地址固定 `0x48`。另一屏幕批次可能不同，不能通过随机换地址“碰运气”；先确认硬件批次及官方 BSP。
- 串口 `display=ready` 只表示初始化函数成功；仍需检查颜色、方向、文字、闪烁和触摸命中。
- `touch=ready` 也不能证明所有坐标都准确。检查四角/中心、抬手触发、滑动不误发动作，先禁用所有执行器。
- 屏幕两帧缓冲依赖 PSRAM。不要把工程改成无 PSRAM 或 OPI 不匹配的配置。
- 当前生产环境是 `sensecap_indicator`。`sensecap_indicator_lcdtest` 是明确的诊断构建，不作为默认比赛固件。
- 更换固件后检查动画、联网和触摸是否正常，持续闪烁时保存启动日志。

详细板级依据见 [Indicator README](/roboplanter/source/firmware/indicator/README.md.txt)；该文档保留历史设置版本的摘要与适用边界。

## 找不到 XIAO 热点 / 连上但没有互联网

XIAO 是 2.4 GHz SoftAP，名称来自芯片信息，形如 `RoboPlanter-...`。先检查 XIAO 串口是否已到 `ready`，是否存在 `Wi-Fi AP unavailable`。不能仅靠旧截图的名字找设备。

热点没有互联网是预期；让电脑保持该 Wi-Fi，不接受自动切回其他网络。默认密码 `planter-demo` 只适用于未修改的本地配置。改过密码后从系统忘记旧网络再输入新密码。当前最多两个 Wi-Fi 客户端，先只保留电脑和 Indicator，减少额外手机占用。

检查电脑是否获得 `192.168.4.*` 地址。若不是，确认连的是正确热点；检查 VPN、多网卡路由、系统代理。不要把 `http://192.168.4.1` 输成 HTTPS，这个固件没有 TLS。

## HTTP 返回 401 / 字段不符 / 409

只读先测试：

```powershell
& $rpPython tools/device_cli.py state
```

```bash
"$rp_python" tools/device_cli.py state
```

- **401 unauthorized**：CLI 环境变量、XIAO `ROBO_DEVICE_TOKEN`、Indicator `PLANTER_DEVICE_TOKEN` 不一致，或改配置后只刷了一块板。令牌区分大小写，别带换行、空格或 `|`。不要为通过测试删除鉴权。
- **404 not_found**：URL 路径/目标服务错误，确认 `/api/v1/state`；结果查询的 404 要看是否是 `request_not_found`，不能混为设备不在线。
- **415 content_type_required**：动作接口需 `Content-Type: application/json`；使用项目 CLI 可避免手写出错。
- **400/413**：检查 JSON 字段、类型、ID，命令体上限 512 字节。`duration_ms` 必须整数，`on` 必须 JSON 布尔值。
- **409 actions_disabled**：动作总开关或非默认有效令牌条件没满足。只读成功不代表允许动作。
- **409 pump_disabled/light_disabled/printer_disabled**：对应外设仍关闭，这是默认行为。
- **409 invalid_duration**：超过 XIAO 本地上限，常见于把 XIAO 设 1000 ms，而 Indicator 仍发送默认 2000 ms。同步降低 `PLANTER_WATER_DURATION_MS`，不要直接抬高泵上限绕过台架验证。
- **409 pump_busy/printer_busy**：等当前任务结束。该拒绝 ID 已被保存，不要反复原 ID 期待它变成功；只有用户确认新的动作意图才使用新 ID。
- **409 request_id_conflict**：同一 ID 已用于其他参数；查原 ID，不能以换 ID 自动重试。
- **409 idempotency_cache_full**：64 条本次启动缓存已满。先停泵并确认安全，再有计划重启；重启丢失缓存，不自动重放之前未知动作。

## 屏幕 Wi-Fi 已连接，但仍显示离线或等候花盆

Wi-Fi 关联与 HTTP 业务是两层。依次检查：

1. 电脑同网运行 CLI 能否读取 XIAO？不能则先修复 XIAO/网络。
2. 屏幕编译配置 `PLANTER_WIFI_SSID` 是否与实际热点**完全一致**？当前代码只有在连接这个 SSID 时才发花盆请求。设置页选了别的 Wi-Fi，只能说明普通 Wi-Fi 连接成功。
3. `PLANTER_BASE_URL` 是否为目标 XIAO 地址？屏幕没有运行时编辑此值的入口。
4. 两板令牌是否相同并且都重新上传？设置页修改热点密码不会改设备令牌。
5. 若保存的 Wi-Fi 覆盖了新的编译默认值，用设置页“恢复默认连接”返回当前编译配置。该操作只重置保存的 Wi-Fi，不恢复原厂程序。

状态过期时按钮禁用是预期：XIAO 超过 3 秒的采样失效；Indicator 会结合传来的采样年龄与本地时间，将超过约 5 秒的数据视为过期。正确处理是恢复真实数据，不能删除新鲜度检查。

## 土壤一直 `null` / `0` / `4095` / 百分比反了

- `null` 且 `valid:false`：当前先检查Indicator RP2040的GPIO27、内部UART、PLANTER_ENABLE_LOCAL_SOIL、XIAO的ROBO_ENABLE_REMOTE_SOIL和HTTP上传；缺值不等于“极干”。
- 原始值有变化但 `percent:null`：尚未保存合法的干/湿参考点，这是预期。在“设置 → 花盆连接 → 传感器校准”采集两点（0–4095，差至少64）并保存。详见[校准教程](/docs/projects/2026/roboplanter/sensor-calibration)。
- 长期为 0 或 4095：检查信号脚、共地、电源、输出范围、短路/饱和、探头是否断开。ADC 返回合法数不证明电气正常。
- 值漂移：先固定插入深度、基质与电源，检查探头型号及负载。不要直接把噪声解释为浇水需求。
- 百分比方向不符：按实际干参考填 `ROBO_SOIL_DRY_RAW`，湿参考填 `ROBO_SOIL_WET_RAW`；值大小不预设。不要把“dry 应该更大”写成所有传感器的规律。

模拟输入不得超过3.3V。当前土壤在Indicator GPIO27，环境光在Robot SERVO3 GPIO1，超声波在SERVO2 GPIO8。不要按旧图把土壤/Air/UV接回已被占用的接口。

## SEN54 无效 / 温湿度不合理

先确认独立5V VCC、共地、3.3V信号上拉，SDA=GPIO5/SCL=GPIO6，地址0x69。IIC口直接给3.3V不能满足SEN54供电。保持DHT20/SHT31/AIR关闭，检查CRC与预热状态；无效不能强行显示上次值。D1不自带CO₂/VOC传感器，当前环境读数来自XIAO上的SEN54。

## 超声波无回波 / 浇水不可用

核对SERVO2 GPIO8单SIG和独立3.3V；保持探头干燥并对准平面，避开过近目标和箱壁。未建水箱、未标定或泵未启用时，按钮不可用是当前正确状态，不删除保护条件。

## 灯带没亮 / 颜色异常

先看 `light.enabled`；如果 false，检查总开关、非默认令牌和灯外设开关。若 `on:true` 但实物没亮，断电后核对 DIN/DOUT、GND、额定供电、灯数、协议和驱动缓冲；软件状态表示命令，不是光学反馈。

当前配置 GRB/800 kHz，提供 `solid`、`breath`、`chase`、`rainbow`，不适用于所有 RGB 模块。先用 `solid` 检查颜色和灯数；仅一颗灯时 `chase` 会转为呼吸。动态模式不生效时核对固件版本及 HTTP `light.effect`，旧固件不支持新参数；关灯不能带 `effect`。过大灯带造成电压降/复位时停止测试，重新做电流预算；别单纯提高亮度。

## 打印机 `completed` 但没出纸 / 乱码

`completed` 或 `bytes_sent` 只代表 UART 发完。核对独立电源及峰值电流、上纸/盖板、实际波特率、8N1、TX→RX 和共地。TTL RX 是否识别 3.3 V、打印机 TX 是否会超过 ESP32 允许输入，必须按实际型号确认。

可先发一条短小票。乱码时先排查波特率和协议，不连续重印；新版支持中英文点阵与显式启用的切刀，USB-only 驱动和机械反馈尚未实现。`printer_write_failed` 表示发送中断，随后 `recovery_required` 会锁住打印。先保留原 ID 查结果、检查纸面及连接，再重启打印机和主控清除残留；不能自动重放未知任务。屏幕按钮不可用时进入“设置 → 花盆连接”查看网络、地址和鉴权原因，按 [打印教程](/docs/projects/2026/roboplanter/uart-printer) 配对。

## BLE 找不到设备 / 连得上但收不到业务回包

1. 检查真实广播名和本仓库 UUID。旧车和官方麦轮车示例即使同类设备，也不能套用它们的名称/命令/默认 UUID。
2. 关闭其他 BLE 调试应用连接；本固件仅允许一个命令连接。
3. 使用 `ack_type=ack`，不能沿用旧车的 `no_ack`。
4. 写入前订阅 Notify；`expect_response=true`。没有 Read 特征，不要尝试读取“上次回包”。
5. 当前v2使用V协议，不在请求中携带HTTP令牌；长中文仍需核对MTU/ATT长写。不要把一条命令拆成普通 Write，也不要把 MTU 偏好 247 当成已协商成功。
6. 断开重连后重新订阅，按“一次完整请求 → 一次完整回包”串行测试。

普通 BLE 客户端成功但荣耀失败，记录两者的实际请求字节长度、MTU/长写能力和回包，定位在手机工具层；不要把固件鉴权删掉迁就不支持的客户端。

v2业务 `E:PAIR` 查系统绑定与本次加密状态；`E:FORMAT` 查完整帧/长写/字段；`E:SIZE` 查字节数；`E:FIELD` 查查询名；`E:STALE` 查采样任务；`E:id:TIME/LOCK/OFF/BUSY/ID/FULL` 按 [BLE 契约](/docs/projects/2026/roboplanter/ble-integration) 处理。空气回复的 `A:raw:valid` 不等于动作的 `A:id`。

## 手机要配对码，但不知道在哪里看

六位码在 **Indicator → 设置 → 花盆连接 → YOYO与场景小票**，点击“开启两分钟配对”才会显示。不是锁屏密码，不在Skill代码中。新提示版按钮改为“显示六位配对码”，当前实机仍为旧文字。窗口过期要重新开启并输入新码，不重复猜测。

本机曾因用户找不到码而配对应答超时；正确输入后主控认证成功，YOYO读取通过。判断成功同时看系统配对和主控paired/connected状态；不能仅凭手机列表里出现名称。

## YOYO 说无法控制 / 工具成功但没有动作

0.4.0已通过手机实时土壤/温湿度查询。先核对安装的版本、真实广播名、绑定和业务回包；旧0.2/0.3对话或诊断包不具备相同能力。“读取技能文件异常”先查Skill文件/安装入口，蓝牙重试不能代替技能加载。

本机水箱与实际标定确认后已启用泵；遇到缺水或无效距离仍会拒绝浇水。灯/打印/计时需各自测试，不能把一次查询通过算作所有动作通过。A表示受理，D表示软件完成；纸张、刀具和灯光需要观察。打印超时只查原ID，不自动重复出纸。

## 请求丢了、重复了，或者只看见另一条 `last_command`

`state.last_command` 只有最近一条，会被另一入口覆盖。保留原 ID，改用只读结果查询：

```powershell
& $rpPython tools/device_cli.py result '<原 request_id>'
```

```bash
"$rp_python" tools/device_cli.py result '<原 request_id>'
```

BLE 用 `R|token|原ID`，但 ID 仍需满足 BLE 的 8 字符限制。`accepted` 时继续有界查询，不再发 POST；`completed` 时核对实物；404/MISS 时标未知。检查 `uptime_ms` 是否回退以判断可能重启；不是每次断线都能判定是否重启。

屏幕出现未知结果时会阻止普通新动作，并提供人工检查后的确认入口。检查真实负载，再做该确认；它不是自动重发按钮。STOP 在符合连接条件时可用，但无法替代现场断电。

## 恢复原来的 ESP32 固件

仅使用你在首次操作前为**同一块板**保存、完整读取并校验过的备份。此操作会覆盖该 ESP32 的整片 Flash、RoboPlanter 程序和此后保存的设置。Indicator 的 ESP32 备份不恢复 RP2040；不要往 RP2040 口写这个文件。

先断开负载，重新识别端口，关闭监视器，检查文件大小和之前记录的 SHA-256：XIAO Plus 16,777,216 B，Indicator 8,388,608 B。如果没有可靠的备份，不从其他用户设备拷一个所谓原厂镜像，其中可能包含对方的配置/凭据。

Windows：

```powershell
$rpPort = 'COM7' # 重新识别的目标 ESP32 端口
$rpBackup = 'build\device-backups\my-xiao-before-roboplanter.bin'
$rpExpectedHash = Read-Host '输入首次备份记录的 SHA-256'
if ((Get-Item $rpBackup).Length -ne 16777216) { throw '大小不符；Indicator 应改为 8388608 并选它自己的备份' }
if ((Get-FileHash $rpBackup -Algorithm SHA256).Hash -ne $rpExpectedHash) { throw '备份哈希不符，停止' }
# 确认同一块板、正确端口、负载已断开后，才执行以下覆盖操作：
& $rpPython -m esptool --chip esp32s3 --port $rpPort --baud 460800 write_flash --flash_mode keep --flash_freq keep --flash_size keep 0x0 $rpBackup
if ($LASTEXITCODE -ne 0) { throw '恢复失败，不进入硬件测试' }
& $rpPython -m esptool --chip esp32s3 --port $rpPort --baud 460800 verify_flash --flash_mode keep --flash_freq keep --flash_size keep 0x0 $rpBackup
if ($LASTEXITCODE -ne 0) { throw '恢复校验失败' }
```

Linux：

```bash
rp_port=/dev/ttyACM0 # 重新识别的目标 ESP32 端口
rp_backup=build/device-backups/my-xiao-before-roboplanter.bin
read -r -p '输入首次备份记录的 SHA-256: ' rp_expected_hash
test "$(wc -c < "$rp_backup")" -eq 16777216 || { echo '大小不符，停止'; exit 1; }
printf '%s  %s\n' "$rp_expected_hash" "$rp_backup" | sha256sum --check - || exit 1
# Indicator 使用它自己的 8 MB 备份，并把上面的大小改为 8388608。
# 确认同一块板、正确端口、负载已断开后，才执行覆盖操作：
"$rp_python" -m esptool --chip esp32s3 --port "$rp_port" --baud 460800 write_flash --flash_mode keep --flash_freq keep --flash_size keep 0x0 "$rp_backup"
# 只有上一条成功才执行校验：
"$rp_python" -m esptool --chip esp32s3 --port "$rp_port" --baud 460800 verify_flash --flash_mode keep --flash_freq keep --flash_size keep 0x0 "$rp_backup"
```

`0x0` 只适用于上述完整备份，**不适用于单个 `firmware.bin` 应用文件**。恢复校验后再观察实际启动；备份摘要一致不证明该旧程序适合当前接线，旧车固件可能驱动电机/加热，所以负载仍需断开。

## 如何提交一份可复现的问题记录

保存以下最少信息：

- 板型/版本、外设型号、接线草图和电源额定值；照片遮住设备唯一标识。
- 仓库提交、PlatformIO 环境、实际包版本、相关非敏感配置。
- 操作顺序、预期、实际结果；第一条异常日志；相关请求 ID（日志中的令牌全部遮蔽）。
- `accepted/completed/unknown` 等软件结果和真实泵/灯/纸的观察分开记录。
- 手机型号、系统/YOYO 版本、普通 GATT 客户端与官方工具结果是否一致。

不要附完整 Flash 备份、`config.local.h` / `local_config.h`、`.env`、原始账号截图或带令牌的完整 BLE/HTTP 抓包到公开 issue。可以保留字段名和请求字节长度，敏感值替换为 `[redacted]`。未验证的判断写成“怀疑/待测”，不要写成硬件故障定论。

来源：[固件说明](/roboplanter/source/firmware/xiao/README.md.txt)、[设备协议](/roboplanter/source/docs/device-protocol.md.txt)、[接线依据](/docs/projects/2026/roboplanter/hardware-wiring)、[Indicator 板级说明](/roboplanter/source/firmware/indicator/README.md.txt)、[Seeed XIAO 官方指南](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)、[Seeed Indicator 官方指南](https://wiki.seeedstudio.com/SenseCAP_Indicator_ESP32_Arduino/)、[Espressif esptool v4 命令](https://docs.espressif.com/projects/esptool/en/release-v4/esp32s3/esptool/basic-commands.html)、[荣耀 BLE 官方文档](https://developer.honor.com/cn/doc/guides/101781)。
