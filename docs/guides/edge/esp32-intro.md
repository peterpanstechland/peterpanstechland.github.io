---
sidebar_position: 1
title: Getting Started with ESP32
description: Introduction to ESP32 for IoT projects
tags: [esp32, hardware, iot, beginner]
---

# Getting Started with ESP32

The ESP32 is a powerful, low-cost microcontroller with built-in WiFi and Bluetooth, making it perfect for IoT projects.

## Why ESP32?

- **WiFi & Bluetooth** - Built-in wireless connectivity
- **Dual-core processor** - 240 MHz performance
- **Low power** - Deep sleep modes for battery projects
- **Rich peripherals** - GPIO, ADC, DAC, I2C, SPI, UART
- **Affordable** - ~$5-10 per board

## Hardware Options

### Development Boards
- **ESP32-DevKitC** - Standard development board
- **ESP32-S3** - Enhanced AI/ML capabilities
- **ESP32-C3** - RISC-V based, low power

### Recommended Starter Kit
- ESP32 DevKit board
- Breadboard
- Jumper wires
- USB cable
- LED + resistors
- DHT22 temperature sensor

## Development Environment

### Option 1: Arduino IDE
Best for beginners
```cpp
void setup() {
  Serial.begin(115200);
  Serial.println("Hello ESP32!");
}

void loop() {
  // Your code here
}
```

### Option 2: PlatformIO
Professional development environment with better dependency management.

### Option 3: ESP-IDF
Official Espressif framework for advanced users.

## First Project: Blink LED

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

## Next Steps

- Connect to WiFi
- Send data via MQTT
- Connect to AWS IoT Core

---

*This guide is part of the Edge Devices Guides series.*

