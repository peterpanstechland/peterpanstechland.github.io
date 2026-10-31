# 从自备硬件开始：接线、备份、烧录与首次联调

适用工程：`firmware/xiao` 和 `firmware/indicator`。命令中的端口、目录和设备名称按本机实际值填写。

建议按 **空载只读 → 单个传感器 → 灯 → 打印 → 最后水泵 → 手机 BLE** 的顺序走完，每一步通过后再增加下一件外设。任何未知型号都先保持禁用。手机接入见 [BLE 教程](ble-integration.md)，异常见 [排障手册](troubleshooting.md)。

先在 [三维接线实验室](https://peterpanstechland.github.io/roboplanter/#wiring-lab) 认接口：切换 XIAO / Indicator，点选外设，查看供电、信号与验证三步。图示可旋转和拆层，布局及模块外形均已简化，不能代替实物丝印或工程图；移动光点也不是实时电流。Indicator 土壤采集使用可选的 RP2040 程序；超声波测距与软件水位保护已实现，本机水箱、进出水和实际标定已获用户确认，泵已启用；短时出水与最终保护另行验收。完整分配见 [接线文档](../wiring.md)。

## 硬件认图

<a href="https://www.honor.com/cn/phones/honor-robot-phone/" target="_blank" rel="noopener noreferrer"><img src="/roboplanter/assets/hardware/honor-robot-phone.webp" alt="HONOR Robot Phone 官方产品图" width="100" /></a> <a href="https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32S3-Plus-p-6361.html" target="_blank" rel="noopener noreferrer"><img src="/roboplanter/assets/hardware/xiao-esp32s3-plus.jpg" alt="Seeed XIAO ESP32-S3 Plus 官方产品图" width="200" /></a> <a href="https://www.seeedstudio.com/SenseCAP-Indicator-D1-p-5643.html" target="_blank" rel="noopener noreferrer"><img src="/roboplanter/assets/hardware/sensecap-indicator-d1.png" alt="Seeed SenseCAP Indicator D1 官方产品图，原厂示例界面" width="200" /></a>

从左到右为 **HONOR Robot Phone**（YOYO 对话）、**Seeed XIAO ESP32-S3 Plus**（配合 Robot Board 控制外设）、**Seeed SenseCAP Indicator D1**（显示与触摸）。点击图片可打开官方产品页，型号说明和全部链接见 [硬件图鉴](hardware-catalog.md)。产品图来自各厂商官方页面。

## 1. 先确认你拿到的是哪块板

本教程的直接支持对象是：

- **Seeed XIAO ESP32-S3 Plus + XIAO Robot Board V1.0**。XIAO 工程使用 16 MB Flash、8 MB OPI PSRAM 的配置。
- **原款 4 英寸、480×480 SenseCAP Indicator** 的 ESP32-S3 部分，8 MB Flash/OPI PSRAM。屏幕采用 ST7701，代码固定触摸地址 `0x48`。本仓库已有 D1 实物记录；其他屏幕批次仍需核对。
- 一台 Windows 或 Linux 电脑、一条能传数据的 USB 线；后续再接实际传感器、外置驱动和负载。

其他 ESP32-S3 板、普通 XIAO/Sense、不同分辨率屏幕、不同触摸控制器，不能仅因名字相似就使用这些二进制。移植时先核对 Flash/PSRAM、可用 GPIO、启动脚、电源路径和显示驱动，再修改源码并重做验收。

XIAO 是实际测量与执行控制器；Indicator 是 Wi-Fi 显示和手动操作端。**两板不接 UART、I²C 或 USB 数据线**，分别供电即可：

```text
电脑/Indicator -- 同一 2.4 GHz Wi-Fi --> XIAO HTTP API
荣耀手机      -- BLE -----------> 同一台 XIAO
                                      |
                             传感器 / 灯 / 外置泵驱动 / UART 打印机
```

![XIAO、手机、Indicator 与独立负载的连接逻辑](../../web/experience/assets/wiring-overview.svg)

Indicator 内部的 ESP32-S3 与 RP2040 已有连接。默认屏幕工程刷写 ESP32-S3；启用 Indicator 土壤采集时，还需安装 RP2040 采集程序并使用内部 UART。详见 [Indicator 固件](../../firmware/indicator/README.md)。

### 与原套件例程的区别

附件 `Seeed XIAO Robot Kit x Honor Robot Phone Getting Started.zip` 的入门说明、旧车 Skill 和 V1.0 原理图是硬件参考。

- 原小车例程包含电机、舵机、加热等功能；本项目不运行这些功能。
- 原教程和旧固件部分电机/加热引脚存在版本差异。本固件启动时拉低 GPIO2/3/39/11/12 以及已确认继电器的 GPIO42；首次烧录时仍须物理断开原电机、舵机、加热器和泵。
- 旧 Skill 的 `forward`、`stop`、舞蹈命令不能控制本固件；新协议的停泵是带鉴权的 `stop_water`。
- 旧例程的 Arduino Core 和库选择不能覆盖本项目 `platformio.ini` 中的固定版本。

原设备 Flash 备份和本地凭据单独保存，不提交到仓库。

## 2. 器材和电源准备

第一轮只需要主板、USB 数据线和电脑。逐项加装时再准备：

- 万用表；合适的 Grove 转接线；可识别 pin1 的标记。
- 已知型号、工作电压和模拟输出范围的土壤探头。输出不得超过 ESP32 的 3.3 V 输入范围。
- 当前为 SEN54（独立5V、I²C信号3.3V）、Grove Light Sensor v1.2、Ultrasonic Ranger v2.0、Relay v1.2；DHT20、Air Quality和UV已替换。
- 可选 GRB、800 kHz 单线灯带；明确灯数、电流及供电规格。
- 水泵：独立额定电源、适合启动电流的外置驱动、3.3 V 可识别且高电平开启的逻辑输入、输入下拉、适合负载的续流/瞬态保护、可立即切断泵支路的物理开关。
- 打印机：明确型号、额定供电、UART 波特率、TTL 电平和 ASCII/LF 协议；必要的电平转换。

**首次只使用一个已确认的 USB 供电/下载入口。** 附件要求不要同时连接 XIAO 顶部 USB-C 与 Robot Board 的 5 V USB-C。没有核对供电路径前，也不要把 USB、外部 5 V 和电池同时接上。载板电池口按原板设计使用，不接 12 V。

泵和打印机的 12 V 支路不经过 XIAO、Grove 或载板的 5 V 电机输出。后期若共用一套电源，可使用额定合适的 `12 V → 稳压 5 V` 降压给控制板供电，但这不是首次 USB 联调的前置条件。电气连接的 XIAO、驱动、传感器和 UART 打印机需要公共 GND；只通过 Wi-Fi 通信且各自 USB 供电的 Indicator 不必额外接地线。

## 3. 在不接设备的情况下准备软件

先下载 [RoboPlanter 源码包](https://peterpanstechland.github.io/roboplanter/downloads/roboplanter-starter.zip)，按 [发布清单](https://peterpanstechland.github.io/roboplanter/downloads/manifest.json) 核对 SHA-256，解压到一个空目录（例如 `C:\work\RoboPlanter` 或 `~/work/RoboPlanter`）。包内 `SOURCE-MANIFEST.json` 记录每个源码文件的哈希。源码包提供可构建的源文件和示例配置，解压后填写本地参数。

安装 Python 3.10 或更高版本及 Git，打开项目根目录。下面使用本地 `.tools` 虚拟环境，依赖不装进系统 Python。第一次安装/编译需要联网下载官方工具链；这些命令不会刷写设备。

Windows PowerShell：

```powershell
Set-Location 'C:\work\RoboPlanter' # 改为你的仓库目录
py -3 --version
py -3 -m venv .tools\handbook-venv
$rpPython = Join-Path (Get-Location) '.tools\handbook-venv\Scripts\python.exe'
& $rpPython -m pip install 'platformio==6.1.18' 'esptool==4.9.0'
& $rpPython -m platformio --version
```

Linux Bash：

```bash
cd ~/work/RoboPlanter # 改为你的仓库目录
python3 --version
python3 -m venv .tools/handbook-venv
rp_python="$PWD/.tools/handbook-venv/bin/python"
"$rp_python" -m pip install 'platformio==6.1.18' 'esptool==4.9.0'
"$rp_python" -m platformio --version
```

Linux 若缺少 `venv`，按发行版安装对应的 Python venv 软件包，再重做该步骤。不要通过 `sudo pip` 绕过环境问题。后续命令假定保留当前终端中的 `$rpPython` / `$rp_python`。

先建立本地配置副本。已有自己的配置时不要覆盖，先备份并逐项核对：

```powershell
# Windows；文件已经存在时，此步骤会停下，让你检查原配置。
if (Test-Path firmware\xiao\include\config.local.h) { throw '保留原配置，手动核对后继续' }
if (Test-Path firmware\indicator\include\local_config.h) { throw '保留原配置，手动核对后继续' }
Copy-Item firmware\xiao\include\config.local.example.h firmware\xiao\include\config.local.h
Copy-Item firmware\indicator\include\local_config.example.h firmware\indicator\include\local_config.h
```

```bash
# Linux；cp -i 会在覆盖前询问，已有文件时请选择不覆盖并手动核对。
cp -i firmware/xiao/include/config.local.example.h firmware/xiao/include/config.local.h
cp -i firmware/indicator/include/local_config.example.h firmware/indicator/include/local_config.h
```

第一次保留 XIAO 的全部 `ROBO_ENABLE_* 0`、硬件确认标志 `0` 和默认令牌。不要先启用执行器。默认凭据只用于受控桌面的初始只读验证。

编译两个独立工程：

```powershell
& $rpPython -m platformio run --project-dir firmware/xiao -e xiao_robot_board
if ($LASTEXITCODE -ne 0) { throw 'XIAO 编译失败，先排障' }
& $rpPython -m platformio run --project-dir firmware/indicator -e sensecap_indicator
if ($LASTEXITCODE -ne 0) { throw 'Indicator 编译失败，先排障' }
```

```bash
"$rp_python" -m platformio run --project-dir firmware/xiao -e xiao_robot_board
# 只在上条命令成功后继续
"$rp_python" -m platformio run --project-dir firmware/indicator -e sensecap_indicator
```

通过条件是命令退出码为 0，日志显示 `SUCCESS`。XIAO 固定 Espressif32 6.12.0 / Arduino ESP32 2.0.17、ArduinoJson 6.21.5、NeoPixel 1.12.3；Indicator 使用同一平台及 GFX 1.4.7。编译成功只验证软件构建，不验证接线、泵断电或 BLE 真机兼容。

可选运行不接硬件的核心测试，见 [tests/core/README.md](../../tests/core/README.md)。Linux 有 GCC 时：

```bash
g++ -std=c++11 -Wall -Wextra -Werror -pedantic tests/core/controller_test.cpp -o /tmp/roboplanter-controller-test
/tmp/roboplanter-controller-test
g++ -std=c++17 -Wall -Wextra -Werror -pedantic tests/core/indicator_ui_test.cpp -o /tmp/roboplanter-ui-test
/tmp/roboplanter-ui-test
```

Windows 的 Visual Studio C++ Developer PowerShell 可运行 `tools/test-core.ps1`、`tools/test-indicator-ui.ps1`；只装 Python 不会自动带 C++ 编译器。

## 4. 识别串口，读取并保存原固件

**本节接下来会连接串口，但仍不写 Flash。** 一次只插入要操作的那块板。先关闭 Arduino 串口监视器、PlatformIO monitor 和其他占用端口的软件。

列端口：

```powershell
& $rpPython -m platformio device list
```

```bash
"$rp_python" -m platformio device list
```

拔掉再插上，确认新增的是目标板。Windows 示例 `COM7`、Linux 示例 `/dev/ttyACM0` 仅是占位示例。**Indicator 选择 `USB-SERIAL CH340` 对应 ESP32-S3 端口，不能选择 RP2040 端口。** Linux CH340 往往为 `/dev/ttyUSB*`，XIAO USB CDC 往往为 `/dev/ttyACM*`，不能只靠这个规律判定。

用 `flash_id` 确认芯片和容量。它会复位/连接 ROM 下载器，应在所有负载断开时执行：

```powershell
$rpPort = 'COM7' # 刚刚确认的当前目标串口
& $rpPython -m esptool --chip esp32s3 --port $rpPort flash_id
```

```bash
rp_port=/dev/ttyACM0 # 刚刚确认的当前目标串口
"$rp_python" -m esptool --chip esp32s3 --port "$rp_port" flash_id
```

如果目标/容量不符，停止，不执行上传。确认 XIAO Plus 为 16 MB 后用 `0x1000000` 读取；确认 Indicator 为 8 MB 后用 `0x800000`。下面以 XIAO 为例，备份文件名自己起唯一名称，避免覆盖旧文件：

```powershell
New-Item -ItemType Directory -Force build\device-backups | Out-Null
$rpBackup = 'build\device-backups\my-xiao-before-roboplanter.bin'
if (Test-Path $rpBackup) { throw '换一个备份文件名，勿覆盖已有备份' }
& $rpPython -m esptool --chip esp32s3 --port $rpPort --baud 460800 read_flash 0x0 0x1000000 $rpBackup
if ($LASTEXITCODE -ne 0) { throw '读取失败，不能把残缺文件当备份' }
& $rpPython -m esptool --chip esp32s3 --port $rpPort --baud 460800 verify_flash --flash_mode keep --flash_freq keep --flash_size keep 0x0 $rpBackup
if ($LASTEXITCODE -ne 0) { throw '备份与 Flash 不一致，先排障' }
(Get-Item $rpBackup).Length
Get-FileHash $rpBackup -Algorithm SHA256
```

```bash
mkdir -p build/device-backups
rp_backup=build/device-backups/my-xiao-before-roboplanter.bin
test ! -e "$rp_backup" || { echo '备份已存在，请更换文件名'; exit 1; }
"$rp_python" -m esptool --chip esp32s3 --port "$rp_port" --baud 460800 read_flash 0x0 0x1000000 "$rp_backup"
# 上条成功后才继续；失败文件不是可用备份。
"$rp_python" -m esptool --chip esp32s3 --port "$rp_port" --baud 460800 verify_flash --flash_mode keep --flash_freq keep --flash_size keep 0x0 "$rp_backup"
wc -c "$rp_backup"
sha256sum "$rp_backup"
```

通过条件：XIAO 备份恰为 **16,777,216 字节**，Indicator 恰为 **8,388,608 字节**，`verify_flash` 成功。把型号、容量、日期、哈希和对应文件记在本地。完整 Flash 可能含密码、令牌、个人配置；`build/` 已忽略，备份不提交到仓库。需要恢复时只使用这台板自己的完整备份，见 [排障：恢复](troubleshooting.md#恢复原来的-esp32-固件)。

## 5. 明确选择目标，再手动上传

上传会覆盖目标板的程序；不是读取操作。确认负载断开、备份可用、端口刚刚核实、编译环境匹配后，选择**一组**命令运行。

XIAO：

```powershell
& $rpPython -m platformio run --project-dir firmware/xiao -e xiao_robot_board -t upload --upload-port $rpPort
if ($LASTEXITCODE -ne 0) { throw '上传失败，先排障' }
& $rpPython -m platformio device monitor --port $rpPort --baud 115200
```

```bash
"$rp_python" -m platformio run --project-dir firmware/xiao -e xiao_robot_board -t upload --upload-port "$rp_port"
# 成功后观察串口，Ctrl+C 退出监视器
"$rp_python" -m platformio device monitor --port "$rp_port" --baud 115200
```

Indicator：拔下前一块，重新识别 CH340 端口并更新变量，不能沿用 XIAO 端口。

```powershell
& $rpPython -m platformio run --project-dir firmware/indicator -e sensecap_indicator -t upload --upload-port $rpPort
if ($LASTEXITCODE -ne 0) { throw '上传失败，先排障' }
& $rpPython -m platformio device monitor --port $rpPort --baud 115200
```

```bash
"$rp_python" -m platformio run --project-dir firmware/indicator -e sensecap_indicator -t upload --upload-port "$rp_port"
"$rp_python" -m platformio device monitor --port "$rp_port" --baud 115200
```

上传成功应含写入校验成功及 `SUCCESS`。再重启并观察至少 20 秒，无重启循环或 panic。XIAO 应报告 `RoboPlanter-XXXX ready`、HTTP 地址及 `actions disabled`；抄下你这台板的完整名称，只保存在本地。Indicator 检查显示、触摸、客户端任务等启动结果，并实看画面和触摸；初始化 `ready` 不能代替肉眼验证。串口观察结束后 `Ctrl+C` 关闭，后续刷写前也要关闭它。

不要把 `.pio/build/.../firmware.bin` 当成可在 `0x0` 恢复的整片镜像。PlatformIO 上传会按工程分区和地址写入相关段；本教程刻意不用手工猜测地址的单 bin 烧录命令。

## 6. 第一个通过点：只读 HTTP 状态

将电脑 Wi-Fi 连接到刚才看到的 `RoboPlanter-XXXX`，初始密码为 `planter-demo`。这个热点没有互联网是正常现象；保持连接。检查电脑得到 `192.168.4.*` 地址，避免 VPN/另一网卡将请求导向别的网络。

在**项目根目录**运行：

```powershell
# 初次默认配置；删掉旧会话的环境变量以免误用别的设备令牌。
Remove-Item Env:ROBOPLANTER_TOKEN -ErrorAction SilentlyContinue
& $rpPython tools/device_cli.py state
```

```bash
unset ROBOPLANTER_TOKEN
"$rp_python" tools/device_cli.py state
```

正确结果应是 `schema_version: 1`、本机 `device_id`、不断增加的 `uptime_ms`、较小的 `sample_age_ms`；全部未启用的传感器数值为 `null`、`valid:false`，泵/灯/打印 `enabled:false`，泵 `on:false`。**这时不要用浇水来验证“有没有连上”。** 网络链路已经可以仅凭只读状态验证。

然后配置 Indicator：在 `firmware/indicator/include/local_config.h` 中把 `PLANTER_WIFI_SSID` 改为完整实际热点名，初期密码和令牌保持与 XIAO 一致，`PLANTER_BASE_URL` 保留 `http://192.168.4.1`。重新编译并只上传 Indicator。

屏幕右上齿轮可扫描 Wi-Fi、输入密码并连接。但**仅修改屏幕 Wi-Fi 不会修改固件中的设备令牌、HTTP 地址或允许访问的 `PLANTER_WIFI_SSID`**；必须先把编译配置的 SSID 对准实际 XIAO。当前代码只向匹配该 SSID 的网络发花盆请求。验证主界面显示花盆已连接、数据缺失状态正确、执行按钮禁用；Wi-Fi 图标亮起本身不代表 HTTP 鉴权通过。

## 7. 为自己的设备设置私密凭据

受控桌面完成默认只读检查后，为 XIAO 设置新的热点密码和设备令牌。令牌用随机 **32 个十六进制字符**即可满足固件长度要求；不含空格和 `|`。热点密码用 8–63 个 ASCII 字符，首次建议采用随机字母数字，避免引号/反斜杠需要 C++ 字符串转义。两者不要相同，不放在截图、提示词、Skill 文件或公开视频里。

在本地编辑器中修改：

- XIAO `config.local.h`：`ROBO_DEVICE_TOKEN`、`ROBO_AP_PASSWORD`，继续保持所有动作关闭。
- Indicator `local_config.h`：相同的 `PLANTER_DEVICE_TOKEN`、对应 `PLANTER_WIFI_PASSWORD`，准确的 `PLANTER_WIFI_SSID`。

可在本机 Python 交互窗口用 `import secrets; secrets.token_hex(16)` 生成随机令牌；输出仅供自己复制到两个本地配置文件，不要截屏或粘贴到聊天。重新编译/上传后，电脑和屏幕均需用新热点密码重连。

CLI 通过环境变量读取令牌。下面从终端隐蔽输入，不把真实令牌写进命令历史：

```powershell
$rpSecret = Read-Host '输入本机设备令牌（不回显）' -AsSecureString
$rpPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($rpSecret)
try { $env:ROBOPLANTER_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($rpPtr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($rpPtr) }
& $rpPython tools/device_cli.py state
# 使用后执行：Remove-Item Env:ROBOPLANTER_TOKEN
```

```bash
read -r -s -p '输入本机设备令牌（不回显）: ' ROBOPLANTER_TOKEN
printf '\n'
export ROBOPLANTER_TOKEN
"$rp_python" tools/device_cli.py state
# 使用后执行：unset ROBOPLANTER_TOKEN
```

固件中的令牌仍存在 Flash，本地进程环境也不是硬件密钥保险箱；这是受控原型的鉴权方式。HTTP没有TLS，应只用于受控局域网。当前YOYO使用可选的SC+MITM绑定BLE，HTTP令牌不进入Skill；见[BLE v2教程](ble-integration.md)。

## 8. 逐件接线和启用

**每次换线先断开电源。** 编号来自 V1.0 原理图，不是从插座左往右数的位置。先按丝印找到 pin1，断电用万用表确认 GND/连通性，再上电空载量供电电压；探针避免跨接相邻针脚。未知连接器、电平或极性时保持该外设关闭。

### 8.1 先按最新总表接线

[2026-10-29硬件接线总表](../wiring.md)是当前接线依据。Robot Board的分配为：SERVO1/GPIO42继电器、SERVO2/GPIO8超声波、SERVO3/GPIO1环境光、SERVO4/GPIO7打印TX；土壤在Indicator RP2040 GPIO27。M2/J9不用。

土壤探头按3.3V供电，黄线接Indicator左侧Grove GPIO27；RP2040运行仓库的soil_uart.py，屏幕开启PLANTER_ENABLE_LOCAL_SOIL，XIAO开启ROBO_ENABLE_REMOTE_SOIL，并关闭ROBO_ENABLE_SOIL。内部UART和HTTP会把原始值汇总给XIAO。数据断线必须失效。

在实际探头、基质和插入深度下，通过 **设置 → 花盆连接 → 传感器校准 → 土壤** 采集干/湿参考并保存到主控。两值必须在0–4095内，差至少64；具体步骤见[校准教程](sensor-calibration.md)。编译期的ROBO_SOIL_DRY_RAW/ROBO_SOIL_WET_RAW仅作为没有保存记录时的初始值。未标定时percent为空是正确结果。百分比只是相对干湿，不是体积含水率；本机尚未完成实际基质标定。

### 8.2 SEN54统一温湿度和空气感知

SEN54的SCL→IIC pin1/GPIO6，SDA→pin2/GPIO5，地址0x69。**VCC独立5V，信号和上拉3.3V，共地**；IIC pin3的3.3V不能供SEN54使用，也不能被5V反灌。当前此接法已确认。

启用ROBO_ENABLE_SEN54和ROBO_SEN54_WIRING_CONFIRMED；关闭DHT20、SHT31及模拟AIR。SEN54已有温湿度，旧Grove Temperature & Humidity v2.0可以拆下备用，不必重复接。观察CRC、有效标记、温湿度、PM2.5和VOC；它不测CO₂，SEN54不提供NOx。

### 8.3 环境光与超声波

- Light Sensor v1.2黄线OUT→SERVO3/J13 pin1，D0/GPIO1；红线另取3.3V、黑共地、白不接。启用ROBO_ENABLE_AMBIENT_LIGHT及ROBO_AUX_PINS_CONFIRMED；UV/本地土壤保持0。遮挡响应已通过，ADC不是lux。
- Ultrasonic Ranger v2.0黄线SIG→SERVO2/J5 pin1，D9/GPIO8；红线另取3.3V、黑共地、白不接。启用ROBO_ENABLE_ULTRASONIC及ROBO_ULTRASONIC_WIRING_CONFIRMED；AIR保持0。单SIG双向测距，不能插IIC口。
- 先对准10–30cm平整物体验证变化。当前只验收距离，水箱未建好，不能报告余水百分比。后续满/空/停泵距离标定见[接线总表](../wiring.md)。

### 8.4 灯带

确认型号是 GRB 800 kHz 单线协议，灯数/最大电流在供电能力内：DIN → **J7 pin1**（GPIO40 经板载缓冲），GND → pin4；只有已确认适合 5 V 的灯带才使用 J7 pin3 的 VSYS_5V。不能把灯带 DOUT 当作 DIN。大灯带需要按额定电流独立供电与合适线径，不让超额电流经过小连接器。

先把 `ROBO_LED_COUNT` 设为实际数量，保留较低 `ROBO_LED_BRIGHTNESS`，将 `ROBO_ENABLE_LIGHT 1`、`ROBO_ENABLE_ACTIONS 1`；前提是已换非默认令牌。泵/打印继续关闭。

明确进行一次开灯和关灯测试：

```powershell
& $rpPython tools/device_cli.py light on
& $rpPython tools/device_cli.py light off
```

```bash
"$rp_python" tools/device_cli.py light on
"$rp_python" tools/device_cli.py light off
```

通过条件是回复 `completed`、`light.on` 与实物一致。然后逐项尝试 `light on --effect breath`、`chase`、`rainbow`，每次观察后可用 `light off` 关闭。HTTP 状态的 `light.effect` 应对应所选模式；旧开灯命令仍使用 `solid`。完整模式、BLE 格式和验收见 [WS2812 教程](ws2812-lighting.md)。这是装饰灯，不是标定过的植物生长灯；没有远程任意调色、亮度或速度接口。

### 8.5 UART 打印机

先确认供电与 TTL 电平。断电后将 **SERVO4/J14 pin1 / D8 / GPIO7 → 打印机 RX**；打印机 TX 确认是 3.3V 逻辑或加电平转换后 → 原 UART/J10 pin2 / GPIO44。公共 GND → J10 pin4，GPIO43 不接打印机。SERVO4 不能同时接泵或舵机，打印与泵使用不同GPIO；控制器限制两者不能同时运行。**打印机独立供电，SERVO4 的 Motor5V 和 UART 的 3.3V 都不接打印机电源。** 详细接线与验收见 [UART 打印机](uart-printer.md)。

设置实际 `ROBO_PRINTER_BAUD`，确认换线后设置 `ROBO_ENABLE_PRINTER 1`、`ROBO_PRINTER_HARDWARE_CONFIRMED 1`、`ROBO_PRINTER_D8_WIRING_CONFIRMED 1`，并保持动作总开关及非默认令牌；泵继续关闭。先发送短 ASCII：

```powershell
& $rpPython tools/device_cli.py print 'Hello planter'
# 抄下 stderr 中 request_id，再查询同一个 ID：
& $rpPython tools/device_cli.py result '<刚才的ID>'
```

```bash
"$rp_python" tools/device_cli.py print 'Hello planter'
"$rp_python" tools/device_cli.py result '<刚才的ID>'
```

等待 `accepted → completed`，同时人工确认纸上文本正确。`bytes_sent` / `completed` 只证明软件串口发送完成，不证明出纸。请求支持最多 160 字节 UTF-8（ASCII、GB2312 映射字符及 LF），自动换行最多 8 行；固件转换为 384 点光栅，添加固定初始化、走纸和可选切刀指令，不接受调用方传入控制码。切刀须显式设置 `ROBO_PRINTER_CUTTER_CONFIRMED 1`；缺纸或机械完成反馈尚未实现。超时或乱码先排查，不能自动重印。

### 8.6 Grove Relay与水泵：当前只到空载

Relay v1.2的SIG→SERVO1/J1 pin1，D15/GPIO42，模块电源按已确认的3.3–5V供电，共地。GPIO7属于打印机，不能接泵；M2/J9不使用。继电器已完成300ms吸合/释放验证，负载两端子保持空着，ROBO_ENABLE_PUMP保持0。

等水箱完成并确认泵电流、触点/电源能力和负载保护后，再设置满水、空箱、停泵三个距离阈值。软件已经检查未标定、过期/无效回波、低水位及异常距离；未完成实物测试前不能把这些检查当作真实泵保护已验收。

未来12V支路接继电器常开触点后再接泵，不经过GPIO或Grove电源脚。逐项验证短脉冲、到时停止、主动停泵、复位、断网和水位异常，再测流量；当前教程不要求提前接负载或开放浇水。


## 9. 每一步如何记验收结果

把记录存到本地或使用 [验收记录](acceptance.md)，不要上传凭据。每项至少记录日期、板型、固件 Git 提交、构建配置摘要（不含密码）、测试操作、预期、实际软件结果、实物观察、通过/失败和问题编号。

完成层级应分开写：

1. **已构建**：编译通过。
2. **已刷写**：正确芯片、容量、端口，上传校验通过。
3. **已启动**：串口和屏幕启动正常。
4. **已联网只读**：实际设备状态可读，字段/过期处理正确。
5. **已验证单件硬件**：已检查实际读数、出纸、灯光和停泵情况。
6. **已验证手机链路**：BLE 长写、鉴权、通知、结果关联及异常处理通过。

## 10. 来源与进一步阅读

- 引脚、电源网络：套件 V1.0 原理图第5–6页；接线前核对实物板型与丝印。
- 实现真值：[XIAO 配置](../../firmware/xiao/include/robo_config.h)、[XIAO 主程序](../../firmware/xiao/src/main.cpp)、[控制核心](../../firmware/xiao/include/controller.h)、[Indicator 配置](../../firmware/indicator/include/config.h)、[两板协议](../device-protocol.md)、[已有接线说明](../wiring.md)。
- [Seeed XIAO ESP32-S3 系列官方指南](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)：型号、引脚与下载模式；本项目依赖以仓库固定版本为准。
- [Seeed Indicator Arduino 官方指南](https://wiki.seeedstudio.com/SenseCAP_Indicator_ESP32_Arduino/)：双 MCU、CH340 ESP32 端口、屏幕/OPI PSRAM 背景。
- [PlatformIO Core 官方安装说明](https://docs.platformio.org/en/latest/core/installation/methods/installer-script.html)、[Espressif esptool v4 基础命令](https://docs.espressif.com/projects/esptool/en/release-v4/esp32s3/esptool/basic-commands.html)：本教程固定 v4 命令语法，避免与 v5 的命令拼写混用。
