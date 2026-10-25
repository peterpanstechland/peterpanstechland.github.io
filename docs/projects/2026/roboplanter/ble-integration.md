---
title: "BLE 完整接入教程"
description: "官方工具参数、设备协议、MTU、凭证注入、回包语义和逐步验收。"
sidebar_position: 8
hide_title: true
---

# XIAO BLE 与 YOYO Skill 对接：从只读链路到动作验收

核对日期：2026-10-25。这里说明当前仓库固件的真实接口，以及荣耀官方 `ble_send_command` 的对接方式；不宣称手机已经验证通过。平台草稿、测试和发布操作见 [荣耀平台教程](/docs/projects/2026/roboplanter/honor-platform)，电气及烧录先完成 [硬件教程](/docs/projects/2026/roboplanter/hardware-quickstart)。

当前 `integrations/yoyo/skill-draft/SKILL.md` 是 **0.2.0、`HARDWARE_READY=false`**：不调用蓝牙，包括查询和停泵。可以验证陪伴对话及如实说明未接通。本文的硬件步骤由开发者在本地调试客户端执行；不能让用户一句“已接好”就解除 Skill 门禁。

## 1. 先把三个层次分清

1. **GATT 写确认**：手机把一段字节交给特征，底层返回写入结果。它不表示鉴权成功，也不表示泵已停。
2. **固件业务回包**：`A:id` 表示受理，`D:id` 表示软件完成，`E:...` 表示错误。必须是本次请求/同一 ID 的回包。
3. **物理结果**：水泵确实停止、灯确实变化、纸上确实打印。这要观察硬件；没有流量/纸张反馈时不能由业务回包推断。

YOYO → 手机官方蓝牙工具 → XIAO BLE 是主链路。Indicator → Wi-Fi HTTP → XIAO 是另一入口，两者共用控制器和幂等缓存。Indicator 不是手机蓝牙中继；荣耀云不能直接访问 XIAO 的 `192.168.4.1`。云 MCP/MQTT 是可选辅助，不能代替这条主链路的验收。

## 2. 固定通道与长度

- 设备名：读取你这台 XIAO 的真实广播名称 `RoboPlanter-...`，保留完整大小写和后缀。不要用旧车名称，也不猜测 MAC。
- Service UUID：`a2f39c10-7e4b-4d21-8a61-0f3bc9d15001`。
- Characteristic UUID：`a2f39c11-7e4b-4d21-8a61-0f3bc9d15001`。
- 特征能力：**Write With Response + Notify**。不提供 Read，不使用 Write Without Response。
- 先订阅同一特征的通知，再写入。每个连接需要自己的订阅。
- 请求是一个完整 ASCII 文本，最多 **240 字节**；每条请求带设备令牌；分隔符是 `|`。不加 `\0`、CR/LF 或 `$` 结尾。
- BLE 动作 ID 为 **1–8 个 ASCII 字母、数字、`_`、`-`**。HTTP 可达 32 字符；HTTP 的 32 字符随机 ID 不能原封不动写入 BLE 动作字段。
- 固件偏好 MTU=247，但最终 MTU 由手机/系统协商。回复始终是单条不超过 **20 字节**的通知，客户端不应拼接旧通知猜测结果。
- 只允许一个 BLE 命令连接。测试应用占着连接时，YOYO 可能连不上；测试完主动断开，再测试下一客户端。

请求长度是**编码后的字节数**，不是编辑器里的“字符数”。仅最短 16 字符令牌，`S|令牌|uv` 已 21 字节，`soil` 是 23 字节，含 8 字符 ID 的两秒浇水是 38 字节。因此默认 ATT MTU=23 的 20 字节载荷不足。

手机必须成功协商更大 MTU，或者经其蓝牙栈完成 ATT prepare/execute 长写。**不能把文本自行拆成几个普通 Write**，不能缩短/截断令牌，也不能把续段当第二条命令。固件已实现有界、连接归属校验的 ATT 长写处理；这不证明某一版本的荣耀工具支持它。

可在本机离线验证长度（合成令牌不对应任何设备，不联网）：

```powershell
# Windows：在硬件教程的环境变量 rpPython 已设置后执行
@'
token = "T" * 16
frames = ["S|" + token + "|uv", "S|" + token + "|soil", "C|" + token + "|abcd1234|water|2000"]
print([len(s.encode("ascii")) for s in frames])
'@ | & $rpPython -
```

```bash
"$rp_python" -c 'token="T"*16; frames=["S|"+token+"|uv","S|"+token+"|soil","C|"+token+"|abcd1234|water|2000"]; print([len(s.encode("ascii")) for s in frames])'
```

