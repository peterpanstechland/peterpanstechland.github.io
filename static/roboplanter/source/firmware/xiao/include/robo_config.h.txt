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
#ifndef ROBO_WIFI_STA
#define ROBO_WIFI_STA 0
#endif
#ifndef ROBO_STA_SSID
#define ROBO_STA_SSID ""
#endif
#ifndef ROBO_STA_PASSWORD
#define ROBO_STA_PASSWORD ""
#endif
#ifndef ROBO_ENABLE_REMOTE_SOIL
#define ROBO_ENABLE_REMOTE_SOIL 0
#endif
#ifndef ROBO_WS2813_RMT
#define ROBO_WS2813_RMT 0
#endif
#ifndef ROBO_ENABLE_BONDED_YOYO
#define ROBO_ENABLE_BONDED_YOYO 0
#endif
#ifndef ROBO_ENABLE_DIAGNOSTIC_READ
#define ROBO_ENABLE_DIAGNOSTIC_READ 0
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
#ifndef ROBO_ENABLE_AMBIENT_LIGHT
#define ROBO_ENABLE_AMBIENT_LIGHT 0
#endif
#ifndef ROBO_AUX_PINS_CONFIRMED
#define ROBO_AUX_PINS_CONFIRMED 0
#endif
#ifndef ROBO_ENABLE_SHT31
#define ROBO_ENABLE_SHT31 0
#endif
#ifndef ROBO_ENABLE_DHT20
#define ROBO_ENABLE_DHT20 0
#endif
#ifndef ROBO_ENABLE_SEN54
#define ROBO_ENABLE_SEN54 0
#endif
#ifndef ROBO_SEN54_WIRING_CONFIRMED
#define ROBO_SEN54_WIRING_CONFIRMED 0
#endif
#ifndef ROBO_ENABLE_ULTRASONIC
#define ROBO_ENABLE_ULTRASONIC 0
#endif
#ifndef ROBO_ULTRASONIC_WIRING_CONFIRMED
#define ROBO_ULTRASONIC_WIRING_CONFIRMED 0
#endif
#ifndef ROBO_TANK_FULL_MM
#define ROBO_TANK_FULL_MM -1
#endif
#ifndef ROBO_TANK_EMPTY_MM
#define ROBO_TANK_EMPTY_MM -1
#endif
#ifndef ROBO_TANK_STOP_MM
#define ROBO_TANK_STOP_MM -1
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
#ifndef ROBO_RELAY_WIRING_CONFIRMED
#define ROBO_RELAY_WIRING_CONFIRMED 0
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
#ifndef ROBO_PRINTER_D8_WIRING_CONFIRMED
#define ROBO_PRINTER_D8_WIRING_CONFIRMED 0
#endif
#ifndef ROBO_PRINTER_CUTTER_CONFIRMED
#define ROBO_PRINTER_CUTTER_CONFIRMED 0
#endif

namespace pins {
constexpr int Soil = 1;       // D0, SERVO3 signal; supply sensor separately at 3.3V.
constexpr int Pump = 42;      // D15/SERVO1/J1: active-HIGH Grove Relay v1.2.
constexpr int Ultrasonic = 8; // D9/SERVO2/J5: replaces analog Air Quality v1.3.
constexpr int Air = 8;        // D9, SERVO2 signal: servo must be disconnected.
constexpr int Uv = 1;         // D0, SERVO3 signal; separate 3.3V supply, no servo.
constexpr int AmbientLight = 1; // Grove Light v1.2 replaces UV on SERVO3/D0.
constexpr int Sda = 5;
constexpr int Scl = 6;
constexpr int Rgb = 40;       // D13, Grove RGB.
// Avoid ROM UART0 TX/GPIO43. SERVO4 must have no pump/servo attached.
// Return data uses the original UART RX; confirm printer TX <= 3.3V first.
constexpr int PrinterTx = 7;  // D8, SERVO4/J14 pin 1.
constexpr int PrinterRx = 44; // D7, UART/J10 pin 2.
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
static_assert(!(ROBO_ENABLE_AIR || ROBO_ENABLE_UV || ROBO_ENABLE_AMBIENT_LIGHT) || ROBO_AUX_PINS_CONFIRMED,
              "Confirm SERVO2/3 disconnection and separate 3.3V sensor supply");
static_assert(!(ROBO_ENABLE_SOIL && ROBO_ENABLE_UV),
              "SERVO3 GPIO1 is shared: local soil and UV cannot both be enabled");
static_assert(!(ROBO_ENABLE_AMBIENT_LIGHT && (ROBO_ENABLE_SOIL || ROBO_ENABLE_UV)),
              "SERVO3 GPIO1 supports only one of ambient light, UV or local soil");
static_assert(!(ROBO_ENABLE_DHT20 && ROBO_ENABLE_SHT31),
              "Choose one environment sensor: Grove v2.0 DHT20 or SHT31");
static_assert(!ROBO_ENABLE_PUMP || ROBO_PUMP_HARDWARE_CONFIRMED,
              "Confirm external pump driver, polarity, supply and current first");
static_assert(!ROBO_ENABLE_PUMP || ROBO_RELAY_WIRING_CONFIRMED,
              "Confirm relay moved to SERVO1 GPIO42; SERVO4 belongs to printer");
static_assert(!ROBO_ENABLE_PRINTER || ROBO_PRINTER_HARDWARE_CONFIRMED,
              "Confirm printer supply, TTL voltage, baud and protocol first");
static_assert(!ROBO_ENABLE_PRINTER || ROBO_PRINTER_D8_WIRING_CONFIRMED,
              "Printer RX must connect to SERVO4 D8/GPIO7; remove pump/servo");
static_assert(pins::Pump != pins::PrinterTx, "Pump must not share printer TX");
static_assert(!ROBO_ENABLE_SEN54 || ROBO_SEN54_WIRING_CONFIRMED,
              "SEN54 requires verified 5V supply and 3.3V I2C logic");
static_assert(!(ROBO_ENABLE_SEN54 && (ROBO_ENABLE_DHT20 || ROBO_ENABLE_SHT31 || ROBO_ENABLE_AIR)),
              "SEN54 replaces the legacy environment and analog air sensors");
static_assert(!ROBO_ENABLE_ULTRASONIC || ROBO_ULTRASONIC_WIRING_CONFIRMED,
              "Confirm Grove Ranger v2.0 on SERVO2 with separate 3.3V supply");
static_assert(!(ROBO_ENABLE_ULTRASONIC && ROBO_ENABLE_AIR), "SERVO2 cannot host air ADC and ranger");
static_assert(!ROBO_ENABLE_PUMP || ROBO_ENABLE_ULTRASONIC,
              "Pump requires the water tank sensor and runtime interlock");
static_assert(ROBO_PRINTER_BAUD >= 9600 && ROBO_PRINTER_BAUD <= 1000000,
              "Printer baud must be 9600..1000000 for the bounded raster transport");
static_assert(!(ROBO_ENABLE_SOIL && ROBO_ENABLE_REMOTE_SOIL), "Choose one soil source");
