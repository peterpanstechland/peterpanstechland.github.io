---
sidebar_position: 1
title: 项目概览
description: 展示 AI × 边缘计算 × AWS 的端到端项目
slug: /projects
---

# 项目

欢迎来到我的项目作品集。这里的每个项目都代表着从概念到部署的完整过程，展示了 AI、边缘计算和云服务的整合。

## 项目分类

### 🤖 AI 驱动设备
利用云端 AI 和边缘推理的交互系统。

### 🏠 智能家居 & IoT
用于家庭自动化和监控的联网设备。

### 🎨 交互装置
艺术与科技融合的展览和活动作品。

### 🦾 机器人
自主和半自主机器人系统。

## 精选项目

### [VoiceButler — Orin NX 上的离线中文语音对话（2026）](/docs/projects/2026/voicebutler-jetson)

和家里那台机器人共用同一块 Jetson Orin NX 16GB 的离线回路：唤醒词 → VAD → SenseVoice 识别 → 本地 Gemma → Melo TTS。语音全部走 CPU ONNX，GPU 留给 Ollama；意图路由在 2B 模型开口之前先处理开车、算术和小学课本辅导。

**技术栈：** Jetson Orin NX 16GB、JetPack 6.2、sherpa-onnx、SenseVoice、Silero VAD、Zipformer KWS、MeloTTS、Kokoro、Ollama gemma4:e2b、reSpeaker XVF3800、Roomba

**当前状态：** 2026 年 8 月 28 日仍在车上运行。

---

### [PanoTwin — 边缘端全景高斯泼溅数字孪生（2026）](/docs/projects/2026/panotwin-jetson-x5) · **WIP**

完全跑在 Jetson Orin NX 16GB 上的三级流水线：双鱼眼标定 → DAP 全景度量深度 → D²GS 稀疏视角高斯泼溅。用影石 X5 在房间里走一圈，就能拿到带真实米制尺度的三维重建，全程不出局域网。标定环节复现了 HKUST CO-Calib 的失败机理分析，解决 200° 级鱼眼在 Kalibr 上内参初始化不收敛的问题。

**技术栈：** Jetson Orin NX 16GB、JetPack 6.2、TensorRT、CUDA、NVDEC、影石 X5、DAP、D²GS、Kalibr、COLMAP、gsplat、ROS 2

**当前状态：** 施工中（WIP）—— 2026 年 7 月 28 日冻结代码，性能数据复测仍在进行中。

---

## 项目文档格式

每个项目包括：

1. **概述** - 做什么以及为什么重要
2. **架构** - 系统设计和组件交互
3. **硬件** - 组件和组装说明
4. **软件** - 代码、配置和部署
5. **经验总结** - 遇到的挑战和解决方案

## 标签

项目按技术标签分类，方便发现：

- `#AWS` - 使用 AWS 云服务
- `#Bedrock` - Amazon Bedrock AI 集成
- `#IoT` - 物联网
- `#Edge` - 边缘计算和推理
- `#ESP32` - ESP32 微控制器
- `#RaspberryPi` - 树莓派项目
- `#Jetson` - NVIDIA Jetson

