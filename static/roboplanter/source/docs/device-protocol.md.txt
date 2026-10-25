# RoboPlanter 设备通信协议

## 两板连接

首版由 XIAO 建立 2.4 GHz Wi-Fi 热点，SenseCAP Indicator 连接该热点。XIAO 默认地址为 `192.168.4.1`；两块板分别供电，不连接 TX/RX、I²C 或 USB 数据线。YOYO 独立 Skill 的目标路径是手机官方 BLE 工具直连 XIAO；Indicator 使用 HTTP。两种入口最终调用同一个本地设备控制逻辑。

默认热点密码 `planter-demo` 和设备令牌 `change-me-before-use` 仅用于初始只读联调。启用执行器前须在两端本地配置中设置同一个非默认设备令牌。项目不保存真实 Wi-Fi 密码和令牌到 Git。

## YOYO 调用入口

主交互路径为 **YOYO 独立 Skill → 官方 `ble_send_command` → XIAO BLE**；Skill 草稿位于 [integrations/yoyo/skill-draft](../integrations/yoyo/skill-draft/README.md)，0.2.0已导入并保存平台草稿。设备令牌的安全注入方式及手机工具的长写能力未验证，当前 Skill 不发送硬件命令。不能将令牌写入 Skill 正文或假定平台会替换未经文档确认的变量。

Indicator 独立使用下述 HTTP 协议。已有 [MCP 桥接](../integrations/mcp/README.md) 和 [云 MCP/MQTT 网关](../integrations/cloud/README.md) 保留为辅助接入，均不是独立 Skill 主线的前置条件；A2A 不需要。MCP 的六个工具将请求映射到同一 HTTP 接口，服务端从环境读取固定地址与令牌。荣耀云不能直接访问 XIAO 热点地址；目前云网关未接通，云端所有写操作（包括停泵）均禁用。详情见 [YOYO 接入说明](../integrations/yoyo/README.md)。

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
| `environment.temperature_c`、`humidity_pct`、`valid` | 可选 SHT31 的温湿度和有效性 |
| `pump.enabled`、`on`、`remaining_ms` | 泵功能是否启用、当前状态和剩余时间 |
| `light.enabled`、`on` | 灯带功能和状态 |
| `printer.enabled`、`status` | 打印功能与软件发送状态 |
| `last_command.request_id`、`status`、`error` | 最近命令的关联标识、结果及错误 |

未启用的数值返回 `null`，不能用零值替代。采样失效时可保留原始 ADC 供诊断，但客户端必须依据 `valid` 和采样年龄判断；未标定的湿度百分比为 `null`。打印机串口发送完成只代表字节交给串口，不代表纸张实际打印完成；实际纸尽、过热和完成反馈需按打印机型号增加。

操作示例：

```json
{"request_id":"demo-water-001","action":"water","duration_ms":1000}
```

| action | 参数 | 语义 |
| --- | --- | --- |
| `water` | `duration_ms` 正整数 | 启动一次有本地时间上限的浇水；不是毫升数 |
| `stop_water` | 无 | 停止泵 |
| `light` | `on` 布尔值 | 灯带开关 |
| `print` | `text` 字符串 | 将支持的文本加入打印任务；首版编码见固件说明 |

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
python tools/device_cli.py print 'Hello planter'
```

该工具发送真实设备命令；外设未完成接线与配置前只使用 `state`。泵停止和超时控制由 XIAO 本地负责，不能依赖这台电脑或 Indicator 的下一次请求。

## BLE

保留附件的服务 UUID `a2f39c10-7e4b-4d21-8a61-0f3bc9d15001`，特征 UUID `a2f39c11-7e4b-4d21-8a61-0f3bc9d15001`。具体短文本格式、长度和回包规则见 [XIAO 固件说明](../firmware/xiao/README.md#ble-protocol-version-1)。BLE 写确认与设备业务回包分开处理；YOYO 查询需启用等待响应。

带最短 16 字符令牌的 UV 查询已为 21 字节，超过默认 ATT MTU 23 下的 20 字节载荷。固件的长写处理与连接归属校验已编译和通过核心测试；荣耀工具是否协商足够 MTU、支持完整长写并返回完整业务响应，仍须手机真机验证。查询成功也不构成浇水授权。独立 Skill 当前只准备草稿，不因固件编译通过而启用硬件调用。
