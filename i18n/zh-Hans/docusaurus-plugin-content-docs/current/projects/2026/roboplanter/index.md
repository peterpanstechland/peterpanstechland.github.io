---
title: "工位搭子 · RoboPlanter"
description: "从工位绿植开始，了解产品、硬件、YOYO Skill 与开放设备接入。"
sidebar_position: 1
hide_title: true
slug: /projects/2026/roboplanter
---

# RoboPlanter 项目文档

> 你先下班，我负责发芽。

RoboPlanter 是一个以工位绿植为起点的硬件项目，将 YOYO 对话、XIAO 设备控制和 Indicator 像素养成连接起来。你可以使用现有套件复现，也可以为自己的硬件编写适配器。

[互动体验](https://peterpanstechland.github.io/roboplanter/) · [下载源码包](https://peterpanstechland.github.io/roboplanter/downloads/roboplanter-starter.zip) · [下载 Device Kit](https://peterpanstechland.github.io/roboplanter/downloads/roboplanter-device-kit.zip) · [功能进度](/docs/projects/2026/roboplanter/roadmap-evidence)

源码包包含固件、示例配置、教程和测试。下载后可通过 [文件清单与 SHA-256](https://peterpanstechland.github.io/roboplanter/downloads/manifest.json) 核对完整性，再按教程填写自己的配置并构建固件。

更新：2026-10-29。**手机加密绑定与YOYO实时土壤/温湿度读取已通过；SEN54、超声波、环境光和打印链路已接入。** 水箱和泵负载仍待完成。

## 从这里开始

| 内容 | 文档 |
| --- | --- |
| 了解工位搭子与产品设计 | [项目介绍](/docs/projects/2026/roboplanter/product-story) |
| 当前接线总表、供电和替代模块 | [最新硬件接线](/docs/projects/2026/roboplanter/hardware-wiring) |
| 首次配对、场景小票、番茄钟与提示音 | [YOYO日常交互](/docs/projects/2026/roboplanter/yoyo-companion) |
| 认板、接线、备份和烧录 | [硬件入门](/docs/projects/2026/roboplanter/hardware-quickstart) |
| 了解植物精灵与真实生长周期 | [植物生长与陪伴](/docs/projects/2026/roboplanter/plant-companion) |
| 查询地区、作物和生长阶段相关资料 | [作物知识库](/docs/projects/2026/roboplanter/crop-knowledge) |
| 配置常亮、呼吸、流动和彩虹灯效 | [灯带教程](/docs/projects/2026/roboplanter/ws2812-lighting) |
| 连接串口打印机 | [小票打印教程](/docs/projects/2026/roboplanter/uart-printer) |
| 打印 Logo、植物状态、待办和塔罗 | [工位日签](/docs/projects/2026/roboplanter/daily-ticket) |
| 编写、导入和测试 YOYO Skill | [荣耀 Skill 图文教程](/docs/projects/2026/roboplanter/honor-platform) |
| 了解 BLE 参数、鉴权和回包 | [BLE 接入教程](/docs/projects/2026/roboplanter/ble-integration) |
| 为其他控制板添加能力描述 | [Device Kit](/docs/projects/2026/roboplanter/device-platform) |
| 排查供电、联网与设备问题 | [故障排查](/docs/projects/2026/roboplanter/troubleshooting) |
| 修改角色、主题与动效 | [视觉与交互规范](/docs/projects/2026/roboplanter/design-system) |
| 制作项目图片与视频 | [拍摄与分享](/docs/projects/2026/roboplanter/social-playbook) |
| 检查安装结果和功能状态 | [安装检查](/docs/projects/2026/roboplanter/acceptance)、[开发计划](/docs/projects/2026/roboplanter/roadmap-evidence) |

## 第一次搭建

1. 按硬件教程确认板型、供电和接口，保存原固件备份。
2. 先构建默认配置，完成启动和只读 HTTP 检查。
3. 逐件接入土壤探头、灯带和打印机；水泵最后单独测试。
4. 按 Skill 教程完成文件导入、手机安装和 BLE 通信检查。
5. 根据自己的探头和基质完成标定，再使用相对湿度。

## 设备与界面

**真实设备**负责采集和执行，状态页显示有效性与校准状态。**屏幕养成**提供植物精灵和主控共享专注计时（无共享能力时回退本地），游戏浇水不会开启水泵。**网页体验**展示交互与外观概念，使用浏览器内的模拟状态。

当前功能和开发方向统一列在 [功能进度与开发计划](/docs/projects/2026/roboplanter/roadmap-evidence)。
