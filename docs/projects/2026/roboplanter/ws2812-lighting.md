---
title: "WS2812 灯带与氛围交互"
description: "灯带接线、四种模式、HTTP/BLE/CLI 控制与分阶段实机验收。"
sidebar_position: 6
hide_title: true
---

# WS2812 灯带：把陪伴延伸到工位环境

屏幕负责细节，灯带负责余光就能感受到的轻量反馈。XIAO 固件现在提供柔绿常亮、慢呼吸、流动和彩虹四种模式；命令行、HTTP、本地 MCP 和 BLE 使用同一套模式名称。本文是接线与验收教程，**本轮没有给实体板烧录，也没有验证实物颜色、供电和手机端控制**。

灯光是桌面氛围，不是植物健康读数，也不是经过光合标定的生长灯。网页灯珠环和粒子是可交互预览，不连接真实灯带；网页展示的灯珠数量不能当作实际配置。

## 1. 四种模式怎么选

| 模式 | 命令值 | 固件行为 | 适合的使用时刻 |
| --- | --- | --- | --- |
| 柔绿常亮 | `solid` | 保留原有 RGB(0,100,20)；未传模式时使用它 | 安静陪伴，减少变化 |
| 慢呼吸 | `breath` | 4 秒一个明暗周期，端点平滑过渡 | “今天省电生长”的工位氛围 |
| 流动 | `chase` | 绿色光点每 240 ms 前进一颗，带低亮尾迹；仅一颗灯时改为呼吸 | 展示灯带走向和空间感 |
| 低亮彩虹 | `rainbow` | 12 秒一个颜色周期，颜色沿灯带分布 | 短时展示、社媒近景 |

所有模式叠加 `ROBO_LED_BRIGHTNESS` 的编译期亮度限制；没有远程自由调色、速度或亮度接口。上电默认关灯，不保存上次模式。关灯后再用旧的开灯命令，恢复柔绿常亮。Wi-Fi/BLE 断连不会自动关灯，设备继续显示当前模式；需要关闭时重新发送关灯或现场断电。

默认应该安静，动态效果由用户选择。专注完成庆祝、YOYO 自然语言灯效、离线提示和植物状态联动是后续设计，当前没有自动触发。不要把“情绪不好”变成强制灯光，也不要用拒绝互动来惩罚用户。

## 2. 断电接线与供电检查

先完成 [硬件总教程](/docs/projects/2026/roboplanter/hardware-quickstart) 的板型识别、原程序备份和供电检查，按自己实物的丝印核对连接器方向：

1. 灯带必须兼容 **GRB、800 kHz** 单线协议；确认其额定电压。不能只凭“RGB 灯带”商品名判断兼容性。
2. 灯带 **DIN → Robot Board V1.0 的 J7 pin1**，信号来自 GPIO40，经板载缓冲输出。不要接到灯带 DOUT。
3. 灯带 **GND → J7 pin4 / 公共地**。确认灯带额定 5 V、电源及连接器容量足够，才考虑使用 J7 pin3 的 VSYS_5V。
4. 按真实型号、灯数和最坏情况功耗做电流预算；长灯带需要按电气要求独立供电、补电及保护，独立电源仍要共地。不能只靠降低软件亮度弥补供电不合格。
5. 从少量灯珠、较低亮度开始，不连接未经确认的水泵或打印负载。

这里的 pin1 是原理图编号，不是从任意视角看的“最左一脚”。转接线顺序不确定时用万用表核对，不凭线色猜测。

## 3. 配置、构建和手动烧录

复制 `firmware/xiao/include/config.local.example.h` 为同目录的 `config.local.h`，只在这份私有文件中修改配置。替换默认令牌，并让客户端使用同一个令牌；不要把真实令牌写进公开文件、Skill 或截图。

下面是本地配置项说明，灯数必须改为你实际连接的数量：

```cpp
#define ROBO_ENABLE_ACTIONS 1
#define ROBO_ENABLE_LIGHT 1
#define ROBO_LED_COUNT 1       // 示例；按实际数量修改，允许 1–120
#define ROBO_LED_BRIGHTNESS 24 // 0–255，先低亮度验证
#define ROBO_ENABLE_PUMP 0
#define ROBO_ENABLE_PRINTER 0
```

这段不能替代完整示例配置，也没有提供有效令牌。项目默认文件仍关闭所有外设。按 [构建和烧录步骤](/docs/projects/2026/roboplanter/hardware-quickstart) 编译 XIAO 工程，确认目标和配置后由你手动烧录；更新灯数或亮度后须重新构建并烧录。

