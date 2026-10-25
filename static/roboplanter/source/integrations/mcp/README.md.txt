# RoboPlanter 本地 MCP 桥接

这是可运行的 MCP 服务，使用官方 `mcp` Python SDK 的 `FastMCP`，把 6 个工具转换为本项目 XIAO 固件的 HTTP 请求。传感器和执行器都在 XIAO；SenseCAP Indicator 是另一台 Wi-Fi 客户端，不承担此桥接服务。

```text
本地 MCP 客户端 → 本机 Python MCP 服务 → XIAO HTTP API → 传感器 / 泵 / 灯 / 打印机
```

本目录实现和测试的是本地桥接。荣耀云端无法直接访问电脑的 `127.0.0.1` 或 XIAO SoftAP 的 `192.168.4.1`；在平台登记本地地址不会自动解决可达性问题。项目另有独立的[云 MCP/MQTT 辅助链路](../cloud/README.md)，已部署经过 HTTPS + Bearer 鉴权的公网入口，并完成工具发现、真实 broker 权限检查以及荣耀平台两个只读工具的调用。真实设备网关仍未接通，云端状态应返回不可用；浇水、停泵、灯光和打印四个云写工具均拒绝执行，不能据公网服务健康认定花盆在线。详见[云部署记录](../cloud/INFRA-DEPLOYMENT.md)与[平台记录](../../docs/deployment/honor-platform-status.md)。本地 HTTP 服务仍只监听回环地址，不是该公网入口。

参赛主线为 [YOYO 独立 Skill → 官方 BLE 工具 → XIAO](../yoyo/README.md)，不以前述云桥为前置条件；手机与真实硬件的完整链路仍待验收。`端 MCP` 是否能承载本目录的 Python 服务不能由其入口名称推定，Android SDK / 应用集成仍需单独验证。

## 安装和运行

需要 **Python 3.11 或以上**（使用 `asyncio.timeout`）。依赖只装入工作区 `.tools/mcp-python`，不安装到全局 Python。固定版本为官方 `mcp==1.30.0`、`httpx==0.28.1`、`pydantic==2.14.1`；这里使用 SDK 内的 `mcp.server.fastmcp.FastMCP`，不是另一个名为 `fastmcp` 的发行包，也不直接兼容 SDK 2.x 的 API。

在项目根目录执行：

```powershell
py -3.11 -m venv .tools\mcp-venv
$rpPython = Join-Path (Get-Location) '.tools\mcp-venv\Scripts\python.exe'
.\integrations\mcp\install.ps1 -Python $rpPython
```

运行桥接的电脑必须能访问 XIAO。SoftAP 模式下连接固件配置的 `RoboPlanter-XXXX` Wi-Fi，默认设备地址为 `http://192.168.4.1`。在本地设置环境变量：

```powershell
$env:ROBOPLANTER_URL = 'http://192.168.4.1'
$env:ROBOPLANTER_TOKEN = '<在本机填入与 XIAO 一致的非默认 token，至少 16 字符>'
$env:ROBOPLANTER_MAX_WATER_MS = '3000'
$env:ROBOPLANTER_TIMEOUT_SECONDS = '3'
```

`ROBOPLANTER_URL` 只接受固定 HTTP(S) origin，不接受路径、查询参数或 URL 用户密码。工具参数不接受任意 URL 或 token。token 由桥接添加到 `X-Device-Token` 请求头，不能放进 YOYO 提示词、对话示例或提交到仓库。token 必须是 1–64 个可打印 ASCII 字符，不能含空格或 `|`；默认 token `change-me-before-use` 或少于 16 字符时桥接拒绝全部写动作，包括 STOP，仍可尝试读取。实际写入需要 XIAO 上相应执行器的 `enabled` 配置也已开启。

默认使用 **stdio**，由本地 MCP 客户端启动进程：

```powershell
.\integrations\mcp\run.ps1 -Python $rpPython
```

手动运行后等待标准输入是正常现象，stdio 不是交互式聊天终端。[client-config.example.json](client-config.example.json) 是常见本地客户端的配置形状；复制后替换 Python 路径、脚本路径和本地 token。各客户端配置入口可能不同，不能把这份 JSON 当成已经验证的荣耀插件导入格式。

可选的 **Streamable HTTP** 只监听本机回环地址：

```powershell
.\integrations\mcp\run.ps1 -Python $rpPython -Transport streamable-http -Port 8765
```

MCP 地址是 `http://127.0.0.1:8765/mcp`。没有公网监听选项；此 HTTP 入口没有客户端身份认证，只适用于可信本地客户端，启用了 SDK 的 Host / Origin DNS rebinding 防护。不要用反向代理或端口转发直接把这个入口公开。启动服务不会连接设备或执行动作。

## 工具与动作结果

| 工具 | 必填参数 | 行为 |
| --- | --- | --- |
| `get_planter_state` | 无 | 只读状态，保留 schema 1、`null`、`valid`、`calibrated`、能力开关等设备原始字段 |
| `water` | `request_id`, `duration_ms` | 明确请求后执行一次定时浇水；单位毫秒，默认上限 3000 ms |
| `stop_water` | `request_id` | 停泵；不依赖传感器新鲜度或有效性 |
| `set_light` | `request_id`, `on` | 设置灯开关，`on` 必须是布尔值 |
| `print_note` | `request_id`, `text` | 一次打印；当前只接受可打印 ASCII 和换行，最多 160 字节，无 ESC 等控制码 |
| `get_action_result` | `request_id` | 只读查询原动作结果，不重新执行 |

