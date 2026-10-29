#pragma once
// This example intentionally leaves every unknown peripheral OFF.
// Use a random 16..64 character token, without whitespace or '|'.
#define ROBO_DEVICE_TOKEN "change-me-before-use"
#define ROBO_AP_PASSWORD "planter-demo"
#define ROBO_ENABLE_ACTIONS 0
// Optional shared 2.4GHz LAN mode. Defaults remain the standalone SoftAP.
#define ROBO_WIFI_STA 0
#define ROBO_STA_SSID ""
#define ROBO_STA_PASSWORD ""
// Original Indicator UART -> authenticated HTTP soil relay; no automatic care.
#define ROBO_ENABLE_REMOTE_SOIL 0
// One-use soil-read session, started only by the main authenticated HTTP API.
// No active token at boot; disabled by default. Never accepts actuator commands.
#define ROBO_ENABLE_DIAGNOSTIC_READ 0
// Experimental v2: SC+MITM bonded phone only; enroll locally on Indicator.
// Do not enable until reviewing the first-pair UX and testing your phone.
#define ROBO_ENABLE_BONDED_YOYO 0

#define ROBO_ENABLE_SOIL 0
// Measure dry/wet values yourself; -1 means no calibration (percent is null).
#define ROBO_SOIL_DRY_RAW -1
#define ROBO_SOIL_WET_RAW -1
#define ROBO_ENABLE_AIR 0
#define ROBO_ENABLE_UV 0
#define ROBO_ENABLE_AMBIENT_LIGHT 0 // Grove Light v1.2 on GPIO1, replaces UV/local soil.
// Air: SERVO2 GPIO8; UV: SERVO3 GPIO1 (cannot share with local soil).
// Signal pins only; use separate 3.3V/GND, not the Servo 5V power pins.
#define ROBO_AUX_PINS_CONFIRMED 0
#define ROBO_ENABLE_SHT31 0  // Only SHT31, NOT an unidentified Grove/DHT module.
#define ROBO_SHT31_ADDRESS 0x44
#define ROBO_ENABLE_DHT20 0 // Grove Temperature & Humidity v2.0, I2C 0x38.
#define ROBO_ENABLE_SEN54 0 // Replaces DHT20/SHT31 and analog Air; I2C 0x69.
#define ROBO_SEN54_WIRING_CONFIRMED 0 // Separate 5V VCC, SDA/SCL at 3.3V.
#define ROBO_ENABLE_ULTRASONIC 0 // Grove Ranger v2.0, SERVO2 GPIO8, 3.3V.
#define ROBO_ULTRASONIC_WIRING_CONFIRMED 0 // Disconnect analog Air first.
// Fixed probe-to-water distances in mm. Unknown calibration blocks watering.
#define ROBO_TANK_FULL_MM -1
#define ROBO_TANK_EMPTY_MM -1
#define ROBO_TANK_STOP_MM -1 // Above minimum safe pump intake, full < stop < empty.

#define ROBO_ENABLE_PUMP 0  // SERVO1 GPIO42 -> active-high Grove Relay v1.2.
#define ROBO_PUMP_HARDWARE_CONFIRMED 0
#define ROBO_RELAY_WIRING_CONFIRMED 0 // Keeps confirmed GPIO42 relay LOW even with pump disabled.
#define ROBO_MAX_WATER_MS 3000
#define ROBO_ENABLE_LIGHT 0 // Confirm WS2812/WS2813 GRB 800kHz before enabling.
#define ROBO_WS2813_RMT 0 // Opt-in timing verified with the four-wire bench strip.
#define ROBO_LED_COUNT 1
#define ROBO_LED_BRIGHTNESS 24
#define ROBO_ENABLE_PRINTER 0 // Confirm TTL voltage and ESC/POS text protocol.
#define ROBO_PRINTER_HARDWARE_CONFIRMED 0
#define ROBO_PRINTER_D8_WIRING_CONFIRMED 0 // Printer RX -> SERVO4 D8/GPIO7; no pump/servo there.
#define ROBO_PRINTER_CUTTER_CONFIRMED 0 // Confirm an autocutter: ESC d 6, then GS V 0.
// Printer TX -> J10 RX/GPIO44 only after confirming 3.3V logic or level shifting.
#define ROBO_PRINTER_BAUD 9600