## 4. 先验证常亮与关灯，再逐项试效果

电脑连接 XIAO 的热点，并按硬件教程设置 `ROBOPLANTER_TOKEN`。以下命令发送真实设备动作，每条新命令生成自己的请求 ID：

```bash
python3 tools/device_cli.py state
python3 tools/device_cli.py light on
python3 tools/device_cli.py light off
python3 tools/device_cli.py light on --effect breath
python3 tools/device_cli.py light on --effect chase
python3 tools/device_cli.py light on --effect rainbow
python3 tools/device_cli.py light off
```

Windows 将 `python3` 换成硬件教程中的 `& $rpPython`；Linux 若使用虚拟环境，换成 `"$rp_python"`。等当前命令回包并观察实物，再发送下一条；不是整段粘贴后声称验收完成。`light off --effect ...` 会在客户端直接拒绝。

状态中应看到 `light.enabled:true`、对应的 `light.on` 和 `light.effect`。关灯时 `effect` 归一为 `solid`。旧固件没有 `effect` 字段、也不认识新命令参数：先升级固件，不自动回退成其他效果。

`completed` 表示软件已完成设置，不是光学传感器确认灯亮；没有亮、颜色不对、闪烁或复位时立即关灯/断电，按 [排障手册](/docs/projects/2026/roboplanter/troubleshooting) 检查。

## 5. HTTP、BLE 和 MCP 的同一契约

HTTP 继续使用 `/api/v1/command` 及 `X-Device-Token` 请求头。例如：

```json
{"request_id":"lamp-01","action":"light","on":true,"effect":"breath"}
```

`effect` 仅在 `on:true` 时可选，严格接受 `solid`、`breath`、`chase`、`rainbow`。省略等价于 `solid`；关灯不带此字段。没有组合动作或额外参数。省略与显式 `solid` 是相同幂等请求；相同 ID 换模式会冲突，不能用新 ID 自动补发一个结果未知的动作。

BLE 保留旧五字段命令，并为开灯提供第六字段：

```text
C|token|id|light|1          柔绿常亮
C|token|id|light|1|breath   慢呼吸
C|token|id|light|1|chase    流动
C|token|id|light|1|rainbow  彩虹
C|token|id|light|0          关灯
S|token|light              回包仍为 L:enabled:on
```

`token` / `id` 是字段说明，不是真实凭据；BLE 的 ID 最多 8 字符，请求总长最多 240 字节。查询格式维持兼容，**BLE 查询不回报模式**；需要模式读回时使用 HTTP `light.effect`。荣耀的长写、通知和凭据注入条件见 [BLE 教程](/docs/projects/2026/roboplanter/ble-integration)。当前已上传 Skill 的硬件门禁仍关闭，不能因为新增固件就宣称 YOYO 已能切换效果。

本地 MCP 的六工具数量不变，`set_light(request_id, on, effect)` 增加可省略的枚举参数。云端 MCP 的所有写操作仍禁用，不能通过本地灯效参数绕过。

## 6. 动画与验收

帧生成在独立低优先级任务中运行，按时间计算动画；发送开关命令不需要等待整个呼吸或彩虹周期结束。灯带输出锁与控制器锁分开，NeoPixel 输出时不占用泵控制器锁。关灯会直接请求清空灯带，不排在完整动画后面；实际延迟仍需实体板测量。

软件测试覆盖模式解析、非法参数、默认模式兼容、同 ID 去重与冲突、各帧颜色上限、单灯退化、关灯、计时回绕。实机还要逐项记录：

- 灯数、颜色顺序、接线照片、固件版本、低亮度下的四种效果视频。
- 动态效果中发送关灯，确认立即熄灭；重新开机默认关闭。
- 断连与重连后实际状态符合本页说明，不冒充收到命令。
- 在已有安全台架条件下验证动画运行时 HTTP/BLE 响应与泵截止时间；不要为测试灯光临时启用未验收水泵。
- 电源、连接器和灯带无异常发热，长时间运行没有复位。

## 7. 一个能拍出记忆点的镜头

人物说“今天电量只剩一点点”，镜头从屏幕小精灵移到桌沿慢呼吸，字幕接“那我们今天省电生长”。切一个流动模式近景，再回到人继续做自己的事。最后一句可以是：“它不催我上进，主要催自己发芽。”

网页录屏标“灯效预览”，完成实体板验证后的实拍才标“WS2812 实机灯效”。保留环境光下的真实亮度，不用后期光圈冒充硬件，也不把彩虹变化叫作植物健康监测。
