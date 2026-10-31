---
title: "硬件图鉴与产品链接"
description: "HONOR Robot Phone、Seeed XIAO ESP32-S3 Plus 与 SenseCAP Indicator D1 的官方产品图、用途和链接。"
sidebar_position: 3
hide_title: true
---

# 硬件图鉴与官方产品链接

RoboPlanter 使用 **HONOR Robot Phone** 作为 YOYO 对话入口，使用 **Seeed Studio XIAO ESP32-S3 Plus + XIAO Robot Board V1.0** 连接外设，使用 **SenseCAP Indicator D1** 显示状态和像素植物。花盆外壳采用 Creeper 头造型，可按自己的植物和桌面空间制作。

## HONOR Robot Phone · 和植物说句话

[![HONOR Robot Phone 官方产品图：银色机身背面与收纳状态的云台摄像头](/roboplanter/assets/hardware/honor-robot-phone.webp)](https://www.honor.com/cn/phones/honor-robot-phone/)

在手机 YOYO 中安装 RoboPlanter Skill，通过 BLE 与 XIAO 通信。手机负责理解请求、调用工具和解释返回结果，传感器采样与执行仍由控制板完成。

- [荣耀 Robot Phone 官方产品页](https://www.honor.com/cn/phones/honor-robot-phone/)
- [荣耀开发者平台](https://developer.honor.com/cn/manageCenter/app/E00225?~id=225)
- [从零搭建 YOYO Skill：文件、导入与手机测试](/docs/projects/2026/roboplanter/honor-platform)
- [首次配对与日常使用](/docs/projects/2026/roboplanter/yoyo-companion)

## Seeed Studio XIAO ESP32-S3 Plus · 连接外设

[![Seeed Studio XIAO ESP32-S3 Plus 开发板官方产品图](/roboplanter/assets/hardware/xiao-esp32s3-plus.jpg)](https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32S3-Plus-p-6361.html)

本项目使用 Plus 主板搭配 **XIAO Robot Board V1.0 载板**。上图仅为 XIAO 主板，载板接口位置请对照实物丝印和 [三维接线实验室](https://peterpanstechland.github.io/roboplanter/#wiring-lab)。XIAO 提供 BLE / HTTP 接口，连接环境传感器、灯带、串口打印机和泵驱动。

- [XIAO ESP32-S3 Plus 官方产品页](https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32S3-Plus-p-6361.html)
- [Seeed × HONOR XIAO Robot Kit 官方入门指南](https://seeedstudio.feishu.cn/wiki/GSUEwlzdeidjCakyywNcz1dknJc)
- [认板、备份、构建和首次读取](/docs/projects/2026/roboplanter/hardware-quickstart)
- [当前接口与供电分配](/docs/projects/2026/roboplanter/hardware-wiring)

**Plus 与 ESP32-S3 Sense 的引脚和扩展方式不同。** 本工程使用 Plus 的配置；Sense 摄像头扩展板不能直接当作 Plus 的兼容配件使用。

## Seeed Studio SenseCAP Indicator D1 · 桌面窗口

[![SenseCAP Indicator D1 官方产品图：四英寸触摸屏及背面，图中为原厂示例界面](/roboplanter/assets/hardware/sensecap-indicator-d1.png)](https://www.seeedstudio.com/SenseCAP-Indicator-D1-p-5643.html)

使用原款 4 英寸、480×480 的 D1。ESP32-S3 负责屏幕、触摸和联网，RP2040 负责本项目的土壤 ADC 采集。Indicator 经同一 Wi-Fi 内的 HTTP 与 XIAO 通信，两块板无需外接数据线。

- [SenseCAP Indicator D1 官方产品页](https://www.seeedstudio.com/SenseCAP-Indicator-D1-p-5643.html)
- [Indicator RP2040 Grove ADC 官方教程](https://wiki.seeedstudio.com/SenseCAP_Indicator_RP2040_Grove_ADC/)
- [土壤与水箱校准](/docs/projects/2026/roboplanter/sensor-calibration)
- [设备通信与接线总表](/docs/projects/2026/roboplanter/hardware-wiring)

上图保留原厂示例界面。安装 RoboPlanter 固件后，屏幕显示本项目的植物养成、设备读数与设置界面。D1 自身不包含 D1S 等型号的空气质量传感器配置，本项目另外接入 SEN54。

## 其他模块怎么选

当前组合还包括 SEN54、Grove Light Sensor v1.2、Grove Ultrasonic Ranger v2.0、Grove Relay v1.2、10 颗 WS2813 灯带、电容式土壤探头和 EM5826H 串口热敏打印机。选型时先核对版本、工作电压和协议；同样外观不代表同样接法。

从 [接线总表](/docs/projects/2026/roboplanter/hardware-wiring) 查看实际引脚和电源分配，再按 [灯带教程](/docs/projects/2026/roboplanter/ws2812-lighting) 与 [UART 打印教程](/docs/projects/2026/roboplanter/uart-printer) 单独测试。先完成传感器读取，再接执行器负载。

## 图片来源

本页与项目首页的产品实图来自 [HONOR Robot Phone](https://www.honor.com/cn/phones/honor-robot-phone/)、[Seeed XIAO ESP32-S3 Plus](https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32S3-Plus-p-6361.html) 和 [Seeed SenseCAP Indicator D1](https://www.seeedstudio.com/SenseCAP-Indicator-D1-p-5643.html) 官方页面，仅做等比缩放和网页格式压缩。产品图、品牌名称归相应权利人所有。花盆的网页 3D 场景由程序绘制，实物外壳以制作结果为准。
