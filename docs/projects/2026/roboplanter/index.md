---
title: "工位搭子 · RoboPlanter"
description: "从工位绿植开始，了解产品、硬件、YOYO Skill 与开放设备接入。"
sidebar_position: 1
hide_title: true
slug: /projects/2026/roboplanter
---

# 工位搭子 · RoboPlanter 项目手册

> 你先下班，我负责发芽。

一盆有点嘴硬的绿，和一套从工位开始的开放硬件接入实践。RoboPlanter 将 YOYO 对话、设备端的可信执行与桌面陪伴放在一起：**硬件由用户选择，智能体接入 YOYO，动作结果由设备回报。**

[体验工位搭子](https://peterpanstechland.github.io/roboplanter/) · [下载完整源码复现包](https://peterpanstechland.github.io/roboplanter/downloads/roboplanter-starter.zip) · [仅下载 Device Kit](https://peterpanstechland.github.io/roboplanter/downloads/roboplanter-device-kit.zip) · [先看实际进度](/docs/projects/2026/roboplanter/roadmap-evidence)

完整开发仓库保持私有，公开的是经白名单筛选的源码复现包：固件、示例配置、教程与测试。包中没有真实凭据、个人配置、设备备份、原始套件附件或账号截图。下载后先核对 [发布清单与 SHA-256](https://peterpanstechland.github.io/roboplanter/downloads/manifest.json)，再按硬件教程操作。源文件在站点提供文本浏览；这不是预编译固件，也不自动赋予全部代码新的开源许可证。

网页展示包括可旋转的 Tripo 一体机外观概念，以及独立的 3D 圆盆、粒子、浇水和心情交互。前者不是实机扫描或制造 CAD，后者都是浏览器内的模拟；实物 Indicator 使用独立的像素养成界面。当前没有商品销售、通用即插即用硬件或农业自动控制承诺。

![工位搭子概念角色与原创工位海报，非实机拍摄](/roboplanter/assets/social-cover.png)

## 按你的目标开始

| 你想做什么 | 从这里开始 | 完成后你应当能证明什么 |
| --- | --- | --- |
| 了解参赛作品与利他价值 | [产品故事与设计思考](/docs/projects/2026/roboplanter/product-story) | 说清楚用户、真实需求、能力边界与研究假设 |
| 用现有 XIAO / Indicator 套件复现 | [硬件从零到首次读取](/docs/projects/2026/roboplanter/hardware-quickstart) | 认板、供电、保留备份、默认只读、按步骤验收 |
| 按真实植物周期养成 | [植物生长与陪伴](/docs/projects/2026/roboplanter/plant-companion) | 把真实观察、预测和陪伴奖励分开，不用游戏时间决定成熟 |
| 建立地区与作物知识库 | [来源与接入方案](/docs/projects/2026/roboplanter/crop-knowledge) | 查询可追溯来源，检查地区/作物/阶段适用性，保留未知 |
| 做工位氛围灯与灯效 | [WS2812 灯带交互](/docs/projects/2026/roboplanter/ws2812-lighting) | 配置四种固件灯效，完成接线/烧录验收，并区分网页预览 |
| 从零搭建或更新荣耀 Skill | [荣耀 Skill 图文教程](/docs/projects/2026/roboplanter/honor-platform) | 创建、导入、配置、检测并安装到手机 |
| 打通手机到设备 | [BLE 完整链路](/docs/projects/2026/roboplanter/ble-integration) | 区分 GATT 写成功、业务受理、软件完成与物理效果 |
| 使用自己的控制板 | [通用设备接入平台](/docs/projects/2026/roboplanter/device-platform) | 跑通离线 profile / 登记 / 样例校验，知道哪些驱动还需自己实现 |
| 排查故障 | [故障排查与恢复](/docs/projects/2026/roboplanter/troubleshooting) | 从供电到协议逐层定位，不靠重复发动作试错 |
| 做界面与动效 | [产品设计系统](/docs/projects/2026/roboplanter/design-system) | 统一角色、视觉、交互状态、动效预算与可访问性 |
| 拍视频或做小红书图文 | [社媒创作手册](/docs/projects/2026/roboplanter/social-playbook) | 拍出有代入感的作品，并保留实物/概念的标记 |
| 准备答辩或验收 | [证据路线图](/docs/projects/2026/roboplanter/roadmap-evidence)、[验收记录模板](/docs/projects/2026/roboplanter/acceptance) | 把假设、软件检查、平台状态和实测证据分开呈现 |

## 第一次复现的推荐路线

1. 阅读硬件教程的器材识别与供电部分。不要把附件小车协议当成本项目协议。
2. 固件先保持全部执行器关闭；做备份、构建和只读验收。
3. 按荣耀 Skill 教程创建对话版，或使用公开 0.2.1 包做固定无效凭据诊断；不开放正式读数和执行器。
4. 核实凭证安全注入、手机长写、通知与结果，再进入 BLE 真机验收；不通过修改一句提示词绕过这些条件。
5. 最后做逐外设台架测试，并保存版本、配置摘要、请求编号和原始回包。

## 我们现在走到哪里

核对日：2026-10-26。

- **仓库已有**：XIAO 控制固件、HTTP/BLE 协议、Indicator 像素养成/设置/番茄钟、MCP 桥接和只读云查询；已有屏幕刷写与短期观察记录。
- **本轮交付**：详细教程、产品/社媒设计方案、Three.js 互动展示、3:4 海报生成，以及可运行的离线 Device Kit。
- **已完成一次读取验收**：Indicator 土壤采集、XIAO 转发和私有 YOYO 手机读取，用户确认原始值2529；另有云端只读查询。临时权限已撤销。
- **尚待完成**：正式安全凭据下发、持续运行验证、水泵和打印实物验收、LLM 绑定 MCP 后的手机闭环。
- **未来设计**：在线设备绑定与管理、多用户隔离、设施农业、智能灌溉。离线样例不代表这些功能已上线。

以 [验收记录](/docs/projects/2026/roboplanter/acceptance) 为每一条“已完成”留下证据。模拟数字与气氛文案不进入实测成绩；没有原始依据的效果不对外承诺。

## 三个世界，各自清楚

**真实设备**负责传感器和执行器，缺失、过期和未标定必须如实报告。**实屏游戏**负责植物精灵养成，游戏浇水不操作真实水泵。**网页展示**让人理解产品与玩一个原型，不连接任何硬件。三者可以互相解释，但不能借彼此的画面证明真实动作已经发生。

## 对外资料维护

本目录是教程和产品资料的源文件；[同步脚本](/roboplanter/source/tools/sync_docs_site.py.txt)将其转换为指定 GitHub Pages 文档站的页面。先在源文件更新事实和引用，再同步、构建、检查链接和发布。不要把个人设备身份、令牌、账号信息或附件原文加入公开站点。
