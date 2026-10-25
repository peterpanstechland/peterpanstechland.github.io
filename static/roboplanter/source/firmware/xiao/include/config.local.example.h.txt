#pragma once
// This example intentionally leaves every unknown peripheral OFF.
// Use a random 16..64 character token, without whitespace or '|'.
#define ROBO_DEVICE_TOKEN "change-me-before-use"
#define ROBO_AP_PASSWORD "planter-demo"
#define ROBO_ENABLE_ACTIONS 0

#define ROBO_ENABLE_SOIL 0
// Measure dry/wet values yourself; -1 means no calibration (percent is null).
#define ROBO_SOIL_DRY_RAW -1
#define ROBO_SOIL_WET_RAW -1
#define ROBO_ENABLE_AIR 0
#define ROBO_ENABLE_UV 0
// GPIO9/M2 encoder B has a 4.7k pull-up; verify loading/calibration or use ADC module.
#define ROBO_AUX_PINS_CONFIRMED 0
#define ROBO_ENABLE_SHT31 0  // Only SHT31, NOT an unidentified Grove/DHT module.
#define ROBO_SHT31_ADDRESS 0x44

#define ROBO_ENABLE_PUMP 0  // External active-high 3.3V-compatible 12V driver only.
#define ROBO_PUMP_HARDWARE_CONFIRMED 0
#define ROBO_MAX_WATER_MS 3000
#define ROBO_ENABLE_LIGHT 0 // Confirm WS2812/WS2813 GRB 800kHz before enabling.
#define ROBO_LED_COUNT 1
#define ROBO_LED_BRIGHTNESS 24
#define ROBO_ENABLE_PRINTER 0 // Confirm TTL voltage and ASCII/LF print protocol.
#define ROBO_PRINTER_HARDWARE_CONFIRMED 0
#define ROBO_PRINTER_BAUD 9600
