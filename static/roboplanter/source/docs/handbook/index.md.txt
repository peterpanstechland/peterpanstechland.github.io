# RoboPlanter 项目文档

> 你先下班，我负责发芽。

RoboPlanter 是一个以工位绿植为起点的开源硬件项目，将 YOYO 对话、XIAO 设备控制和 Indicator 像素养成连接起来。你可以使用现有套件复现，也可以为自己的硬件编写适配器。

[互动体验](https://peterpanstechland.github.io/roboplanter/) · [下载源码包](https://peterpanstechland.github.io/roboplanter/downloads/roboplanter-starter.zip) · [下载 Device Kit](https://peterpanstechland.github.io/roboplanter/downloads/roboplanter-device-kit.zip) · [功能进度](roadmap-evidence.md)

源码包包含固件、示例配置、教程和测试。下载后可通过 [文件清单与 SHA-256](https://peterpanstechland.github.io/roboplanter/downloads/manifest.json) 核对完整性，再按教程填写自己的配置并构建固件。

## 从这里开始

| 内容 | 文档 |
| --- | --- |
| 了解工位搭子与产品设计 | [项目介绍](product-story.md) |
| 认板、接线、备份和烧录 | [硬件入门](hardware-quickstart.md) |
| 了解植物精灵与真实生长周期 | [植物生长与陪伴](plant-companion.md) |
| 查询地区、作物和生长阶段相关资料 | [作物知识库](crop-knowledge.md) |
| 配置常亮、呼吸、流动和彩虹灯效 | [灯带教程](ws2812-lighting.md) |
| 连接串口打印机 | [小票打印教程](uart-printer.md) |
| 编写、导入和测试 YOYO Skill | [荣耀 Skill 图文教程](honor-platform.md) |
| 了解 BLE 参数、鉴权和回包 | [BLE 接入教程](ble-integration.md) |
| 为其他控制板添加能力描述 | [Device Kit](device-platform.md) |
| 排查供电、联网与设备问题 | [故障排查](troubleshooting.md) |
| 修改角色、主题与动效 | [视觉与交互规范](design-system.md) |
| 制作项目图片与视频 | [拍摄与分享](social-playbook.md) |
| 检查安装结果和功能状态 | [安装检查](acceptance.md)、[开发计划](roadmap-evidence.md) |

## 第一次搭建

1. 按硬件教程确认板型、供电和接口，保存原固件备份。
2. 先构建默认配置，完成启动和只读 HTTP 检查。
3. 逐件接入土壤探头、灯带和打印机；水泵最后单独测试。
4. 按 Skill 教程完成文件导入、手机安装和 BLE 通信检查。
5. 根据自己的探头和基质完成标定，再使用相对湿度。

## 设备与界面

**真实设备**负责采集和执行，状态页显示有效性与校准状态。**屏幕养成**提供植物精灵和本地专注计时，游戏浇水不会开启水泵。**网页体验**展示交互与外观概念，使用浏览器内的模拟状态。

当前功能和开发方向统一列在 [功能进度与开发计划](roadmap-evidence.md)。
