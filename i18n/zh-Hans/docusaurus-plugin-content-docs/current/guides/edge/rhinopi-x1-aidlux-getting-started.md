---
sidebar_position: 2
sidebar_label: 犀牛派 X1 + AidLux 上手
title: 犀牛派 X1 + AidLux 上手实操：从刷机到「工位回血」
description: 用 rhinopi-x1-aidlux 仓库，把犀牛派 X1（高通 QCS8550）刷成 AidLux 融合系统，跑通环境检查、USB 摄像头、NPU 体检，最后在浏览器里玩上半身久坐监测小游戏「工位回血」。
tags: [rhinopi-x1, aidlux, qcs8550, edge-ai, hands-on]
keywords: [犀牛派, rhinopi, rhino pi x1, aidlux, aidlite, qcs8550, qnn, qfil, blazepose, usb camera, 久坐提醒, 坐姿检测]
---

# 犀牛派 X1 + AidLux 上手实操：从刷机到「工位回血」

这篇是 [rhinopi-x1-aidlux](https://github.com/peterpanstechland/rhinopi-x1-aidlux) 仓库的上手指南。照着做完，你会得到：

- 一块刷好 **AidLux 融合系统**（Android 13 + Ubuntu 22.04）的犀牛派 X1
- 环境检查、USB 摄像头、CPU / OpenCV / NPU 体检三份能对照的输出
- 一个在浏览器里玩的上半身小游戏 **工位回血**：摄像头盯着你有没有久坐、坐姿好不好，坐满 25 分钟就带你做一组 2 分钟的伸展动作

![工位场景：屏幕上沿的 C920，旁边垫子上的犀牛派 X1](/img/guides/edge/rhinopi-x1/desk-scene.jpg)

:::info 本文的依据
所有命令、版本和数字都来自仓库（commit `5d97e02`，2026-10-08）里的文档、代码和实测记录。仓库里的数字是在一块联调板上跑出来的（2026-09-14 / 09-15 / 09-28），你的板子以当场输出为准。官方资料只作入口：[犀牛派 X1 文档](https://rhinopi.docs.aidlux.com/rhino-x1-aidlux/)、[AidLux 文档中心](https://docs.aidlux.com/)、[开发者门户](https://developer.aidlux.com/software/x1)。
:::

## 你要准备什么

| 东西 | 说明 |
| --- | --- |
| 犀牛派 X1 | 高通 QCS8550（`kalama`） |
| 12V 5A 电源 | DC 5.5×2.5 mm，插 **DC_IN**。不要用手机充电器，Type-C 也不能给板子供电 |
| Windows 电脑 | 刷机（QFIL）和 ADB 用；和板子在同一局域网 |
| USB-A 转 USB-C 线 | 电脑 USB-A ↔ 板子 **TYPE-C**，用来 ADB 和刷机 |
| 网线 | 插板子 **WAN**（系统里是 `eth0`），推荐有线 |
| USB 摄像头（UVC） | 仓库实测用 Logitech C920；插板子 **USB-A** |
| 可选 | HDMI 显示器（接 **HDMI_OUT**）、键鼠 |

软件这边，电脑上先把仓库拉下来：

```bash
git clone https://github.com/peterpanstechland/rhinopi-x1-aidlux.git
cd rhinopi-x1-aidlux
```

仓库里你会用到的目录：

| 目录 | 作用 | 端口 |
| --- | --- | --- |
| `examples/01_env_check` | 系统、Python、AidLite、相机探测 | — |
| `examples/usb_camera` | 找 USB 采集节点、抓帧、测 MJPG 帧率 | — |
| `examples/02_compute_bench` | CPU / OpenCV / NPU 体检 | — |
| `examples/04_mediapipe` | AidLite 上的 BlazePose（工位回血依赖它） | `:8091` |
| `examples/06_shadow_puppet` | 工位回血游戏 | `:8090` |

`03_modelfarm`、`05_yolo`、`07_csi_camera` 目前在仓库里还是「待写」，本文不涉及。

## 第 1 步：接线和上电

![接口这一侧：DC 圆孔、音频、USB-A、HDMI、RJ45](/img/guides/edge/rhinopi-x1/ports-front.jpg)

| 线 | 插哪里 | 做什么 |
| --- | --- | --- |
| 12V 5A 电源 | **DC_IN** | 唯一供电，插上后板子自己启动 |
| USB-A 转 USB-C | 板子 **TYPE-C** | ADB 和刷机。摄像头不要插这里 |
| 网线 | **WAN** | 上行口 `eth0`。旁边 3 个 **LAN** 是板载局域网 `192.168.1.1/24`（`br-lan`），SSH 不要找这个网段 |
| HDMI | **HDMI_OUT** | 可选。**HDMI_IN** 是采集口，不是显示输出 |
| 键鼠、摄像头 | **USB-A**（共 4 个） | 不要插 TYPE-C |

顺序：先插 DC_IN。启动过程中电源灯红灯常亮；**绿灯常亮并且风扇转**才算起来了。一直红灯、风扇不转，按一下 **POWER**。然后插 TYPE-C，在 Windows 上确认：

```bat
adb devices -l
```

看到 `product:kalama model:RhinoPi_X1` 就对了。接口定义以官方[硬件说明](https://rhinopi.docs.aidlux.com/rhino-x1-ubuntu/hardware-use/hardware_info)和[电源接口](https://rhinopi.docs.aidlux.com/rhino-x1-aidlux/hardware-use/power_header)为准。

:::tip 板子已经是融合系统？
如果你的板子已经装好 AidLux、能用 `ssh aidlux@<板子IP>` 登录，可以直接跳到[第 3 步](#login)。刷机会清空用户数据。
:::

## 第 2 步：刷机，装好 AidLux

### 2.1 选包

镜像在 AidLux 文件站下载（网页可能要登录）。下表是仓库 2026-09-14 实查时看到的文件，下载前请到[镜像列表页](https://rhinopi.docs.aidlux.com/rhino-x1-aidlux/resource-download/image_resource)确认最新版本。

| 用途 | 目录 | 当时的文件 | 大小 |
| --- | --- | --- | --- |
| Windows 刷机工具 | [eda4c1da](https://file.aidlux.com/files?folder_id=eda4c1da) | `QPST_2.7.496.zip`、`USB_Driver_qud.win.1.1_installer_10061.1.zip`、`platform-tools.zip` | 60 / 18 / 6 MB |
| 融合整包（一次刷完） | [4ccc30f9](https://file.aidlux.com/files?folder_id=4ccc30f9) | `RhinoPi-X1.T04_LA.user.2025121609.aidlux.zip` | 4.74 GB |
| 仅 Android | [a521955b](https://file.aidlux.com/files?folder_id=a521955b) | `RhinoPi-X1.T04_LA.user.2026070119.zip` | 1.85 GB |
| 仅 AidLux | [154a82b5](https://file.aidlux.com/files?folder_id=154a82b5) | `aidlux_3.0.0.124_enterprise_qc8550_lu2204_signed.zip` | 3.05 GB |

怎么选：

- **新板、想少一步**：融合整包，刷完在 Android 里把 AidLux 初始化到 100%。
- **板上版本已经比整包新**（例如构建号是 `2026070119`，而整包是 `2025121609`）：整包会降级，走**拆分**——先刷 Android，再用 `install.bat` 装 AidLux。
- OTA 只给已经是融合系统、只想升级的人，不是第一次刷机。

对照官方步骤：[融合整包安装](https://rhinopi.docs.aidlux.com/rhino-x1-aidlux/getting-started/system-install/install_system)、[拆分安装](https://rhinopi.docs.aidlux.com/rhino-x1-aidlux/getting-started/system-install/aidlux_install)。

### 2.2 装 Windows 工具

1. 解压 `USB_Driver_qud.win.1.1_installer_10061.1.zip`，运行 `setup.exe`
2. 解压 `QPST_2.7.496.zip`，运行 `QPST.2.7.496.1.exe`，一路 Next
3. QFIL 默认在 `C:\Program Files (x86)\Qualcomm\QPST\bin\QFIL.exe`
4. 电脑上没有 ADB 的话，用同目录里的 `platform-tools.zip`

### 2.3 进下载模式（EDL）

:::warning 刷机会清空板子上的用户数据
先备份。刷机和 AidLux 初始化过程中不要拔电源。
:::

对 **USB** 那条设备下命令，不要对网络 ADB（`ip:5555`）下：

```bat
adb -s <USB序列号> reboot edl
```

设备会变成 Qualcomm `9008` 端口，普通 `adb devices` 变空，这是预期的。

### 2.4 QFIL 刷机

1. Configuration → FireHose：Download Protocol 选 `0-Sahara`，Device Type 选 `ufs`，勾选 `Reset After Download`
2. Select Port 选 `9008`，Build Type 选 `Flat Build`
3. Programmer 选解压包里的 `xbl_s_devprg_ns.melf`（文件类型改成「所有文件」）
4. Load XML：弹出来的 XML **都选上**，会弹两次
5. Download。仓库实测大约 5 分钟，看到 successful 后板子自己重启

### 2.5 初始化 AidLux

- **整包**：Android 桌面上滑找到 AidLux，点开，等到 100%。
- **拆分**：`adb devices` 再次看到设备后，解压 AidLux zip，在 Windows 上运行 `install.bat`，提示 Success 后再到板子上打开 AidLux 完成初始化。仓库那次推进去约 2.59 GB 的 deb，并装了 3 个 APK。

验收：板子能开机、风扇转；AidLux 初始化到 100%；`adb devices` 或同网段能再连上。刷机失败找阿加犀售后，本文不写强刷。

## 第 3 步：登录板子 {#login}

默认用户名和密码都是 `aidlux` / `aidlux`，**第一次登录后请改掉**。三条路任选：

1. **HDMI 本机桌面**：插显示器和键鼠
2. **Web 桌面**：浏览器打开 `http://<板子IP>:8000/login`
3. **SSH**：后面拷代码、跑脚本都用它

```bash
ssh aidlux@<板子IP>
```

板子 IP 看你路由器的 DHCP 列表，或者在 HDMI 桌面 / `adb shell` 里查 `eth0` 的地址。

## 第 4 步：把示例拷到板子上

后面所有命令都假设代码放在板子的 `~/rhinopi-lab/examples/`。在**电脑**上、仓库根目录执行：

```bash
ssh aidlux@<板子IP> "mkdir -p ~/rhinopi-lab"
scp -r examples aidlux@<板子IP>:~/rhinopi-lab/
```

要拷整个 `examples`，不要只拷 `06_shadow_puppet`：游戏会从 `../04_mediapipe` 和 `../usb_camera` 引入 `pose_tracker.py` 和 `camera.py`。

:::info 为什么不用 pip 装 MediaPipe
仓库的联调板访问不了 pypi.org，镜像里也没有 MediaPipe。所以姿态检测用的是融合系统自带的官方 BlazePose TFLite 模型（`/opt/aidlux/app/aid-examples/pose_detect_track/models/`），通过 AidLite 加载。整个流程**不需要额外 pip install**。
:::

## 第 5 步：环境检查

```bash
cd ~/rhinopi-lab/examples/01_env_check
python3 check_env.py
```

脚本先打印一大段 JSON（系统、CPU、内存、磁盘、`dpkg` 里的 AidLite 相关包、`/dev/video*`、`lsusb`、温度），最后是一段摘要，格式是：

```text
=== summary ===
host     ...  kernel 5.15.178-android13-...
python   3.10.12
module   numpy: OK  ...
module   cv2: OK  ...
module   aidlite: OK  ...
module   mediapipe: MISSING  ...
aid-pkg  ...
mms      ...
video    yes
...
```

重点看 `aidlite` 和 `cv2` 是 **OK**。`mediapipe: MISSING` 是正常的。仓库联调板刷完自带：Python 3.10.12、numpy 1.26.4、OpenCV 4.13.0、AidLite `2.3.2.251`、NPU 插件 `aidlite-qnn236`。

如果 `import aidlite` 失败，用 `aid-pkg` 点装（NPU 后端版本要和模型卡片上的 QNN 一致，联调板是 `qnn236`，不要照旧文档装 `qnn216`）：

```bash
sudo aid-pkg update
sudo aid-pkg install aidlite-sdk
sudo aid-pkg install aidlite-qnn236
python3 -c "import aidlite; print(aidlite.get_py_library_version())"
```

:::caution 不要跑 apt upgrade / dist-upgrade
融合镜像的 Ubuntu 源是活的，全量升级会把 `kmod`、`systemd` 等和厂商包拧到一半（仓库作者踩过，修复方法见文末「常见问题」）。缺什么就单独装：`sudo apt install <包名>`，或走 `aid-pkg`。
:::

## 第 6 步：USB 摄像头

摄像头插板子的 **USB-A**，然后：

```bash
lsusb
ls -l /dev/video*
v4l2-ctl --list-devices
```

![插上 C920 之后的 video 节点和 lsusb](/img/guides/edge/rhinopi-x1/video-nodes.png)

关键点：**不插摄像头也有 video 节点**，不要写 `cv2.VideoCapture(0)`。

| 节点 | 名字 | 能不能采集 |
| --- | --- | --- |
| `/dev/video0` | `cam-req-mgr` | 不能，高通相机请求管理 |
| `/dev/video1` | `cam_sync` | 不能 |
| `/dev/video2` | `HD Pro Webcam C920` | **能**，OpenCV 走这里 |
| `/dev/video3` | 同一只 C920 | 不能，UVC metadata |
| `/dev/video32` `/dev/video33` | `msm_vidc_decoder` | 不能，硬解节点 |

然后跑探测脚本：

```bash
cd ~/rhinopi-lab/examples/usb_camera
python3 probe.py
```

`probe.py` 会按 `/sys/class/video4linux/*/name` 里含 `webcam` / `camera` / `uvc` 的节点自动挑采集口（找不到就退回 `video2`），用 **MJPG** 打开 1280×720，抓一张静图到 `~/rhinopi-lab/captures/usb_preview.jpg`，再测循环帧率。摘要长这样：

```text
=== summary ===
opened  /dev/video2  HD Pro Webcam C920
frame   (720, 1280, 3)  MJPG
still   /home/aidlux/rhinopi-lab/captures/usb_preview.jpg
fps     ...  avg ... ms
```

仓库实测 C920：循环约 **30.46 fps**，单帧平均 32.82 ms。同分辨率用 YUYV 只有 10 fps（USB 2.0 带宽），所以一定要先设 MJPG。自动识别不准时用 `--index` 指定节点。

## 第 7 步：CPU / NPU 体检

```bash
cd ~/rhinopi-lab/examples/02_compute_bench
python3 bench.py
# 只测 CPU / OpenCV：python3 bench.py --skip-npu
# 多跑几轮：python3 bench.py --loops 50 --warmup 10
```

NPU 一项用的是镜像自带的 YOLOv5s W8A8 模型，`TYPE_QNN236` + `TYPE_DSP`：

```text
/usr/local/share/aidlite/examples/aidlite_qnn236/data/qnn_yolov5_multi/cutoff_yolov5s_640_sigmoid_w8a8.qnn236.ctx.bin
```

![2026-09-28 复查：NPU 平均 4.734 ms](/img/guides/edge/rhinopi-x1/bench-npu.png)

仓库联调板 2026-09-14，640 输入，warmup 5 + 循环 20：

| 后端 | 平均 | 最小 | 最大 |
| --- | --- | --- | --- |
| numpy | 15.841 ms | 11.556 | 23.960 |
| OpenCV 预处理（1280×720 → 640 + blur） | 3.446 ms | 0.760 | 18.291 |
| AidLite QNN236 DSP（YOLOv5s W8A8） | 4.772 ms | 4.634 | 4.967 |

NPU 计时只包住 `set_input + invoke + get_output`，**不含** letterbox 和 YOLO 后处理，大约 210 次/秒。拿去和模型广场卡片比时，先确认对方是不是也不含前后处理。看到 `npu  FAIL  model not found` 说明那个 ctx 文件不在，先检查 `aidlite-qnn236`。

## 第 8 步：跑「工位回血」

```bash
cd ~/rhinopi-lab/examples/06_shadow_puppet
python3 game.py --demo
```

`--demo` 把久坐间隔缩到 **45 秒**，并清空当天进度，方便第一次就走完一局。终端会依次打印：

```text
loading upper-body Pose...
npu ok
open  http://192.168.88.216:8090/
sit interval 45s  acts=6  phase=away
frame 20 fps=... pose=True ...ms hand=0ms ui=...ms enc=...ms phase=monitor/ ...
```

:::tip 终端里那个 IP 是写死的
`game.py` 启动时打印的 `http://192.168.88.216:8090/` 是仓库联调板的地址，代码里写死了。实际服务监听在 `0.0.0.0:8090`，你要打开的是 **`http://<你的板子IP>:8090/`**。
:::

电脑浏览器打开 `http://<板子IP>:8090/`，坐到摄像头前，让头、双肩、双手都在画面里。

![久坐页：右侧坐姿分，底栏 FPS / POSE / NPU](/img/guides/edge/rhinopi-x1/desk-sit.jpg)

你会看到：

- **久坐页**：摄像头实时画面 + 像素火柴人叠层，顶部是 HP 条和「已坐 / 还有多久回血」，右侧是坐姿评分（0–100）和当前最差的一项（低头前伸、肩膀歪了、身子偏了、离屏幕太近、整个人往下塌）
- **底栏**：`FPS`、`POSE ms`、`NPU ms`、NSP / CPU 温度，以及 `SIT` / `RUN` / `WIN` 计数
- **提醒**：静坐满间隔（默认 25 分钟），或坐姿把 HP 扣光，进入提醒；**动起来**就开始一回合。监测时**举手或展翅**保持约 0.5 秒也能提前开局
- **回合**：上下分屏，上半是像素舞台和跟着你动的 Minecraft 风数字人，下半是实时小窗、倒计时和坐姿。一回合 **120 秒**，从 8 个动作里轮换抽 6 个，每个动作完成才过关并自动跳下一屏，时间到了剩下的记未完成
- **总结**：每个动作的评级（S/A/B/C）、用时、得分，加本回合坐姿评级；约 13 秒后（或举手）回到监测，久坐清零

![回合里的滑雪：上半像素舞台，左下实时小窗](/img/guides/edge/rhinopi-x1/desk-ski.jpg)

8 个动作和过关条件（以 `loop.py` 当前代码为准）：

| 动作 | 过关条件 |
| --- | --- |
| 展翅 | 两侧手臂撑满并坚持 5 秒 |
| 老鹰 | 展翅扇动 8 次飞到旗子 |
| 挥手 | 左右挥手送走 10 个人 |
| 滑雪 | 头往左右偏，碰到 6 面旗、躲松树 |
| 弹琴 | 手部 21 点，按中 8 个黄键 |
| 跳跃 | 坐着把身子往上颠，跳过 5 个仙人掌 |
| 转头 | 左右各 3 次 |
| 点头 | 点头 6 次 |

另一个窗口里可以看状态 JSON（`phase`、`hp`、`sit_s`、`score`、`posture` 等）：

```bash
curl http://<板子IP>:8090/status
```

看完 demo，用正式参数跑：

```bash
python3 game.py                                   # 默认 25 分钟提醒，一回合 6 个动作
python3 game.py --interval-min 15 --round-acts 6  # 自定义间隔和动作数
python3 game.py --no-npu                          # 不跑底栏的 NPU 脉冲，玩法不受影响
python3 game.py --reset                           # 清空当天进度
```

其他参数：`--index` 指定摄像头节点，`--port` 换端口（默认 8090），`--accel` 选 `GPU`（默认）/ `CPU` / `DSP`，`--no-web` 不起网页，`--seconds N` 跑 N 秒自动退出，`--save 路径` 退出时存最后一帧。`Ctrl+C` 退出，进度按天写在同目录的 `save.json`。

仓库实测（C920，TFLite GPU）：久坐页约 7–13 fps；检出人时 POSE 约 70–110 ms，没检出约 33 ms；底栏 NPU 脉冲约 9–20 ms（每 18 帧一次，含 letterbox，所以比体检的 4.7 ms 大）。

### 没有板子也能先看画面

`render_probe.py` 用合成的姿态把每一屏渲染成图片，只依赖 numpy 和 OpenCV，不需要摄像头和 AidLite。2026-10-08 在一台 x86 Linux 上用 `opencv-python-headless` + `numpy` 验证过：

```bash
cd examples/06_shadow_puppet
python3 render_probe.py --out /tmp/ui
```

会写出 `01_monitor.jpg`、`03_alert.jpg`、`10_act_*.jpg`（8 个动作各一张）、`30_summary.jpg` 等 15 张图。游戏流程的单元测试也能离线跑，要把 `04_mediapipe` 加进 `PYTHONPATH`：

```bash
PYTHONPATH=../04_mediapipe python3 test_loop.py   # 最后一行应为 loop ok
```

## 它是怎么工作的

![一帧里的两条路：上半身姿态进玩法，量化 YOLO 只写底栏](/img/guides/edge/rhinopi-x1/diagram-paths.jpg)

每一帧走两条路：

1. **上半身姿态（进玩法）**：`04_mediapipe/pose_tracker.py` 用 AidLite 加载官方 BlazePose——先 `pose_detection.tflite`（128×128，896 个候选框），再 `pose_landmark_upper_body.tflite`（256×256，31 个点）。配置是 `TYPE_TFLITE` + `TYPE_FAST`，默认 `TYPE_GPU`，float32 输入。检测阈值 0.42，关键点平滑系数 0.35，画面镜像后会纠正左右肩。
2. **NPU 脉冲（只写底栏）**：`stats.py` 里的 `NpuPulse` 每 18 帧把当前画面喂给 YOLOv5s W8A8（QNN236 DSP）一次，只回答「NSP 还通不通」，不参与坐姿和动作判断。

弹琴那一屏会临时加载 `hand_track/models/` 下的 `palm_detection.tflite` + `hand_landmark.tflite`（21 点），这时手部每帧跑、姿态降到每 3 帧一次。

![一局：监测、提醒、六个动作、总结，然后回到监测](/img/guides/edge/rhinopi-x1/diagram-round.jpg)

主要文件：

| 文件 | 做什么 |
| --- | --- |
| `game.py` | 主循环：采集 → 姿态 → 手势 / 坐姿 → 状态机 → 渲染；内置 HTTP 服务（`/` 页面、`/stream` MJPEG、`/status` JSON） |
| `gestures.py` | 把关键点变成动作信号（展翅、举手、挥手、侧头、点头……） |
| `posture.py` | 坐姿评分：低头前伸、肩膀歪、身子偏、离屏太近、往下塌；低于 62 判为坐姿差，回合结束重新标定基线 |
| `loop.py` | 状态机 `away → monitor → alert → round → summary`，HP、计分、`save.json` |
| `scenes.py` / `puppet.py` / `overlay.py` / `pixel_ui.py` | 8 个像素场景、数字人、叠层和 UI |
| `hand_tracker.py` | 弹琴屏的手部 21 点 |
| `stats.py` | 温度读取 + NPU 脉冲 |

几个关键参数（都在 `loop.py`）：静坐时 HP 按 `100 / 间隔` 每秒掉；坐姿差额外每秒掉 `100 / 240`（单靠坐姿差约 4 分钟扣光）；人出现约 0.7 秒算在位，离开约 40 秒算离席，离开超过 5 分钟这段久坐清零。

## 常见问题

| 现象 | 先查什么 |
| --- | --- |
| 只有红灯，风扇不转 | 是不是 12V 5A、是不是插在 DC_IN；按一下 POWER |
| `adb devices` 是空的 | TYPE-C 是否插紧、线是不是只能充电、高通驱动装没装 |
| 没有 9008 端口 | 再对 USB 设备执行一次 `adb reboot edl`；还没有就断电重来 |
| QFIL 失败 | Programmer 和 XML 是不是同一个包里的；Device Type 是不是 `ufs` |
| AidLux 初始化卡住 | 先等几分钟；供电是不是 12V 5A |
| ping 不通 / SSH 连不上 | 网线是否在 WAN（插 LAN 会进 `192.168.1.1/24`）；电脑是否同网段；密码是否改过 |
| `:8000` 打不开 | AidLux 是否初始化完；改用 SSH |
| `import aidlite` 失败 | `dpkg -l \| grep aidlite`，按第 5 步用 `aid-pkg` 补装 |
| `VideoCapture(0)` 黑屏 / 打不开 | 0 是 `cam-req-mgr`；UVC 采集一般是 `video2`，先 `v4l2-ctl --list-devices` |
| 720p 只有十几帧 | FourCC 还是 YUYV，先设 MJPG（`probe.py` / `camera.py` 默认已设） |
| `no USB capture node` | 摄像头没插 USB-A，或节点名里没有 webcam / camera / uvc；用 `--index` 指定 |
| 坐姿分乱飘、点在跳 | 只有半个肩膀在画面里；镜头对准上半身 |
| 底栏 NPU 显示 off | 检查 `aidlite-qnn236` 和那个 ctx 文件；玩法不依赖它，可以加 `--no-npu` |
| 弹琴时帧率掉 | 手部是临时加载的第二套模型，属于预期 |
| `ModuleNotFoundError: pose_tracker` | 只拷了单个目录；把整个 `examples` 拷到 `~/rhinopi-lab/` |

<details>
<summary>误跑了 apt upgrade，kmod / libkmod2 版本对不上</summary>

典型报错：

```text
kmod : Depends: libkmod2 (= 29-1ubuntu1) but 29-1ubuntu1.1 is installed
E: Sub-process /usr/bin/dpkg returned an error code (1)
```

原因是厂商包 `mod-blacklist` 占着 `/etc/modprobe.d/blacklist.conf`，新的 `kmod` 覆盖不了，`systemd` / `udev` 往往停在「已解包未配置」。**先不要重启**，只修这一对，不要再全量升级（仓库作者 2026-09-15 在联调板上按这个修好）：

```bash
sudo cp -a /etc/modprobe.d/blacklist.conf /etc/modprobe.d/blacklist.conf.bak
cd /tmp
apt-get download kmod=29-1ubuntu1.1
sudo dpkg -i --force-overwrite /tmp/kmod_29-1ubuntu1.1_arm64.deb
sudo DEBIAN_FRONTEND=noninteractive apt-get --fix-broken install -y \
  -o Dpkg::Options::="--force-confold"
sudo dpkg --audit    # 应无输出
```

`dpkg -i` 可能报 `libkmod2 is not configured yet`，接着跑 `--fix-broken` 即可。社区同款记录：[apt upgrade 修复](https://forum.aidlux.com/t/topic/74814)。

</details>

{/* TODO(author): examples/04_mediapipe/pose_preview.py 目前调用 start_http(hub, "0.0.0.0", args.port)，但 game.py 里 start_http 的签名是 (hub, status, host, port)，Web 模式会报 TypeError（离线已复现）。修好之后可以在第 8 步前加一节「先看 :8091 姿态预览」。 */}
{/* TODO(author): 仓库 docs/05-shadow-puppet.md 写的是「满 20 分钟」「展翅 3 秒」「按中 10 个键」，而代码（game.py / loop.py）是 25 分钟、5 秒、8 个键。本文按代码写，建议同步一下仓库文档。 */}
{/* TODO(author): 可以补一张 Web 桌面登录截图和 C920 预览静图（仓库拍照清单里还缺）。 */}

## 下一步

- 仓库：[peterpanstechland/rhinopi-x1-aidlux](https://github.com/peterpanstechland/rhinopi-x1-aidlux)，按 `docs/01` → `docs/06` 的顺序读，有更细的实测记录和拍照清单
- 模型广场：[aiot.aidlux.com/zh/models](https://aiot.aidlux.com/zh/models)，筛选 `Qualcomm QCS8550`，用板上的 `mms` 拉模型（仓库 `docs/04-modelfarm.md` 撰写中）
- CSI 摄像头：[MIPI CSI](https://rhinopi.docs.aidlux.com/rhino-x1-aidlux/hardware-use/mipi_csi)（仓库 `07_csi_camera` 待写）
- 排错：[AidLux 论坛](https://forum.aidlux.com/)

---

*本指南是边缘设备指南系列的一部分。*
