---
sidebar_position: 1
title: Projects Overview
description: End-to-end projects showcasing AI × Edge × AWS
slug: /projects
---

# Projects

Welcome to my project portfolio. Each project here represents a complete journey from concept to deployment, demonstrating the integration of AI, edge computing, and cloud services.

## Project Categories

### 🤖 AI-Powered Devices
Interactive systems leveraging cloud AI and edge inference.

### 🏠 Smart Home & IoT
Connected devices for home automation and monitoring.

### 🎨 Interactive Installations
Art and technology fusion for exhibitions and events.

### 🦾 Robotics
Autonomous and semi-autonomous robotic systems.

## Featured Projects

### [VoiceButler — Offline Chinese Speech-to-Speech on Orin NX (2026)](/docs/projects/2026/voicebutler-jetson)

A fully offline wake-word → VAD → SenseVoice ASR → local Gemma → Melo TTS loop on the same Jetson Orin NX 16GB as the rest of the house robot. Speech stays on CPU ONNX so the GPU remains free for Ollama; a keyword router handles driving, arithmetic, and a primary-school textbook tutor before the 2B model ever sees the utterance.

**Tech Stack:** Jetson Orin NX 16GB, JetPack 6.2, sherpa-onnx, SenseVoice, Silero VAD, Zipformer KWS, MeloTTS, Kokoro, Ollama gemma4:e2b, reSpeaker XVF3800, Roomba

**Status:** Running on the robot as of August 28, 2026.

---

### [PanoTwin — Edge-Side Gaussian-Splatting Digital Twin (2026)](/docs/projects/2026/panotwin-jetson-x5) · **WIP**

A three-stage pipeline running entirely on a Jetson Orin NX 16GB: dual-fisheye calibration, DAP panoramic metric depth, and D²GS sparse-view Gaussian splatting. Walk an Insta360 X5 around a room, get a metric-scale 3D reconstruction — with nothing leaving the LAN. The calibration stage reproduces HKUST's CO-Calib failure analysis to fix intrinsic-initialization divergence on 200°-class fisheye lenses.

**Tech Stack:** Jetson Orin NX 16GB, JetPack 6.2, TensorRT, CUDA, NVDEC, Insta360 X5, DAP, D²GS, Kalibr, COLMAP, gsplat, ROS 2

**Status:** Work in progress — code frozen July 28, 2026; the performance metrics are still being re-measured.

---

## How Projects Are Documented

Each project includes:

1. **Overview** - What it does and why it matters
2. **Architecture** - System design and component interaction
3. **Hardware** - Components and assembly instructions
4. **Software** - Code, configurations, and deployment
5. **Lessons Learned** - Challenges faced and solutions found

## Tags

Projects are tagged by technology for easy discovery:

- `#AWS` - Uses AWS cloud services
- `#Bedrock` - Amazon Bedrock AI integration
- `#IoT` - Internet of Things
- `#Edge` - Edge computing and inference
- `#ESP32` - ESP32 microcontroller
- `#RaspberryPi` - Raspberry Pi projects
- `#Jetson` - NVIDIA Jetson

