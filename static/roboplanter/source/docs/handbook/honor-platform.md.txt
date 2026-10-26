# 从零搭建荣耀 YOYO Skill

这份教程带你完成：准备技能文件 → 导入荣耀开发者平台 → 配置展示信息与工具 → 安全检测 → 安装到测试手机 → 核对真实回包。第一次可以先做一个只聊天的盆栽伙伴，再接入硬件。

本教程只讲“我的技能”里的独立 Skill。它使用 `SKILL.md` 描述任务与工具调用，不需要另建 LLM 智能体。

下文提供最小 Skill 示例、平台配置截图和手机测试步骤。

![独立 Skill 从文件到手机的搭建流程](../../web/experience/assets/honor-guide/skill-workflow.svg)

## 1. 选对创建入口

进入 **我的技能**，使用“导入技能”上传自己的 ZIP，或用“创建技能”从空白开始。不要误进左侧的“创建智能体”；这是另一种产品入口。

RoboPlanter 使用独立 Skill 作为近场硬件入口。Indicator 采集与显示，XIAO 提供 BLE/HTTP，YOYO 通过已声明的工具发送请求。**把自建 MCP 工具名写进独立 Skill 的 Allowed tools，不等于完成插件绑定。**

## 2. 准备账号、手机和头像

1. 登录 [荣耀 YOYO 智能体平台](https://developer.honor.com/cn/manageCenter/app/E00225?~id=225)。如页面要求开发者认证或项目权限，先按账号实际提示完成。
2. 准备原创头像。当前表单接受 JPG/JPEG/PNG、160 × 160 像素、大小不超过 1MB。
3. 准备荣耀测试手机，确认 YOYO 可正常使用。草稿测试时，手机登录的荣耀账号需要在测试名单中。
4. 只做对话可以暂不接硬件。调用 BLE 前，核对 [官方 BLE 条件](https://developer.honor.com/cn/doc/guides/101781)；其列出 MagicOS 10.0 及以上、YOYO 90.10.32.025 及以上，仍须确认自己的机型与版本实际支持。
5. 新项目按下一节创建最小包；维护已有 RoboPlanter 时编辑原条目，不重复创建同名副本。

## 3. 先做一个不操作硬件的最小 Skill

新建 `plant-companion` 文件夹，在里面保存 UTF-8 编码的 `SKILL.md`，注意大小写。

```markdown
---
name: my-plant-companion
description: 陪用户聊聊工位生活，并解释盆栽使用方法。
version: 0.1.0
allowed-tools: 'skill_exit'
metadata: {"hardware_ready":false}
---

# 工位盆栽伙伴

你是温和、有一点幽默的工位植物伙伴，默认使用中文。
一次回答一到三句，先回应用户当前的事情。
本版本没有连接传感器、灯带、水泵或打印机。
被问实时读数时，说明尚未接入，不能编造数值。
用户要求浇水、开灯或打印时，说明本版未发送硬件指令。
用户明确退出或换到无关话题时，调用 skill_exit，无参数。
```

这个版本只声明退出工具。正文出现“打印机”不等于取得打印权限。`hardware_ready` 是项目定义的说明字段，**不是平台强制隔离硬件的权限开关**；固件和服务端仍要独立鉴权。

压缩时选中文件夹里的 `SKILL.md`，不要把外层文件夹一起包进去：

```text
my-plant-companion.zip
└── SKILL.md
```

### 使用 RoboPlanter 的现成包

下载 [无凭据的 RoboPlanter Skill 包](https://peterpanstechland.github.io/roboplanter/downloads/roboplanter-honor-skill.zip)，或在源码根目录执行：

```bash
python3 tools/package_honor_skill.py
python3 -m zipfile -l build/honor/roboplanter-companion-draft.zip
python3 -m zipfile -t build/honor/roboplanter-companion-draft.zip
```

Windows 可把 `python3` 换成 `py -3`。预期只有三个成员：

```text
SKILL.md
references/ble-contract.md
references/acceptance.md
```

下载包为 **0.2.1**，仅增加固定无效凭据的 BLE 联通诊断，不含设备凭据，正式硬件控制保持关闭。可先阅读 [包内文件说明](../../integrations/yoyo/skill-draft/README.md)。

## 4. 导入 ZIP

进入 **我的技能 → 导入技能**，选择 ZIP，点击确定。解析成功后进入编辑页。

![实际控制台的 ZIP 导入弹窗](../../web/experience/assets/honor-guide/skill-import.png)

*图 1：上传技能 ZIP，不上传整个工程。当前弹窗限制为 50MB。*

失败时依次检查：能否正常解压、根目录是否直接包含 `SKILL.md`、头部是否为合法 YAML、是否包含 `name` 和 `description`、同层是否有重名文件。固件、`.env`、设备备份和调试日志都不需要上传。

导入用于新建条目。更新已有技能时，从原卡片点 **编辑**，在文件面板按实际提供的上传或编辑功能替换内容，不重复导入出多个副本。

## 5. 填写基本信息

编辑页分为 **技能文件** 与 **基本信息**。两处字段会联动，保存前都要检查。

![RoboPlanter 实际基本信息页](../../web/experience/assets/honor-guide/skill-basic.png)

*图 2：基本信息字段的位置。截图为0.2.2示例；创建自己的技能时，以所用文件的版本和实际能力填写。*

| 字段 | 最小版示例 | 填写理由 |
| --- | --- | --- |
| Slug、技能名称 | `my-plant-companion` | 小写字母、数字、连字符，作为稳定技术标识 |
| 展示名称 | 我的工位盆栽伙伴 | 手机用户看到的名字，可用中文 |
| 描述 | 陪你聊聊工位生活；本版仅提供对话和使用说明。 | 描述已具备的能力 |
| 引导示例 | 今天工作有点累，陪我聊两句／介绍一下盆栽使用方法 | 让第一次使用的人知道该说什么 |
| metadata | `{"hardware_ready":false}` | 基本信息中用 JSON，不放密码 |
| Allowed tools | `skill_exit` | 最小版只需退出；实际调用的工具必须声明 |
| 执行环境 | Android | 对应当前测试手机，不代表跨端都通过 |
| 分类 | 选择页面提供的合适类目，如智能家居/环境 | 便于分发与查找 |
| 技能版本 | `0.1.0` | 三段数字版本；能力变化时升级 |
| 版本说明 | 首个对话测试版，未开放硬件控制。 | 让测试者知道变化和边界 |
| 是否需要配置 APIKey | 最小版关闭 | 该开关不证明有可用的 BLE 密钥注入语法 |

维护现有项目时保留 `roboplanter-companion`，不要因修改宣传文案而随意改 Slug。点击 **保存**，重新打开核对版本、引导语和正文。保存只说明平台保留配置，不说明手机已经更新。

## 6. 安全检测

点击 **安全检测**，按钮变为 **刷新进度** 后用它查看结果。检测期间尽量不改正文；内容改变后，应重新检测最终版本。

发现问题时阅读文件名、原因和修复建议，再回源文件修改。**平台允许继续操作不等于风险消失。** 设备令牌、云端 Bearer、MQTT 密码不能写进公开提示词或截图。

## 7. 安装到测试手机

从编辑页进入 **真机测试**：

1. 点 **添加测试名单**，核对测试手机所登录的荣耀账号；只加入参与测试并同意加入的账号，不公开名单截图。
2. 回到弹窗，点 **发布真机测试**，确认发布本次测试服务。
3. 手机进入 **YOYO → 左上角侧边栏 → 技能商店**，搜索展示名称。
4. 安装或更新技能，点 **立即体验**；也可在 YOYO 主对话手动输入 `@`，从列表选择该技能。
5. 开启新对话，核对本版引导语，避免一直测试旧会话。

![平台实际显示的手机测试步骤](../../web/experience/assets/honor-guide/skill-device-test.png)

*图 3：在编辑页打开真机测试，依次配置测试名单和发布测试服务。*

第一轮说“今天有点累，陪我聊两句”，检查回复是否自然简短。再问“现在土壤湿度多少”，最小版应说明未连接，不能报随机数字。最后说“退出盆栽伙伴”，确认交回 YOYO。

## 8. 接入官方 BLE 工具

准备好实物和协议后，才加入 `ble_send_command`，并提供已知的设备名、服务 UUID、特征 UUID、命令和响应解释。先完成 [硬件首次接入](hardware-quickstart.md)。

下列为0.2.1包 的无效凭据诊断。`RoboPlanter-XXXX` 是占位名称，必须改成现场确认的广播名，不能照抄别人的设备标识：

```json
{
  "device_name": "RoboPlanter-XXXX",
  "service_uuid": "a2f39c10-7e4b-4d21-8a61-0f3bc9d15001",
  "characteristic_uuid": "a2f39c11-7e4b-4d21-8a61-0f3bc9d15001",
  "command_array": [{"command":"S|probe|soil","delay_ms":0}],
  "encoding": "utf-8",
  "ack_type": "ack",
  "expect_response": true,
  "response_timeout_ms": 3000
}
```

`probe` 是故意无效的公开字符串，预期设备返回 **`E:AUTH`**。它只证明消息到达并收到鉴权拒绝，不能读取正式土壤值或控制执行器。

`ack_type: ack` 等待 GATT 写确认；`expect_response: true` 另行等待业务响应。只有“发送成功”不能报告读取成功。一次短查询成功也不能证明长指令、打印、水泵或灯光控制都可用。

完整参数与 MTU 说明见 [BLE 教程](ble-integration.md) 和 [官方 BLE 文档](https://developer.honor.com/cn/doc/guides/101781)。不猜测 `${API_KEY}` 等未验证变量语法，不删除设备鉴权来迁就连接。

## 9. 判断搭建是否真的成功

![从导入到实物结果的分层验收](../../web/experience/assets/honor-guide/verification.svg)

| 检查项 | 预期结果 | 后续检查 |
| --- | --- | --- |
| ZIP 结构检查通过 | 文件可解压，根文件正确 | 手机可运行 |
| 保存后版本仍在 | 平台保留配置 | 手机已更新 |
| 手机进入该 Skill | 名单、分发和入口可用 | BLE 接通 |
| 收到 `E:AUTH` | 固件返回鉴权拒绝 | 取得读数 |
| 收到有效的实时土壤回包 | 这次读取闭环完成 | 已校准或应该浇水 |
| 关联到请求的灯亮、出水或出纸 | 对应实物动作被观察到 | 长期稳定、其他外设也通过 |

## 10. 发布技能

通过验收后，进入正式 **发布**，复核版本、头像、文案、实际支持范围和页面要求的声明，再按目标选择私有发布或技能市场发布。由账号负责人阅读并确认适用的平台协议。

草稿、审核中、已上架分别按页面状态记录。公开截图不应含账号名单、内部 ID、密钥或带签名参数的下载链接。

## 11. 常见问题

**手机搜不到：** 检查测试账号、本次真机测试发布、展示名称和安装版本。不要反复建同名技能。

**更新后仍是旧回答：** 退出旧会话，更新或重新安装后进入新会话，核对引导语与版本说明。

**编辑按钮不可用：** 检查审核状态与账号权限。审核中可能只读；不要为了看配置随意撤销已有审核。

**安全检测没有新结果：** 保存最终内容后刷新进度；若改了文件就重新检测。记录实际反馈，不把按钮可点当成无风险通过。

**有写确认却没读数：** 核对广播名、UUID、通知支持与业务响应等待，再检查采样是否过期。不要自动重发浇水或打印。

**必须用 NFC 吗：** 不需要。先用“立即体验”或手动 `@` 跑通。项目 NFC 直达指定 Skill 尚未通过，碰贴也不授权浇水或打印。

## 12. 官方资料和后续教程

- [技能创建和管理](https://developer.honor.com/cn/doc/guides/101775)：字段、ZIP、检测、发布与测试名单。
- [技能开放能力](https://developer.honor.com/cn/doc/guides/101776)：工具声明与支持能力。
- [BLE 开放案例](https://developer.honor.com/cn/doc/guides/101781)：参数与环境条件。
- [分阶段验收](acceptance.md)：硬件与现场观察的记录方法。
