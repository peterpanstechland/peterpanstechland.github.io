---
title: "BLE 完整接入教程"
description: "官方工具参数、设备协议、MTU、加密绑定、回包语义和逐步验收。"
sidebar_position: 14
hide_title: true
---

# BLE 与 YOYO Skill 接入 · v2

当前Skill 0.4.0使用**系统加密配对 + 公开V协议**。2026-10-29已确认首次绑定及手机“读取工位状态”返回土壤、温度和湿度。[最新接线](/docs/projects/2026/roboplanter/hardware-wiring) · [使用步骤](/docs/projects/2026/roboplanter/yoyo-companion)

## 连接与授权

手机通过官方`ble_send_command`直连XIAO；Indicator通过同一Wi-Fi的HTTP接XIAO，不是蓝牙中继，云MCP/MQTT也不是前置条件。

在Indicator“设置 → 花盆连接 → YOYO与场景小票”开启两分钟配对，手机蓝牙选择实际RoboPlanter名称，输入**Indicator显示的六位码**。主控要求Secure Connections、MITM和bonding，登记手机身份。PIN不进入Skill、聊天或公开录屏。这是项目的首次绑定设计，不是荣耀强制要求。

固件默认`ROBO_ENABLE_BONDED_YOYO=0`，本机为1。V只是协议标记，没有授权作用。每次连接仍须加密认证；旧带token的BLE命令和一次性土壤凭据不是开启v2后的回退入口。HTTP保留本机令牌，不把它复制进Skill。

## GATT与传输

| 参数 | 值 |
| --- | --- |
| Service | `a2f39c10-7e4b-4d21-8a61-0f3bc9d15001` |
| Characteristic | `a2f39c11-7e4b-4d21-8a61-0f3bc9d15001` |
| 能力 | Write With Response + Notify，不提供Read |
| 请求 | UTF-8完整一条最多240字节，无换行/NUL |
| 回复 | 单条通知不超过20字节 |
| 动作ID | 1–8位字母数字、下划线或短横线；Skill使用8位 |
| 并发 | 一个BLE命令连接，调试App不能同时占用 |

先订阅Notify，再写。偏好MTU247，最终由手机协商；长中文场景需更大MTU或ATT prepare/execute长写，**不能拆成几个普通Write**。短查询成功不代表最长指令已通过。

## 第一条查询

替换为自己的真实广播名称，示例不含凭据：

```json
{"device_name":"RoboPlanter-A994","service_uuid":"a2f39c10-7e4b-4d21-8a61-0f3bc9d15001","characteristic_uuid":"a2f39c11-7e4b-4d21-8a61-0f3bc9d15001","command_array":[{"command":"V|S|desk","delay_ms":0}],"encoding":"utf-8","ack_type":"ack","expect_response":true,"response_timeout_ms":3000}
```

响应`K:raw:temperature10:humidity`：温度除10才是°C，空气湿度为%，土壤仍是ADC，x为未知。

| 查询字段（V\|S\|字段） | 回包 | 说明 |
| --- | --- | --- |
| soil | S:raw:percent:valid:calibrated | 未标定不报告百分比或判断缺水 |
| env | E:temperature:humidity:valid | 空气温湿度 |
| ambient | B:raw:valid | 光照ADC，不是lux |
| pm25 | M:value:valid | PM2.5，µg/m³ |
| voc | V:value:valid | VOC指数，不是ppm |
| tank | W:distance_mm:valid | 探头距离，尚未标定水位 |
| focus | F:phase:remaining_seconds:duration_seconds | 0待机、1计时、2暂停、3完成 |
| auto | AUTO:0/1 | 持久自动打印开关 |
| light | L:enabled:on | 灯能力与开关 |
| pump | P:enabled:on:remaining_ms | 当前泵禁用 |
| printer | T:enabled:status | sent仅表示串口已发送 |

## 动作与结果

`V|C|id|action|参数`发动作，`V|R|id`查同一次结果。新动作新ID，超时查询保持原ID。下表的id、斜线为说明，不应原样发送。

| 意图 | 命令 |
| --- | --- |
| 开灯 / 关灯 | V\|C\|id\|light\|1 或0 |
| 开始25分钟 | V\|C\|id\|focus_start\|1500000 |
| 暂停 / 继续 / 结束 | action为focus_pause / focus_resume / focus_reset，无参数 |
| 自动打印开 / 关 | V\|C\|id\|auto_print\|1 或0 |
| 场景小票 | V\|C\|id\|print_scene\|meetings\|1\|会议结束，脑袋下班 |
| 停泵 | V\|C\|id\|stop_water |

场景中1代表自动，0代表明确手动。短句最多42个UTF-8字节，不含竖线、换行或emoji。当前Skill不发送启动浇水命令。

- A:id为受理，D:id为软件完成；GATT ACK不是业务完成，软件完成也不等于物理出纸。
- E:PAIR：未通过加密/身份验证。检查绑定，不发送旧凭据。
- E:id:OFF / LOCK / TANK：未启用、锁定、水箱条件不足。
- STATE：计时状态不允许，不重开覆盖；MUTE / COOL：自动打印关闭或五分钟冷却。
- BUSY / IO：忙或打印失败；ID / FULL / MISS：ID冲突、缓存满或记录不存在。
- STALE / FORMAT / SIZE / ARG：数据过期或参数错误。

超时最多查三次，每次至少间隔一秒；仍未知就报告未知，不自动重发。64条请求缓存不跨断电，MISS不等于肯定未执行。物理出纸、刀具、水泵停转仍须现场观察。

## 验收顺序

已通过：Indicator状态链路、手机首次配对、主控认证、YOYO土壤/温湿度查询。接着分别测试断开/重启重连、开关灯、共享计时，再到一张有意触发的场景小票，以及长中文写入、超时只查结果、自动开关和冷却。水箱/泵负载仍不接入。

当前通过记录基于已部署固件，后续大码提示与连接阶段诊断仅编译未刷。[完整契约](/roboplanter/source/integrations/yoyo/skill-draft/references/ble-contract.md.txt) · [荣耀工具说明](https://developer.honor.com/en/doc/guides/101776)
