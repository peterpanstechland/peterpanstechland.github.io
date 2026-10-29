# RoboPlanter 设备通信协议

## 两板连接

首版由 XIAO 建立 2.4 GHz Wi-Fi 热点，SenseCAP Indicator 连接该热点。XIAO 默认地址为 `192.168.4.1`；两块板分别供电，不连接 TX/RX、I²C 或 USB 数据线。YOYO 独立 Skill 的目标路径是手机官方 BLE 工具直连 XIAO；Indicator 使用 HTTP。两种入口最终调用同一个本地设备控制逻辑。

默认热点密码 `planter-demo` 和设备令牌 `change-me-before-use` 仅用于初始只读联调。启用执行器前须在两端本地配置中设置同一个非默认设备令牌。项目不保存真实 Wi-Fi 密码和令牌到 Git。

另有显式开启的同局域网模式：XIAO 设置 `ROBO_WIFI_STA=1`，两板接入同一实际 2.4GHz 路由器，Indicator 配置 XIAO 的实际 DHCP 地址。两板仍经 HTTP 通信；没有额外接线，也没有在本轮加入 ESP-NOW 或原生 MQTT。电脑可以保留上网连接，后续使用既有 MQTT 网关时无需另接 XIAO 热点。

## YOYO 调用入口

主交互路径为 **YOYO 独立 Skill → 官方 `ble_send_command` → XIAO BLE**；当前0.4.0使用SC+MITM加密绑定和V协议，Skill正文不含HTTP令牌。手机实时土壤、温度和湿度查询已验证。旧0.2.x单次读取接口仅保留作历史说明；当前能力与真机边界见[YOYO日常交互](handbook/yoyo-companion.md)。

Indicator 独立使用下述 HTTP 协议。已有 [MCP 桥接](../integrations/mcp/README.md) 和 [云 MCP/MQTT 网关](../integrations/cloud/README.md) 保留为辅助接入，均不是独立 Skill 主线的前置条件；A2A 不需要。MCP 的六个工具将请求映射到同一 HTTP 接口，服务端从环境读取固定地址与令牌。2026-10-26 已经通过电脑上的只读网关，实测公网 MCP → MQTT → XIAO → Indicator 土壤查询；电脑或网关停止时链路不可用，尚非持续遥测入库。云端所有写操作（包括停泵）仍禁用。详情见 [YOYO 接入说明](../integrations/yoyo/README.md)。

## HTTP

所有请求使用 `X-Device-Token` 请求头。`GET /api/v1/state` 返回设备状态；`POST /api/v1/command` 接收 JSON 操作；`GET /api/v1/result?request_id=<id>` 查询某次操作的结果。协议版本为 `schema_version: 1`。

状态包含：

| 字段 | 含义 |
| --- | --- |
| `device_id`、`uptime_ms` | 设备标识、本次启动时长 |
| `sample_age_ms` | 距最近一次采样周期的时间，客户端仍需检查各传感器的 `valid` |
| `soil.raw`、`soil.percent`、`soil.valid`、`soil.calibrated` | 原始 ADC、标定后的相对湿度和有效性；未标定不提供百分比 |
| `air.raw`、`air.valid` | 空气质量模块原始值；不是 CO₂ 或 PM2.5 浓度 |
| `uv.raw`、`uv.valid` | UV 模块原始值；不是可见光照度或 PAR |
| `ambient_light.enabled`、`raw`、`valid` | 可选 Grove Light v1.2 的环境光 ADC，0–4095、越亮越大；不是lux，与UV和灯带控制分别表示 |
| `environment.temperature_c`、`humidity_pct`、`valid` | 可选 DHT20 / SHT31 的温湿度和有效性 |
| `pump.enabled`、`on`、`remaining_ms` | 泵功能是否启用、当前状态和剩余时间 |
| `light.enabled`、`on`、`effect` | 灯带功能、目标开关及模式；关灯时模式为 `solid` |
| `auto_light` | 自动开关配置、NVS可写状态、手动暂停与环境光过期标记，见下文 |
| `printer.enabled`、`status` | 打印功能与软件发送状态：disabled / idle / queued / bytes_sent / recovery_required |
| `printer.text_format`、`paper_width_dots`、`autocut`、`feedback` | 新固件为 utf8-raster、384、切刀配置布尔值、unavailable；旧固件可能缺省 |
| `printer.layout` | `receipt32-v2` 表示 32 点阵字、44 点行高、居中首行布局；旧固件缺省，不能据此显示新布局的精确预览 |
| `last_command.request_id`、`status`、`error` | 最近命令的关联标识、结果及错误 |