期望 `[21, 23, 38]`。最长合法令牌 64 字符及 160 字节打印文本还要核对总长≤240；不能只检查打印字段长度。

## 3. 开始前的本地检查

依次确认：

1. 负载电源断开，泵/灯/打印未启用。XIAO 正在运行本仓库固件，不是附件原车例程。
2. 通过 USB 串口和 HTTP 确认真实设备名称、`schema_version:1`、全部执行器 `enabled:false`。HTTP 只读先通过，减少把接线问题与手机传输问题混在一起的概率。
3. 手机打开蓝牙并授予系统要求的蓝牙/附近设备权限。具体权限名称随系统版本变化；不要假设一个固定菜单。
4. 用可信的本地 BLE/GATT 调试客户端扫描，只选择刚核实的设备，展开上述 Service 和 Characteristic；记录是否存在 Write 和 Notify。
5. 订阅 Notify，选择**带响应的写入**及 ASCII/UTF-8 文本模式；先发送一次 `S|<本机令牌>|pump`。尖括号表示你本地替换的内容，不是协议字节，不是平台变量语法。
6. 请求超过 20 字节时，记录调试客户端显示的协商 MTU或长写方式。没有证据就记为“未确认”，不能仅凭工具界面显示已发送来勾选通过。

本地调试可以用默认禁用配置的公开默认令牌验证第一条只读请求；换成自己的非默认令牌后必须再次验证完整请求。真实令牌只在可信本地客户端中输入，不放到公开平台代码、聊天、录屏或报告。

预期泵查询回复为 `P:0:0:0`；分别查询 `soil`、`env`、`light`、`printer`。全禁用状态常见回复为 `S:x:x:0:0`、`E:x:x:0`、`L:0:0`、`T:0:off`。这些是**协议示例**，不是本机实测值。全禁用时不需要水泵接线也能测试。

成功判据：每次写入后收到一条符合该查询类型的完整通知；没有遗漏字段、截断或串入上一条通知。再断开/重连，重新订阅通知并复查。断连不会停止已经受理的泵动作，它仍由本地截止任务控制。

### 本地只读异常测试

在仍关闭执行器的条件下执行：

- 错令牌：应收到 `E:AUTH`，不能返回传感器数据。
- 未知查询字段：有效鉴权后应收到 `E:FIELD`。
- 不订阅通知：不能把写成功当作得到业务结果；重新订阅后再测试。
- 断连并重连：旧连接中排队/部分长写内容不能变成新连接动作。
- 请求字节数超限：不应执行；记录实际 `E:SIZE` 或长写格式错误，及客户端是否在写入前已拒绝。

不要在测试中用旧车的 `forward`/`stop`/`dance` 命令；它们不是盆栽协议。

## 4. 当前查询和回包的完整契约

下面 `token` 是说明中的字段名，不是有效凭据，也不是可用的 APIKey 注入变量。

```text
S|token|soil       -> S:raw:percent:valid:calibrated
S|token|air        -> A:raw:valid
S|token|uv         -> U:raw:valid
S|token|env        -> E:temperature:humidity:valid
S|token|pump       -> P:enabled:on:remaining_ms
S|token|light      -> L:enabled:on
S|token|printer    -> T:enabled:status
S|token           -> Q:soil,pump,air,uv
R|token|id        -> A:id / D:id / E:id:code
```

- `x` 表示不可用；不能补成 0。土壤 `valid=1` 且 `calibrated=1` 才报告百分比。
- `air` / `uv` 是原始 ADC，不是气体浓度、空气质量结论、lux 或植物缺光判断。
- 环境 `E:x:x:0` 是无效温湿度。其他 `E:` 开头可能是错误，解析必须结合**本次查询类型与完整格式**。
- `E:STALE` 表示传感器采样已超过 3 秒，不把旧值说成“现在”。多次逐项查询不是原子快照。
- `printer.status` 为 `off`、`idle`、`queued`、`sent`、`fail`。`sent` 仅软件 UART 发送完成。
- 空气查询的 `A:raw:valid` 与动作受理的 `A:id` 不同；不能只看首字符 `A` 就说浇水成功。
- `R` 仅查询缓存，不重新执行动作。`MISS` 表示本次启动缓存里没有该 ID，不证明动作没发生。

## 5. 对接荣耀官方工具

