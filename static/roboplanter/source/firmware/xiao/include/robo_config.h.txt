#pragma once

// Copy config.local.example.h to config.local.h after checking the hardware.
#if __has_include("config.local.h")
#include "config.local.h"
#endif

#ifndef ROBO_DEVICE_TOKEN
#define ROBO_DEVICE_TOKEN "change-me-before-use"
#endif
#ifndef ROBO_AP_PASSWORD
#define ROBO_AP_PASSWORD "planter-demo"
#endif
#ifndef ROBO_ENABLE_ACTIONS
#define ROBO_ENABLE_ACTIONS 0
#endif
#ifndef ROBO_ENABLE_SOIL
#define ROBO_ENABLE_SOIL 0
#endif
#ifndef ROBO_SOIL_DRY_RAW
#define ROBO_SOIL_DRY_RAW -1
#endif
#ifndef ROBO_SOIL_WET_RAW
#define ROBO_SOIL_WET_RAW -1
#endif
#ifndef ROBO_ENABLE_AIR
#define ROBO_ENABLE_AIR 0
#endif
#ifndef ROBO_ENABLE_UV
#define ROBO_ENABLE_UV 0
#endif
#ifndef ROBO_AUX_PINS_CONFIRMED
#define ROBO_AUX_PINS_CONFIRMED 0
#endif
#ifndef ROBO_ENABLE_SHT31
#define ROBO_ENABLE_SHT31 0
#endif
#ifndef ROBO_SHT31_ADDRESS
#define ROBO_SHT31_ADDRESS 0x44
#endif
#ifndef ROBO_ENABLE_PUMP
#define ROBO_ENABLE_PUMP 0
#endif
#ifndef ROBO_PUMP_HARDWARE_CONFIRMED
#define ROBO_PUMP_HARDWARE_CONFIRMED 0
#endif
#ifndef ROBO_MAX_WATER_MS
#define ROBO_MAX_WATER_MS 3000
#endif
#ifndef ROBO_ENABLE_LIGHT
#define ROBO_ENABLE_LIGHT 0
#endif
#ifndef ROBO_LED_COUNT
#define ROBO_LED_COUNT 1
#endif
#ifndef ROBO_LED_BRIGHTNESS
#define ROBO_LED_BRIGHTNESS 24
#endif
#ifndef ROBO_ENABLE_PRINTER
#define ROBO_ENABLE_PRINTER 0
#endif
#ifndef ROBO_PRINTER_HARDWARE_CONFIRMED
#define ROBO_PRINTER_HARDWARE_CONFIRMED 0
#endif
#ifndef ROBO_PRINTER_BAUD
#define ROBO_PRINTER_BAUD 9600
#endif

namespace pins {
constexpr int Soil = 1;       // D0, SERVO3 signal; supply sensor separately at 3.3V.
constexpr int Pump = 7;       // D8, SERVO4 signal; active-high EXTERNAL 12V driver.
constexpr int Air = 8;        // D9, SERVO2 signal: servo must be disconnected.
constexpr int Uv = 9;         // D10, M2 ENC B: unplug encoder; 4.7k pull-up loads ADC.
constexpr int Sda = 5;
constexpr int Scl = 6;
constexpr int Rgb = 40;       // D13, Grove RGB.
constexpr int PrinterTx = 43;
constexpr int PrinterRx = 44;
}

static_assert(ROBO_MAX_WATER_MS > 0 && ROBO_MAX_WATER_MS <= 30000,
              "Water limit must be 1..30000 ms; determine from measured flow.");
static_assert(ROBO_LED_COUNT > 0 && ROBO_LED_COUNT <= 120, "Invalid LED count");
static_assert(ROBO_LED_BRIGHTNESS >= 0 && ROBO_LED_BRIGHTNESS <= 255,
              "LED brightness must be 0..255");
static_assert(sizeof(ROBO_DEVICE_TOKEN) >= 17 && sizeof(ROBO_DEVICE_TOKEN) <= 65,
              "Token must contain 16..64 characters");
static_assert(sizeof(ROBO_AP_PASSWORD) >= 9 && sizeof(ROBO_AP_PASSWORD) <= 64,
              "AP password must contain 8..63 characters");
static_assert(ROBO_SHT31_ADDRESS == 0x44 || ROBO_SHT31_ADDRESS == 0x45,
              "SHT31 supports I2C address 0x44 or 0x45");
static_assert(!(ROBO_ENABLE_AIR || ROBO_ENABLE_UV) || ROBO_AUX_PINS_CONFIRMED,
              "Confirm SERVO2/encoder disconnection and ADC voltage before AUX use");
static_assert(!ROBO_ENABLE_PUMP || ROBO_PUMP_HARDWARE_CONFIRMED,
              "Confirm external pump driver, polarity, supply and current first");
static_assert(!ROBO_ENABLE_PRINTER || ROBO_PRINTER_HARDWARE_CONFIRMED,
              "Confirm printer supply, TTL voltage, baud and protocol first");