每个**新动作**都必须使用全新的 ID，跨会话、客户端也不复用；推荐随机 32 位十六进制字符串，例如本地生成 `[guid]::NewGuid().ToString('N')`。ID 限 1–32 个 ASCII 字母、数字、`_`、`-`。查询某个动作时使用它原来的 ID。不要在实际操作中循环使用 `water1` 或固定示例 ID。

动作结果带 `request_id`、`status`、`error`，以及来源、发送情况等补充字段：

- `accepted`：设备已接受，尚未确认完成。用同一 ID 调用 `get_action_result`。
- `completed`：软件层已完成。浇水只证明定时命令结束，不证明流量；灯只证明软件状态；打印只证明 UART 字节发出，不证明实际出纸。
- `rejected`：桥接校验阻止发送，或设备返回经过 ID / 字段校验的 HTTP 409 拒绝。通过 `source` 和 `sent` 区分。
- `unknown`：POST 超时、断网、不可验证的响应，或结果查询找不到记录。**不自动重发，也不换新 ID 重发。**先查询原 ID，必要时现场核对。

桥接不会自动重试 HTTP 请求，也不跟随重定向。每个请求有整体超时和响应大小限制。同进程中同 ID / 同参数再次调用动作直接返回缓存，不再次 POST；同 ID / 不同参数会被拒绝。桥接保留最多 512 条动作记录且不自动淘汰，满后拒绝新普通动作；新 STOP 仍可发送且不扩大缓存。XIAO 的记录为每次启动最多 64 条，也不自动淘汰；设备重启会清空记录。查询返回 404 会映射为 `unknown`，不能据此认定动作未执行。桥接缓存也不会跨进程重启持久化，因此不能把缓存当成跨重启的执行保证。

写动作串行提交，避免乱序。STOP 可能等待已排队的网络操作；每个普通动作还包括状态预检和 POST 各一次超时，所以网络 STOP 不是物理急停。当前没有让 STOP 越过尚未提交的浇水请求，避免出现“先停泵、旧浇水随后启动”的顺序问题。已确认完成的结果不会被迟到的 `accepted` 响应倒退覆盖。

## 状态有效性与授权边界

非 STOP 动作发送前，桥接读取状态，要求设备 `sample_age_ms` 加读取耗时不超过 **5000 ms**，并要求对应能力 `enabled=true`。这是通信新鲜度和能力检查，不是浇水授权，也不代表所有传感器可用。

解释某项传感器读数时，还必须检查其 **`valid=true`**；解释土壤百分比还需 **`soil.calibrated=true`**。XIAO 自身可能在更短时间内将传感器判为失效，不能以桥接的 5 秒阈值覆盖设备判断。缺失或 `null` 保持未知，不替换成零。`environment.humidity_pct` 是空气湿度，不能代替土壤湿度；air / UV 原始值不能冒充 CO₂、颗粒物或 PAR。传感器不足不阻止用户明确要求 STOP。

工具描述已要求：询问植物状况、读取偏低土壤数值、聊天或情绪表达均不授权浇水；只有用户明确要求动作才调用写工具。桥接能执行类型、时长、token、能力、新鲜度和幂等校验，但它看不到原始用户对话，不能独立证明用户是否授权；YOYO 提示词和客户端必须保持这层交互约束。打印当前不支持中文编码，不能向用户声称中文便签已打印成功。

## 测试与官方依据

在项目根目录执行：

```powershell
& $rpPython -m unittest discover -s tests -p test_mcp_bridge.py -v
```

当前 21 项测试通过。测试使用 `httpx.MockTransport` 或临时 `127.0.0.1` 模拟设备，不连接真实花盆。包括官方 SDK 的真实 stdio 握手、发现全部 6 个工具并逐一调用，参数拒绝、鉴权头、请求去重、超时未知、409 拒绝、404 未知、满缓存 STOP、完成结果竞态等。HTTP 模式目前检查了固定回环绑定与 DNS 防护配置，尚未做 Streamable HTTP 客户端端到端联调。stdio 子进程和模拟 HTTP 服务会在测试结束时关闭。

- [官方 Python SDK v1.30.0 服务端文档](https://github.com/modelcontextprotocol/python-sdk/blob/v1.30.0/docs/server.md)：FastMCP、类型化工具、结构化结果及 Streamable HTTP。
- [官方 Python SDK v1.30.0 客户端文档](https://github.com/modelcontextprotocol/python-sdk/blob/v1.30.0/docs/client.md)：客户端会话、stdio 连接及初始化。
- [官方 FastMCP 实现](https://github.com/modelcontextprotocol/python-sdk/blob/v1.30.0/src/mcp/server/fastmcp/server.py)：服务端设置与传输入口。
- 本项目设备契约见 [docs/device-protocol.md](../../docs/device-protocol.md)；本地代码测试通过不等于荣耀平台、手机、真实泵或打印机已经联调通过。