2026-10-25 已在浏览器核对[荣耀官方蓝牙设备接入案例](https://developer.honor.com/cn/doc/guides/101781)。本项目必须显式覆盖官方通用默认值：

- `device_name`：真实广播名称原文。`device_address` 可选；只填写实际验证过的地址，不凭印象生成。
- `service_uuid` / `characteristic_uuid`：使用第 2 节的完整 UUID，不采用示例 `FFE0/FFE1`。
- `encoding`：`utf-8`；当前业务协议限定 ASCII。
- `ack_type`：`ack`。官方定义这是 Write With Response，与业务回包等待独立。
- `expect_response`：`true`。必须取得设备业务响应。
- `response_timeout_ms`：先用 `3000`；官方范围为 100–60000 ms。加长超时不能修复请求被截断或没有通知订阅。
- `command_array`：每次只有一个 `{command, delay_ms:0}`；即使只有一条仍必须是对象数组。按回包串行调下一次，不批量排浇水/停泵。

仅用于核对字段形状的模板如下，**不可直接执行**。本教程没有规定任何令牌变量展开语法；必须先解决下文的安全注入问题。

```json
{
  "device_name": "<本机真实广播名称>",
  "service_uuid": "a2f39c10-7e4b-4d21-8a61-0f3bc9d15001",
  "characteristic_uuid": "a2f39c11-7e4b-4d21-8a61-0f3bc9d15001",
  "encoding": "utf-8",
  "ack_type": "ack",
  "expect_response": true,
  "response_timeout_ms": 3000,
  "command_array": [
    {"command": "<可信本地组件构造的完整查询帧>", "delay_ms": 0}
  ]
}
```

官方页当前有一处不一致：输出表/错误码表写 `0` 成功，JSON Schema 写 `200` 成功。记录真机实际返回及系统版本；**无论工具层代码是哪一个，都必须继续核对 `response` 中的业务回包**。不能把页面矛盾通过“所有非错误都当成功”抹平。

官方常见工具错误为 1001 设备未找到、1002 连接失败、1003 已断开、1004 特征不存在、1005 不支持写入、1006 发送超时、1007 响应超时、1008 编码错误。它们是手机工具错误，不是下一节的固件业务错误。

### 必须完成的两项平台核实

1. **凭据安全注入**：确认官方支持何种方式让可信组件把设备令牌加入每条请求，且令牌不进入 Skill 正文、对话、公开日志和录屏。当前仓库没有经过验证的变量注入语法。配置 APIKey 不自动证明能在 `command` 字符串里安全替换。不能删除 XIAO 鉴权、改成公开固定真令牌或试着猜变量来绕过。
2. **手机完整传输**：用当前手机、MagicOS、YOYO/工具版本实测带真实长度令牌的查询完整到达、正确订阅通知并返回。官方文档没有给出 MTU 自动协商、ATT 长写或跨调用保持连接的明确保证；桌面/其他手机 BLE 客户端成功不能代替荣耀工具成功。

这两项未通过，就保持 `HARDWARE_READY=false`。继续完成本地硬件教程、对话验收和离线协议检查，报告实际阻塞点；不把“草稿能安装”写成“YOYO 已控制花盆”。

## 6. 动作开启后的单步验收

只能在硬件教程已经完成电平/供电/本地限时验证、且平台两项条件已实测通过后，修订 Skill 版本并开放相应能力。先灯，再 ASCII 打印，最后短时水泵；仅开放实物已接好并验收的能力。

完整动作格式：

```text
C|token|id|light|1       柔绿常亮
C|token|id|light|1|breath 慢呼吸（也可 solid / chase / rainbow）
C|token|id|light|0       关灯
C|token|id|print|text    ASCII 打印
C|token|id|water|500     单次 500 ms 泵脉冲
C|token|id|stop_water    立即请求停泵
```

灯效为开灯时可选的第六字段；关灯不能带该字段，省略模式默认 `solid`。灯查询仍只返回 `L:enabled:on`，不增加字段；模式读回使用 HTTP `light.effect`。省略与显式 `solid` 是同一幂等内容。详见 [WS2812 教程](/docs/projects/2026/roboplanter/ws2812-lighting)。

每次**新的用户动作意图**分配新 ID。轮询结果使用原 ID；不能把新的 ID 当作处理超时的方法。同 ID 同内容返回保存结果而不再次执行；同 ID 不同内容返回 `ID`。水泵和打印机互斥，忙时也会记住拒绝结果，解决忙碌后若用户明确发起新意图才分配新 ID。

1. **灯**：先 `S|token|light` 确认 enabled=1。用户明确开灯 → 一条 `C` → 匹配 `D:id` → 再查灯状态 → 实看灯。验证重复同 ID 不出现额外动作。
2. **打印**：明确授权短 ASCII 文本 → 收到 `A:id` → 用 `R|token|id` 查询。`D:id` 后人工确认出纸。中文聊天不受限制，但当前硬件打印文本不支持中文或 ESC/POS 控制码。
3. **水泵**：台架容器与物理断电就绪、短脉冲上限已配好 → 明确 500 ms 指令 → `A:id` → 原 ID 查询直到结果有界结束 → 实测自动停止。默认泵上限 3000 ms，实际以该次固件 `ROBO_MAX_WATER_MS` 为准，不能拆多次绕过上限。
4. **停泵**：单独的新 ID 和 `stop_water`，最高优先发送，不等传感器/结果查询。固件允许已鉴权的停泵在动作禁用或缓存满时使用，但客户端仍须具备可用连接。停泵结果未知时立即提示现场物理断电/检查，不能说已停。

不在一组 `command_array` 排“开泵 → 等几秒 → 停泵”作为限时保护。手机断连、工具崩溃或后台限制都会破坏这种设计；真正的截止控制在 XIAO 本地任务。

## 7. 结果未知、错误与重启

正常生命周期：

```text
明确用户意图 -> 新 ID -> 一次 C 请求
                         ├─ A:id -> 查询同一 ID -> D:id / E:id:code
                         ├─ D:id -> 软件完成
                         └─ 超时/断线 -> 结果未知 -> 查原 ID / 现场检查
```

固件常用业务码：

```text
AUTH  鉴权失败             LOCK  动作总开关/非默认令牌条件未满足
OFF   外设未启用           BUSY  泵或打印忙 / 队列无法立即接收
ID    相同 ID 但内容不同    FULL  本次启动的幂等缓存已满
TIME  时长不合法           IO    UART 发送失败
ARG   参数/格式不合法      ACT   未知动作（以固件实际回包为准）
MISS  结果记录不存在       SIZE  请求/回复超限
FIELD 查询字段不存在      STALE 传感器采样过期
```

固件只有 **64 条 RAM 缓存**，本次启动不淘汰，满后普通新动作拒绝；重启后缓存丢失。重启前先停止并现场确认负载安全。重启后不能自动重放之前未知的浇水/打印；没有 `MISS` 就能“放心再来一次”的保证。BLE 没有独立的 uptime 查询，必要时结合本地 HTTP 的 `uptime_ms` 和串口确认是否重启；不能从重连成功推断设备没有重启。

控制器的一条旧 `last_command` 可能被另一入口覆盖，因此应查 `R` / HTTP `/api/v1/result`。收到 `A:id` 时只说“已受理/处理中”，不无限轮询、不承诺后台持续操作；超出本轮有界等待后如实报告未知。

## 8. 连接边界与已知安全限制

- 已接受的泵动作在断连后继续按本地截止时间完成；断连不是撤销。
- 固件用连接 ID 加代际标识约束队列和长写，旧会话不能向新会话提交命令或收到旧回复。
- 没有 BLE 配对/加密策略。令牌防止不知道令牌的普通调用，但不抵抗处于合适位置的无线观察者；用于受控现场，泄露后换令牌并重新刷写。
- Arduino 2.0.17 底层在应用事件钩子之前积累 ATT prepared-write 缓冲，应用无法通过公开 API 清除/限长。当前代码防止残余数据成为业务命令，但不宣称能抵抗恶意反复 prepare write 的堆耗尽攻击。部署到不可信环境前需要库级修复或替换并重新评审。
- NFC 仅用于进入入口/选择设备；触碰 NFC、传感器低读数或情绪表达不能自动授权浇水、打印或复合动作。
- 当前 BLE 没有照片上传、主题切换、远程番茄钟、植物图像识别等命令。

## 9. 需要留下的最小测试证据

对每台自备设备记录手机型号、MagicOS/YOYO/工具版本、XIAO 固件提交和配置能力、日期、客户端、请求**类型与字节数**、MTU/长写证据、工具层返回、业务回包、实物观察、结论。令牌、设备完整地址和个人账号标识应遮蔽；原始私密材料留在本地。

至少覆盖：禁用状态、正确/错误鉴权、完整长请求、通知订阅、断连重连、结果关联、同 ID 重复/冲突、超时不重发、灯实物、打印实物、泵自动停止与主动停止、手机不可用时的现场处置。只通过对话、页面保存或安全检测不能替代这些项目。

来源：[固件 BLE 说明](/roboplanter/source/firmware/xiao/README.md.txt)、[实际 BLE 处理代码](/roboplanter/source/firmware/xiao/src/main.cpp.txt)、[连接隔离代码](/roboplanter/source/firmware/xiao/include/ble_session.h.txt)、[设备协议](/roboplanter/source/docs/device-protocol.md.txt)、[Skill 契约](/roboplanter/source/integrations/yoyo/skill-draft/references/ble-contract.md.txt)、[荣耀官方蓝牙工具](https://developer.honor.com/cn/doc/guides/101781)。
