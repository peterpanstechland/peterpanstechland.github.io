# RoboPlanter BLE v1 接入契约

供开发和验收；0.2.1 的正式读数与动作门禁仍关闭，不得照下表试发。根文件唯一例外是用户明确请求的固定 `S|probe|soil` 联通诊断，预期 `E:AUTH`，不获取读数或开放权限。下文token/id是协议字段名，不是平台变量或可执行占位符。未验证安全鉴权注入前不能构造带凭据的工具调用。

## 通道

官方工具为 `ble_send_command`。设备名使用实际广播完整原文，本固件前缀为 `RoboPlanter-`；不使用旧车名称、猜测后缀或MAC。

| 参数 | 设备要求 |
| --- | --- |
| service_uuid | `a2f39c10-7e4b-4d21-8a61-0f3bc9d15001` |
| characteristic_uuid | `a2f39c11-7e4b-4d21-8a61-0f3bc9d15001` |
| encoding | `utf-8`，当前协议仅ASCII |
| ack_type | `ack`（固件WRITE，不支持WRITE_NR） |
| expect_response | `true`（需要NOTIFY业务回包） |
| response_timeout_ms | 3000；超时不等于未执行 |
| command_array | 单个对象含完整command及delay_ms=0；逐条等待回包，不并发 |

每请求≤240字节，单条回复≤20字节。16字符令牌的土壤查询23字节，8字符ID的两秒浇水38字节，超过默认ATT载荷20字节。须实测手机MTU协商或ATT长写；不能截断令牌、拆独立命令或假设工具自动分帧。每个连接需订阅通知，只允许一个BLE命令连接。

官方文档说明表与Schema分别写成功码0和200，真机需记录实际版本；无论哪个码，都必须核对业务响应，不能把“发送成功”当作动作完成。

## 查询映射

| 请求 | 回包 | 解释 |
| --- | --- | --- |
| `S\|token\|soil` | `S:raw:percent:valid:calibrated` | valid和calibrated都为1才报告相对湿度；x为未知 |
| `S\|token\|env` | `E:temperature:humidity:valid` | valid=1才报告温度/空气湿度 |
| `S\|token\|air` | `A:raw:valid` | ADC，不是CO₂或PM2.5 |
| `S\|token\|uv` | `U:raw:valid` | ADC，不是lux或光合强度 |
| `S\|token\|pump` | `P:enabled:on:remaining_ms` | 能力、控制状态和剩余时长 |
| `S\|token\|light` | `L:enabled:on` | 灯能力及控制状态 |
| `S\|token\|printer` | `T:enabled:status` | off/idle/queued/sent/fail |
| `R\|token\|id` | `A:id` / `D:id` / `E:id:code` | 查询原动作，不重新执行 |

按当前请求解析，不能把空气查询的A:raw:valid当动作受理。E:x:x:0是无效环境数据；其他E:按错误处理。缺字段、格式错、x、valid=0都不补零。E:STALE说明采样超过3秒；不使用旧值回答现在。逐项查询并非同一瞬间快照。

## 动作映射（未来启用）

每新动作使用新的1–8字符ASCII字母数字/下划线/连字符ID，查询保留原ID。设备本次启动仅有64条去重记录，重启丢失；ID冲突不自动换ID重发。

| 意图 | 请求 | 结果 |
| --- | --- | --- |
| 明确浇两秒 | `C\|token\|id\|water\|2000` | 先A:id，再查询原ID；本地计时停泵 |
| 停泵 | `C\|token\|id\|stop_water` | 最高优先，不等状态查询；D:id或错误 |
| 指定灯效 | `C\|token\|id\|light\|1\|breath` | 可选第六字段：solid/breath/chase/rainbow；仅开灯可带，查询仍为 L:enabled:on；Skill 当前门禁仍关闭 |
| 开/关灯 | `C\|token\|id\|light\|1` / `...\|0` | D:id是软件结果，可查询灯状态 |
| ASCII打印 | `C\|token\|id\|print\|text` | 文本≤160字节，整包≤240；D仅串口发送完 |

浇水1–3000ms，服从固件更小上限。不从心情、低读数或NFC碰触推断动作授权，不扩展为组合动作。打印不含|、ESC或其他控制字节。

结果未知不重发，不安排“稍后再停”，本地任务负责限时。结果仍A时只说处理中，不无限轮询或承诺后台继续。MISS不证明没执行。LOCK/OFF/BUSY/FULL/ID/TIME/IO/ARG/AUTH/SIZE等错误按实际解释，不说成功，不用默认凭据重试。

Indicator独立通过Wi-Fi HTTP读取同一控制器；不转发YOYO对话，BLE没有主题、照片、番茄钟命令。云MCP是辅助，本Skill没有自建MCP调用能力。
