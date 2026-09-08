---
sidebar_position: 1
title: 黑客松
slug: /hackathons
description: 黑客松项目、代码和经验分享合集
keywords: [黑客松, 比赛, 项目, aws, ai]
---

# 🏆 黑客松作品集

欢迎来到我的黑客松旅程！这里收录了我参加各类黑客松的项目、代码和心得体会。

## 为什么参加黑客松？

黑客松是一种绝佳的方式：
- 🚀 **快速原型** - 24-48 小时内构建 MVP
- 🤝 **拓展人脉** - 结识志同道合的开发者和导师
- 📚 **深度学习** - 在压力下快速掌握新技术
- 🎯 **解决问题** - 创造性地应对现实世界的挑战

---

## 📅 时间线

| 年份 | 赛事 | 项目 | 成绩 |
|------|------|------|------|
| 2026 | AIx Origin Summit 深圳场 · INNOAI 黑客松 | PΛN — HDMI 调酒机 + Apex 灵巧手（遥操作 / 保健球 RL） | 🏆 影石 Insta360 特别奖 |
| 2026 | Attrax 春潮黑客松 · 影石 Cameraman 赛道 | Roomba-VLLM | 🥇 Cameraman 大奖（TOP 1/200 Outlier） |
| 2026 | OpenClaw 龙虾前沿实验计划 | Cyber Boss 赛博老板 | 🏆 已提交 |
| 2026 | NVIDIA DGX Spark 黑客松 | NemoClaw Travel OS | 🏆 已提交 |
| 2025 | AWS GameDay | 云架构挑战 | 🎖️ 参与奖 |
| 2025 | AI 黑客松 | 语音控制 IoT | 🏅 决赛入围 |
| 2024 | IoT 挑战赛 | 智能家居自动化 | 🎖️ 参与奖 |

---

## 🔥 精选项目

### [PΛN + Apex 灵巧手 — AIx Origin · INNOAI 黑客松 2026](/docs/hackathons/2026/aix-origin-apex-hand)
一台顶着源升 Apex 灵巧手的调酒机（PΛN = Personal Agent for Nightlife，一个 Human Drink Machine Interface），以及围绕这只手的五篇教程：12 GB 笔记本上的 Isaac Lab + RSL-RL PPO 训练、真机 SDK 首次连通、摄像头遥操作 + 医学 Kapandji 对掌试验（真机打到 9 分）、保健球 RL 的九轮奖励迭代与安装角扫描、Sim2Real 观测契约。本场第一支把灵巧手跑起来的队伍；影石 Insta360 特别奖。

**技术栈：** 源升 Apex Hand、Isaac Sim 6 / Isaac Lab 3、RSL-RL PPO、MediaPipe、DexPilot 风格 IK、ONNX Runtime、Logitech C920、RealSense D435、Insta360 X5、RTX 4080 Laptop

### [Roomba-VLLM — Attrax 春潮黑客松 2026 · 影石 Cameraman 赛道](/docs/hackathons/2026/roomba-vllm)
为我家 8 岁女儿房间打造的全本地化赛博管家——Insta360 Link 2 Pro 当云台前置摄像头、Jetson Orin NX 跑 Ollama + Gemma E4B 做 Live VLM 推理、OpenClaw 排定时巡视和星星积分系统。24 小时极限交付（前 24 小时在玩高擎动力机械臂蹦迪）；嘉立创赞助硬件；斩获影石 Cameraman 大奖（TOP 1/200 Outlier）。

**技术栈：** Insta360 Link 2 Pro、reComputer J4012（Jetson Orin NX）、Ollama、Gemma E4B、OpenClaw、WireGuard、TinkerCAD、Bambu Lab X1C、嘉立创 CH340X、DAP（下一步）

### [Cyber Boss 赛博老板 — OpenClaw 龙虾前沿实验计划 2026](/docs/hackathons/2026/cyber-boss)
一个刻薄的 AI 老板「铁哥」，基于 OpenClaw + 飞书生态运行你的一人公司——排今日活、派飞书任务、催 deadline、对你的拖延毒舌点评。17 个角色 Bot 并行，完全自托管。

**技术栈：** OpenClaw, TOOLS.md, 飞书（Bitable + 任务 + WebSocket）, Vue 3, Express, SQLite, Ansible, Docker

### [NemoClaw Travel OS — DGX Spark 黑客松 2026](/docs/hackathons/2026/nvidia-dgx-spark)
基于 NVIDIA DGX Spark 的完全私有化游戏化 AI 旅行助手。从行程规划到旅行日记，由 Nemotron-3-Super-120B、Gemma 4 NVFP4 和 NemoClaw 驱动。

**技术栈：** NemoClaw, Nemotron, vLLM, TensorRT-LLM, OpenShell, Ollama, Ansible, WireGuard, 高德 MCP

### [AWS GameDay 2025](/docs/hackathons/2025/aws-gameday)
专注于弹性和成本优化的云架构比赛。

**技术栈：** AWS CDK, Lambda, DynamoDB, CloudWatch

### [AI 语音助手黑客松](/docs/hackathons/2025/ai-voice-assistant)
使用 Amazon Bedrock 和 ESP32 构建语音控制的 IoT 系统。

**技术栈：** Bedrock Nova, ESP32, MQTT, Lambda

---

## 🛠️ 常用技术栈

我的黑客松项目大多使用以下技术：

| 类别 | 技术 |
|------|------|
| **云服务** | AWS Lambda, API Gateway, DynamoDB, S3 |
| **AI/ML** | Amazon Bedrock, Nova, SageMaker |
| **NVIDIA** | NemoClaw, Nemotron, vLLM, TensorRT-LLM, NIM, OpenShell, NVFP4 |
| **边缘/本地** | NVIDIA DGX Spark, Jetson Orin NX, ESP32, Raspberry Pi, Ollama |
| **具身/相机** | Insta360 Link 2 Pro / X5、DAP、AirSim360、DiT360、DDGS、Roomba 底盘 |
| **机器人 / 仿真** | 源升 Apex Hand、Isaac Sim 6、Isaac Lab 3、RSL-RL PPO、MediaPipe、DexPilot、ONNX Runtime、RealSense D435 |
| **3D / 硬件** | TinkerCAD, Bambu Lab X1C |
| **前端** | React, Next.js, Tailwind CSS, 原生 JS PWA |
| **DevOps** | Ansible, CDK, SAM, GitHub Actions, WireGuard |
| **地图** | 高德 REST API, 高德 MCP |

---

## 💡 黑客松成功秘诀

1. **准备好工具箱** - 提前准备好模板代码
2. **从演示开始** - 逆向从 Pitch 开始构建
3. **使用托管服务** - 不要在基础设施上浪费时间
4. **边做边记录** - 截图和笔记用于最终演示
5. **睡眠可选** - 咖啡必备 ☕

---

## 📁 按年份浏览

import DocCardList from '@theme/DocCardList';

<DocCardList />

