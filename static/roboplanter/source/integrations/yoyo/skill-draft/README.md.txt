# 独立荣耀 Skill：RoboPlanter 工位盆栽伙伴

这是参赛主线的 **0.2.0 联调草稿**，入口为“我的技能”，使用官方BLE工具的接入方案。上一级 `agent-prompt.md` 属于已有LLM+MCP辅助实验，不能代替此技能。

硬件门禁保持关闭：设备令牌安全注入、手机长写、通知回包和实物连接未验收。草稿可测试安装、唤起、工位陪伴和诚实的离线反馈，不能宣称完成硬件赛道作品。声明 `ble_send_command,skill_exit`，本版只允许退出工具；不添加自建MCP工具名或虚构密钥变量。

## 打包与平台配置

执行 `python tools/package_honor_skill.py` 生成 `build/honor/roboplanter-companion-draft.zip`。只打包白名单中的三份文件：根目录 `SKILL.md` 及 `references/` 下两份说明，无外层文件夹，无凭据或服务器配置，无执行脚本。

| 字段 | 内容 |
| --- | --- |
| Slug / 技能名称 | `roboplanter-companion` |
| 展示名称 | `RoboPlanter工位盆栽伙伴` |
| 版本 / 环境 | `0.2.0` / Android |
| 头像 | `../assets/roboplanter-160.png` |
| 引导示例 | `上班有点累，盆栽伙伴陪我一下`；`盆栽现在怎么样？有哪些功能已经能用？` |
| APIKey开关 | 本版不要求；本版不发硬件请求，固件鉴权未删除。 |

平台实际结果见[部署记录](../../../docs/deployment/honor-platform-status.md)。保存草稿、安全检测、真机测试、发布审核和比赛提交是不同步骤。

## 进入硬件联调

1. 获取实际广播名称，不沿用小车名称；不上传或在对话中填写设备令牌。
2. 确认官方支持的鉴权传递方式。当前APIKey说明未定义BLE参数注入，开关本身不能解决。
3. 外设禁用时，真机验证完整请求、WRITE确认、NOTIFY订阅及返回。服务器MTU设置不代替手机测试，不能自行拆成多条独立命令。
4. 先只读，再逐项验收灯、ASCII打印，最后短时水泵；分别记录断连、重复ID、超时、不重放。
5. 修改技能版本及硬件就绪状态后再测试，不由对话解除门禁。

BLE明文令牌与Arduino长写缓存的已知限制见[固件说明](../../../firmware/xiao/README.md)。

依据：[赛事要求](https://developer.honor.com/cn/activity/page/tg2026081119200701#navigation6)、[技能创建管理](https://developer.honor.com/cn/doc/guides/101775)、[官方BLE案例](https://developer.honor.com/cn/doc/guides/101781)。