未启用的数值返回 `null`，不能用零值替代。采样失效时可保留原始 ADC 供诊断，但客户端必须依据 `valid` 和采样年龄判断；未标定的湿度百分比为 `null`。打印机串口发送完成只代表字节交给串口，不代表纸张实际打印完成；实际纸尽、过热和完成反馈需按打印机型号增加。发送中断时本次结果为 `printer_write_failed`，状态进入 `recovery_required` 并拒绝新打印（`printer_recovery_required`）。检查后重启打印机与主控清除残留，不自动重放旧任务。详见 [打印教程](handbook/uart-printer.md)。

### 传感器校准

`GET /api/v1/state` 额外返回 `calibration`：`schema:1`、`revision`、`writable`、`error`，以及 `dry`、`wet`、`full_mm`、`empty_mm`、`stop_mm`。未设参考值为 `-1`。它与 `soil.calibrated` / `water_tank.calibrated` 一同供客户端显示；不能仅因收到数值便认定已经标定。

`POST /api/v1/calibration` 使用相同 `X-Device-Token` 鉴权和JSON类型，请求体不超过512字节。以下仅为格式示例，勿将示例数字写入实际设备：

```json
{"kind":"soil","revision":0,"reset":false,"dry":3000,"wet":1500}
{"kind":"tank","revision":1,"reset":false,"full_mm":40,"empty_mm":300,"stop_mm":260}
{"kind":"tank","revision":2,"reset":true}
```

每次读取最新修订号再提交；一次请求只修改一组，清除请求不能携带参考值。禁止多余字段、错误类型、负修订号。土壤值须0–4095、差至少64；水箱须20–3500mm，满水 < 停泵 < 空箱且各差至少10mm。界面先采五份稳定新数据，接口负责范围/顺序、版本和持久化校验，不能由数字校验证明用户实际放置正确。

成功写入NVS并读回后返回 `200 {"ok":true,"revision":新修订号}`。修订冲突返回409 `calibration_conflict`；运行中泵拒绝保存为409 `pump_busy`；存储失败503 `calibration_save_failed` 并将运行时参考值置为未标定，避免重启前后保护不一致。保存不启动任何执行器。保存期间新浇水返回 `calibration_busy`；原有停泵任务仍可运行。网络响应丢失不自动重发，客户端通过后续状态的修订号和相同参考值确认结果。

记录以单条带版本/校验值的NVS blob保存，正常断电和应用分区更新保留。损坏记录保持未标定；明确清除后的记录不会回退到编译期值。具体操作见[屏幕校准教程](handbook/sensor-calibration.md)。

### 环境光自动开关配置

状态中的 `auto_light` 包含 `schema:1`、`available`、`writable`、`error`、`revision`、`enabled`、`on_below`、`off_above`、`paused`、`sensor_stale`。没有此对象的旧固件不能通过Indicator配置自动灯光。

`POST /api/v1/auto-light` 使用相同设备鉴权和JSON类型，最多512字节，必须恰有以下四个字段：

```json
{"revision":0,"enabled":true,"on_below":1200,"off_above":1800}
```

先读取最新修订号。阈值必须为0–4095的整数，`off_above - on_below ≥ 64`；不接受额外字段或浮点数。成功保存单条带校验值的NVS记录并读回后返回 `200 {"ok":true,"revision":新修订号}`。过期版本返回409 `settings_conflict`，泵运行或其他设置写入期间返回409 `settings_busy`。存储失败返回503 `auto_light_save_failed`，自动模式关闭并关灯。未知结果不重发，通过后续状态的修订号和配置值核对。

保存期间新浇水和手动灯光命令被 `light_settings_busy` 拒绝；停止浇水仍可用。自动模式每秒使用环境光采样，连续三份合格数据且至少两秒后切换；中间区间保持当前开关。无效或超过三秒未更新的自动采样使灯关闭。手动灯光命令暂停自动模式；保存设置或重启恢复已保存的自动模式。关闭自动模式只停止自动判断，不改变当时灯带状态。详见[灯光设置操作](handbook/ws2812-lighting.md)。

### 可选的 Indicator 土壤上传

