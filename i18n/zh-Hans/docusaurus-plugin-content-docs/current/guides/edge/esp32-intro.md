---
sidebar_position: 1
title: ESP32 入门
description: IoT 项目的 ESP32 入门指南
tags: [esp32, hardware, iot, beginner]
---

# ESP32 入门

ESP32 是一款功能强大、低成本的微控制器，内置 WiFi 和蓝牙，非常适合 IoT 项目。

## 为什么选择 ESP32？

- **WiFi & 蓝牙** - 内置无线连接
- **双核处理器** - 240 MHz 性能
- **低功耗** - 深度睡眠模式适合电池项目
- **丰富外设** - GPIO, ADC, DAC, I2C, SPI, UART
- **价格实惠** - 每块开发板约 ¥30-70

## 硬件选项

### 开发板
- **ESP32-DevKitC** - 标准开发板
- **ESP32-S3** - 增强的 AI/ML 功能
- **ESP32-C3** - 基于 RISC-V，低功耗

### 推荐入门套件
- ESP32 DevKit 开发板
- 面包板
- 杜邦线
- USB 数据线
- LED + 电阻
- DHT22 温湿度传感器

## 开发环境

### 选项 1: Arduino IDE
最适合初学者
```cpp
void setup() {
  Serial.begin(115200);
  Serial.println("Hello ESP32!");
}

void loop() {
  // 你的代码
}
```

### 选项 2: PlatformIO
专业开发环境，更好的依赖管理。

### 选项 3: ESP-IDF
官方 Espressif 框架，适合高级用户。

## 第一个项目：LED 闪烁

```cpp
#define LED_PIN 2

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}
```

## 下一步

- 连接 WiFi
- 通过 MQTT 发送数据
- 连接到 AWS IoT Core

---

*本指南是边缘设备指南系列的一部分。*

