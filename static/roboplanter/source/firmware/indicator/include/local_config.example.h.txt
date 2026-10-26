#pragma once
#define PLANTER_ENABLE_LOCAL_SOIL 0 // Requires opt-in RP2040 soil_uart.py responder.
// Copy to local_config.h and match the XIAO's serial startup information.
#define PLANTER_WIFI_SSID "RoboPlanter-XXXX"
#define PLANTER_WIFI_PASSWORD "planter-demo"
#define PLANTER_BASE_URL "http://192.168.4.1"
#define PLANTER_DEVICE_TOKEN "change-me-before-use"
// This is a bounded manual pulse, not an automatic watering policy.
#define PLANTER_WATER_DURATION_MS 2000