仅当 XIAO 设置 `ROBO_ENABLE_REMOTE_SOIL=1` 时，开放 `POST /api/v1/sensors/soil`。使用相同 `X-Device-Token` 鉴权，Content-Type 为 `application/json`，请求体至多 512 字节，且必须恰有五个字段。例如下例是协议格式示意，不是真实读数：

```json
{"v":1,"source_boot":"0123abcd","seq":1,"raw":2500,"age_ms":100}
```

`source_boot` 为 Indicator ESP32 每次启动生成的 8 位小写十六进制标识，`seq` 是本次启动的新采样序号，`raw` 为 0–4095 的 ADC12 原始值。上传时采样年龄必须不超过 1500ms；XIAO 再计入保守的 1500ms HTTP 传输预算，合计超过 3000ms 即标记失效。同一来源不递增的序号返回 HTTP 409，不续期；合法新样本返回 HTTP 200 和 `accepted:true`。该接口只更新读数，不触发执行器。

启用后状态额外包含 `soil.source="indicator_rp2040_grove_adc"` 和 `soil.sample_age_ms`。客户端必须同时检查 `soil.valid`，不能只用顶层采样循环年龄判断此远端读数。未校准仍为 `calibrated:false`、`percent:null`。RP2040 使用独立的挑战应答与 CRC16 串口程序，参见 [Indicator 固件说明](../firmware/indicator/README.md)。

操作示例：

```json
{"request_id":"demo-water-001","action":"water","duration_ms":1000}
```

| action | 参数 | 语义 |
| --- | --- | --- |
| `water` | `duration_ms` 正整数 | 启动一次有本地时间上限的浇水；不是毫升数 |
| `stop_water` | 无 | 停止泵 |
| `light` | `on` 布尔值；开灯可选 `effect` | `solid` / `breath` / `chase` / `rainbow`，省略为 `solid`；关灯禁止传 `effect` |
| `print` | `text` 字符串 | UTF-8 最多 160 字节，ASCII/GB2312 字库字符与 LF，自动换行最多 8 行；禁止外部控制指令 |

灯效命令示例：`{"request_id":"lamp-01","action":"light","on":true,"effect":"breath"}`。同 ID 的省略模式与显式 `solid` 视为相同请求；换成其他模式则冲突。动画在后台持续运行，`completed` 只确认软件完成设置，不证明实物发光或后续每一帧正常。详见 [WS2812 教程](handbook/ws2812-lighting.md)。

响应结构为 `{"ok":true,"request_id":"...","status":"accepted","error":""}`。`accepted` 表示开始处理；`completed` 表示软件任务完成；`rejected` 表示拒绝或软件执行失败，细节见 `error`。`last_command` 会被其他入口覆盖，客户端可用 `/api/v1/result` 按 ID 查询：命中返回 HTTP 200 与上述结果结构，未命中返回 HTTP 404 和 `request_not_found`。未命中可能因设备重启，不能推断操作没发生。

操作 ID 为 1–32 个 ASCII 字母、数字、连字符或下划线。同一 ID、相同内容在设备保留的幂等记录内不重复执行；同一 ID、不同内容拒绝。记录不作为跨重启的永久保证，客户端不能在不确定结果时自动生成新 ID 重试浇水或打印。Indicator 每次用户操作使用新 ID，网络失败只刷新状态，不自动重发动作。

## 命令行联调

电脑连上 XIAO 热点后运行：

```powershell
$env:ROBOPLANTER_TOKEN = '<与固件一致的设备令牌>'
python tools/device_cli.py state
python tools/device_cli.py water 1000
python tools/device_cli.py result '<刚才输出的 request_id>'
python tools/device_cli.py stop_water
python tools/device_cli.py light on
python tools/device_cli.py light on --effect breath
python tools/device_cli.py light off
python tools/device_cli.py print 'Hello planter'
```

该工具发送真实设备命令；外设未完成接线与配置前只使用 `state`。泵停止和超时控制由 XIAO 本地负责，不能依赖这台电脑或 Indicator 的下一次请求。

## BLE

当前YOYO 0.4.0开启ROBO_ENABLE_BONDED_YOYO后，使用加密配对的V协议，不携带HTTP令牌。完整新查询、共享计时、场景打印及结果解释见[BLE v2教程](handbook/ble-integration.md)。以下token与单次读取格式是未启用绑定模式时的历史调试接口，不是当前Skill回退方案。

