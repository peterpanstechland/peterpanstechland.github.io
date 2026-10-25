#pragma once
#if __has_include("local_config.h")
#include "local_config.h"
#endif
#ifndef PLANTER_WIFI_SSID
#define PLANTER_WIFI_SSID "RoboPlanter-XXXX"
#endif
#ifndef PLANTER_WIFI_PASSWORD
#define PLANTER_WIFI_PASSWORD "planter-demo"
#endif
#ifndef PLANTER_BASE_URL
#define PLANTER_BASE_URL "http://192.168.4.1"
#endif
#ifndef PLANTER_DEVICE_TOKEN
#define PLANTER_DEVICE_TOKEN "change-me-before-use"
#endif
#ifndef PLANTER_WATER_DURATION_MS
#define PLANTER_WATER_DURATION_MS 2000
#endif
constexpr unsigned kHttpTimeoutMs = 1500;
constexpr unsigned kPollIntervalMs = 1000;
constexpr unsigned kStaleMs = 5000;
constexpr unsigned kCommandResolveMs = 15000;
static_assert(PLANTER_WATER_DURATION_MS > 0 && PLANTER_WATER_DURATION_MS <= 10000,
              "Manual watering pulse must be 1..10000 ms");
