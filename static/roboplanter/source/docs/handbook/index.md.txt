# RoboPlanter 项目文档

> 你先下班，我负责发芽。

RoboPlanter 是一个以工位绿植为起点的硬件项目，将 YOYO 对话、XIAO 设备控制和 Indicator 像素养成连接起来。你可以使用现有套件复现，也可以为自己的硬件编写适配器。

[互动体验](https://peterpanstechland.github.io/roboplanter/) · [下载源码包](https://peterpanstechland.github.io/roboplanter/downloads/roboplanter-starter.zip) · [下载 Device Kit](https://peterpanstechland.github.io/roboplanter/downloads/roboplanter-device-kit.zip) · [功能进度](roadmap-evidence.md)

源码包包含固件、示例配置、教程和测试。下载后可通过 [文件清单与 SHA-256](https://peterpanstechland.github.io/roboplanter/downloads/manifest.json) 核对完整性，再按教程填写自己的配置并构建固件。

更新：2026-10-29。**手机加密绑定与YOYO实时土壤/温湿度读取已通过；SEN54、超声波、环境光和打印链路已接入。** 屏幕已有土壤/水箱校准及自动灯光阈值设置。用户确认水箱、进出水与实际标定完成后，本机12V/150mA泵已启用；用户确认500ms短出水后停止，灯光设置页面与保存正常。

## 使用的硬件

<a href="https://www.honor.com/cn/phones/honor-robot-phone/"><img src="/roboplanter/assets/hardware/honor-robot-phone.webp" alt="HONOR Robot Phone 官方产品图" width="100" /></a> <a href="https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32S3-Plus-p-6361.html"><img src="/roboplanter/assets/hardware/xiao-esp32s3-plus.jpg" alt="Seeed XIAO ESP32-S3 Plus 官方产品图" width="200" /></a> <a href="https://www.seeedstudio.com/SenseCAP-Indicator-D1-p-5643.html"><img src="/roboplanter/assets/hardware/sensecap-indicator-d1.png" alt="Seeed SenseCAP Indicator D1 官方产品图" width="200" /></a>

**HONOR Robot Phone × Seeed Studio**：Robot Phone 提供 YOYO 入口，XIAO ESP32-S3 Plus 配合 Robot Board 连接外设，SenseCAP Indicator D1 显示状态与像素植物。[查看产品实图、型号与官方链接](hardware-catalog.md)。

## 从这里开始

| 内容 | 文档 |
| --- | --- |
| 了解工位搭子与产品设计 | [项目介绍](product-story.md) |
| 识别产品型号、查看实图与官方链接 | [硬件图鉴](hardware-catalog.md) |
| 当前接线总表、供电和替代模块 | [最新硬件接线](../wiring.md) |
| 在屏幕采集并保存干湿、满水和缺水点 | [土壤与水箱校准](sensor-calibration.md) |
| 首次配对、场景小票、番茄钟与提示音 | [YOYO日常交互](yoyo-companion.md) |
| 认板、接线、备份和烧录 | [硬件入门](hardware-quickstart.md) |
| 了解植物精灵与真实生长周期 | [植物生长与陪伴](plant-companion.md) |
| 查询地区、作物和生长阶段相关资料 | [作物知识库](crop-knowledge.md) |
| 设置自动开关阈值与四种灯效 | [灯带教程](ws2812-lighting.md) |
| 连接串口打印机 | [小票打印教程](uart-printer.md) |
| 打印 Logo、植物状态、待办和塔罗 | [工位日签](daily-ticket.md) |
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

**真实设备**负责采集和执行，状态页显示有效性与校准状态。**屏幕养成**提供植物精灵和主控共享专注计时（无共享能力时回退本地），游戏浇水不会开启水泵。**网页体验**展示交互与外观概念，使用浏览器内的模拟状态。

当前功能和开发方向统一列在 [功能进度与开发计划](roadmap-evidence.md)。