保留附件的服务 UUID `a2f39c10-7e4b-4d21-8a61-0f3bc9d15001`，特征 UUID `a2f39c11-7e4b-4d21-8a61-0f3bc9d15001`。具体短文本格式、长度和回包规则见 [XIAO 固件说明](../firmware/xiao/README.md#ble-protocol-version-1)。BLE 写确认与设备业务回包分开处理；YOYO 查询需启用等待响应。

带最短 16 字符令牌的 UV 查询已为 21 字节，超过默认 ATT MTU 23 下的 20 字节载荷。固件的长写处理与连接归属校验已编译和通过核心测试；荣耀工具是否协商足够 MTU、支持完整长写并返回完整业务响应，仍须手机真机验证。短请求的单次查询成功也不能证明长写兼容或构成浇水授权。

### 可选的单次土壤读取会话

`ROBO_ENABLE_DIAGNOSTIC_READ=1` 才编译此功能，默认关闭。它为私有真机联调提供一个独立、RAM 内保存、最多使用一次的临时凭据，避免把正式设备令牌放入 Skill。并不解决正式产品的凭据下发问题。

管理端以正式 `X-Device-Token` 调用 `POST /api/v1/diagnostic-session`，JSON 为 `{"token":"<16位小写十六进制临时值>","ttl_ms":600000}`；时限范围 1000–600000ms。`{"disable":true}` 立即撤销。临时值不能授权 HTTP 状态查询、会话管理、普通 BLE 查询或执行器命令。

手机仅发送 UTF-8 `Q|<临时值>`（共18字节，适配默认20字节 ATT 载荷），等待业务回包。首次正确请求先消耗凭据，再返回现有 `S:<raw>:<percent或x>:<valid>:<calibrated>` 土壤格式。错误、已使用、过期或撤销的凭据返回 `E:AUTH`；重启同样清除会话。客户端不能自动重试或把 `x` 当成湿度百分比。

2026-10-26 已在 XIAO 真机验证单次返回 `S:2522:x:1:0`、重复拒绝、到期拒绝、撤销拒绝及执行器权限隔离。私有0.2.2经用户明确授权提交荣耀私有测试后，用户现场确认 Robot Phone 读到2529；未额外采集手机 NOTIFY 原始日志。随后主动撤销会话，设备确认 `disabled:true`。公开源码和公开0.2.1包不含该临时值；该次测试不等于正式长期凭据机制已完成。

## Structured daily ticket (local HTTP)

`printer.daily_layout="garden-daily-v2"` advertises the shared 384 × 1536-dot daily template and verified 128-row raster transport. `print_daily` accepts **only** `request_id`, `action`, and a `daily` object with all eight integer fields below. Booleans, omitted fields, extra fields and out-of-range values are rejected before printing.

```json
{"request_id":"daily-example-1","action":"print_daily","daily":{"card":17,"reversed":0,"english":0,"species":0,"soil":-9999,"raw":-9999,"temperature":-9999,"humidity":-9999}}
```

- `card`: 0–77; 0–21 major arcana; then Wands, Cups, Swords, Pentacles, each Ace–Ten, Page, Knight, Queen, King.
- `reversed`, `english`: 0 or 1. `species`: 0 Mint, 1 Basil, 2 Rose, 3 Succulent; this is the user's garden selection, not automatic plant recognition.
- `soil`: calibrated percent 0–100; `raw`: ADC 0–4095; `temperature`: tenths °C −400–850; `humidity`: percent 0–100. Each uses **−9999** for unavailable. Indicator freezes fresh readings when opening the preview, never substitutes game statistics or zero for missing data.

The request is a client-supplied snapshot; it does not authorize watering. The preview, RTOS queue and dedupe cache retain the complete snapshot, including the draw and orientation. Conflicting contents under one ID are rejected. Existing printer enable/token/pump interlocks, cache exhaustion and partial-write recovery latch apply. A 73,832-byte maximum daily job takes a bounded UART budget (81,909ms at 9600 baud, including 5s margin); Indicator allows 100s for resolution. No automatic reprint or mechanical-success claim.

Authenticated `{"request_id":"scale-test-1","action":"print_calibration"}` prints a diagnostic with matching 128-dot squares/circles using A: 32-row and B: 128-row command bands. No other action fields are accepted. This diagnostic deliberately retains A's defective mode for comparison; production tickets use B. Both new actions are local HTTP only; BLE and the existing cloud/MCP whitelist are unchanged.
