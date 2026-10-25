# RoboPlanter XIAO firmware

Standalone firmware for the supplied **XIAO ESP32-S3 Plus + XIAO Robot Board V1.0**. It does not run or reuse the original car control loop. It provides authenticated HTTP and Bluetooth commands, actual optional sensor measurements, an independently timed external pump output, WS2812 control, and optional UART text transmission.

The supplied configuration disables **all sensors and actuators**. Disabled measurements are `null` with `valid:false`; the firmware does not invent readings. Actions also remain disabled until both `ROBO_ENABLE_ACTIONS=1` and a nondefault 16–64 character device token are configured. A compiled binary is not evidence that the connected hardware has been tested.

## Build

Dependencies are pinned in `platformio.ini`: Espressif32 6.12.0 (Arduino ESP32 2.0.17), ArduinoJson 6.21.5, Adafruit NeoPixel 1.12.3. Wi-Fi, WebServer, BLE, Wire, HardwareSerial and FreeRTOS come from the Arduino core. SHT31 reads use Wire and verify the sensor's CRC directly.

```sh
cd firmware/xiao
pio run
```

The generic ESP32-S3 DevKitC target is overridden for the XIAO Plus **16 MB flash / 8 MB OPI PSRAM** and USB CDC. The custom partition table covers 16 MB and reserves two 6 MB application slots; no OTA service is implemented. USB upload is deliberately a separate manual step after checking the wiring and configuration; this project does not flash a device automatically.

Copy `include/config.local.example.h` to `include/config.local.h`, then set only options corresponding to verified hardware. Keep that local file private. Do not commit real tokens. Runtime configuration is compiled in, so changes require a rebuild and deliberate upload.

## Wiring assumptions and supported peripherals

These assignments follow the supplied `XIAO Robot Board_V1.0.pdf`, especially pages 5–6. Connector pin numbers are schematic numbers, **not a promise of left-to-right order when looking at the board**. Check silkscreen, orientation and continuity. Use the signal net and a shared ground; do not infer a sensor supply from a neighbouring connector pin.

| Function | GPIO / board net | Actual implementation and constraints |
| --- | --- | --- |
| Soil moisture | GPIO1 / D0 / Servo3 J13 signal | 12-bit ADC, eight-read average. Enable only after confirming an analog-output sensor and 0–3.3 V signal. Configure dry/wet raw values to obtain a relative percentage. |
| External pump driver | GPIO7 / D8 / Servo4 J14 signal | Active-high logic output to a separate 12 V-rated MOSFET driver. Requires `ROBO_ENABLE_PUMP` and `ROBO_PUMP_HARDWARE_CONFIRMED`. |
| Air sensor | GPIO8 / D9 / Servo2 J5 signal | Optional raw ADC only, with the servo disconnected and voltage conditioning if required. Requires `ROBO_AUX_PINS_CONFIRMED`. No AQI or pollutant concentration is calculated. |
| UV sensor (experimental spare) | GPIO9 / D10 / M2 encoder B | Encoder must be disconnected. Board has a **4.7 kΩ pull-up to 3.3 V**, which loads an analog sensor and changes its transfer curve. Disabled by default; not a validated UV measurement or recommended final wiring. |
| SHT31 | SDA GPIO5 / D4, SCL GPIO6 / D5 | Optional SHT31 at address 0x44 (configurable). Genuine temperature/humidity and CRC checks; this is not an autodriver for unspecified Grove DHT/AHT sensors. |
| WS2812 strip | GPIO40 / D13 / Grove RGB | Optional GRB 800 kHz strip, configurable count and limited brightness; solid green, four-second breathing, green chase and twelve-second rainbow modes. Not a photosynthetically calibrated grow light. |
| Thermal printer | GPIO43 / D6 TX, GPIO44 / D7 RX / UART J10 | Optional hardware UART 8N1, configurable baud. Requires `ROBO_ENABLE_PRINTER` and `ROBO_PRINTER_HARDWARE_CONFIRMED`. Only verified ASCII line text, at most 160 bytes; no Chinese encoding, cutter, paper status or ESC/POS commands. |

On the supplied V1.0 schematic, J13/J14/J5 pin 1 is the signal, pin 2 is NC, pin 3 is Motor5V, and pin 4 is GND. The firmware does not use Motor5V as a sensor supply. I²C J11/J12 pin 1 is SCL GPIO6, pin 2 SDA GPIO5, pin 3 3.3 V, pin 4 GND. UART J10 pin 1 is TX43, pin 2 RX44, pin 3 3.3 V, pin 4 GND. Verify the exact board revision before using these references.

The original robot firmware and tutorial disagree about some motor/heater assignments. This firmware drives GPIO2/3/39/11/12 low at startup to disable the documented motor/heater nets and never issues movement commands. Battery sensing on GPIO4 is not sampled. There is no camera driver: the Plus board's expansion connector is not compatible with the standard XIAO ESP32-S3 Sense plug-in camera board. There is no Wio Terminal / SenseCAP Indicator driver in this firmware; those devices can consume the HTTP API through their own software.

### 12 V pump and printer

Use properly sized external 12 V power distribution. **Do not attach a 12 V pump to the Robot Board's 5 V motor outputs, and do not feed 12 V into XIAO/Robot Board 3.3 V, 5 V or battery pins.** The pump needs an external driver rated for its startup current, an appropriate flyback diode/protection for the motor, a common logic ground, and a gate/input pull-down that keeps the driver OFF during boot and reset. GPIO7 is only a logic signal. The firmware assumes active-high polarity; do not enable an active-low driver without adapting and checking the implementation. A physical power cutoff remains necessary for bench testing.

A printer's **12 V supply rating does not specify its TTL voltage**. Confirm baud, UART protocol, logic levels and current from its actual label/manual. Protect the ESP32's RX from any output above 3.3 V and verify the printer recognises a 3.3 V TX, or use appropriate level shifting. Do not power it from the UART connector's 3.3 V rail. USB-only printer operation is not implemented. `bytes_sent` means the UART peripheral finished transmitting; there is no paper or print-success feedback.

The pump and printer are mutually exclusive to reduce simultaneous load. This does not replace a correctly sized supply. The local pump cap defaults to 3,000 ms and may be set to 1–30,000 ms only after measuring flow. A priority-10 FreeRTOS task checks the pump deadline every 10 ms; HTTP processing, sensor delays and printing do not hold that task's mutex. This is software timing with scheduler/GPIO jitter, not a certified hardware cutoff. A frozen MCU, failed driver or stuck relay requires separate hardware protection.

### Sensor validity

Every configured analog sensor reports the measured ADC count. `valid:true` means a configured ADC was sampled recently and returned a count in 0–4095; both endpoints are allowed (for example, zero can be a legitimate dark UV reading). This does **not** detect clipping, floating inputs, unplugged sensors or electrical faults. It is not proof of connection or calibration. Check sensors against known conditions on the bench. Soil percentage is a clamped linear **relative wetness index**, not volumetric water content. Without two distinct 0–4095 calibration points, `percent` is null. Air/UV readings remain raw counts; warmup, load, sensor model and voltage requirements must be checked separately. The Grove Air Quality v1.3 or UV v1.1 name alone does not justify connecting an unknown voltage directly to the ESP32. Samples older than 3 seconds are invalidated in HTTP; BLE sensor queries return `E:STALE`. Raw ADC values remain available in HTTP for diagnostics.

## HTTP API

At boot the board creates `RoboPlanter-XXXX` (MAC-derived suffix), default Wi-Fi password `planter-demo`, with HTTP at `http://192.168.4.1`. Change the AP password for use outside a controlled demonstration. Every state or command request must send `X-Device-Token`. The default token is `change-me-before-use`, which allows inspection of disabled state but cannot enable any action.

`GET /api/v1/state` returns the frozen schema:

```json
{
  "schema_version": 1,
  "device_id": "RoboPlanter-XXXX",
  "uptime_ms": 0,
  "sample_age_ms": 0,
  "soil": {"raw": null, "percent": null, "valid": false, "calibrated": false},
  "air": {"raw": null, "valid": false},
  "uv": {"raw": null, "valid": false},
  "environment": {"temperature_c": null, "humidity_pct": null, "valid": false},
  "pump": {"enabled": false, "on": false, "remaining_ms": 0},
  "light": {"enabled": false, "on": false, "effect": "solid"},
  "printer": {"enabled": false, "status": "disabled"},
  "last_command": {"request_id": "", "status": "none", "error": ""}
}
```

Values above show schema/defaults, not a captured device reading. Sensors are sampled once per second; `sample_age_ms` is time since the last sampling cycle, including an empty cycle when all sensors are disabled. Actuator `enabled` means the peripheral flag, explicit action flag and configured credential gate all permit that action; temporarily busy peripherals may still reject a command.

`POST /api/v1/command` requires `Content-Type: application/json`. Maximum body is 512 bytes, request ID is 1–32 ASCII letters/digits/`_`/`-`. Only applicable fields are accepted:

```json
{"request_id":"dose001","action":"water","duration_ms":1000}
{"request_id":"stop001","action":"stop_water"}
{"request_id":"light001","action":"light","on":true}
{"request_id":"light002","action":"light","on":true,"effect":"breath"}
{"request_id":"print001","action":"print","text":"Plant check: soil 48%"}
```

`effect` is optional only for `light` with `on:true`: `solid`, `breath`, `chase` or `rainbow`. Omission means `solid`; `on:false` forbids `effect` and resets mode to `solid`. Omitted/explicit `solid` are the same idempotent request. A different effect under the same ID conflicts. HTTP state adds `light.effect`; old clients may ignore it.

A priority-1 task renders every 40 ms without holding the controller mutex during NeoPixel output. OFF clears the strip synchronously before the command returns; it does not wait for an animation cycle. All modes keep the configured brightness cap. A one-LED chase falls back to breathing. Lights start OFF after reboot, are not persisted, and retain their mode on a network disconnection. Timing and power must still be checked on real hardware. See the [lighting tutorial](../../docs/handbook/ws2812-lighting.md).

Responses are `{ "ok": true|false, "request_id": "...", "status": "accepted"|"completed"|"rejected", "error": "..." }`. Water and queued print return 202/accepted. Stop/light return 200/completed. Invalid or rejected commands return a 4xx response. Printing accepts printable ASCII and LF; raw control codes and unverified multibyte encodings are rejected.

`GET /api/v1/result?request_id=dose001` uses the same token header and looks up that request without executing it again. A found record returns HTTP 200 with the same result structure, whether accepted, completed or rejected. An unknown ID returns 404 with `error:"request_not_found"` and the requested ID; an invalid ID returns 400. Poll this endpoint for a specific pending command, because another client's command may replace `state.last_command`. Retrying the **same** POST also retrieves its saved result, but must not be used to replay an uncertain action across a device restart.

Idempotency is shared between HTTP and BLE. A request ID with the same normalized action and arguments returns its saved result without repeating the operation. A different payload using that ID is rejected. This includes saved business rejections such as `pump_busy`: after resolving the issue, use a **new** ID for a new intent. The 64-entry cache never evicts within a boot; once full it rejects new actions until restart, while authenticated `stop_water` remains available with a fresh ID. Retries after a restart are **not** deduplicated because the cache is RAM-only; do not automatically replay an uncertain watering/printing request across device restarts. `uptime_ms` lets the client detect a restart. `last_command` is the most recently handled business command, not a historical command list.

The plain HTTP service is local and has no TLS. The network/token model is intended for a controlled prototype, not exposure to the Internet. Tokens must not be placed in prompts, logs or public Skill examples.

## BLE protocol (version 1)

- Service: `a2f39c10-7e4b-4d21-8a61-0f3bc9d15001`
- Characteristic: `a2f39c11-7e4b-4d21-8a61-0f3bc9d15001`
- Properties: write with response, notify. Enable notifications before writing.
- Each request is a single UTF-8/ASCII write, maximum 240 bytes, with a token on **every** request. Delimiter is `|`; token and print text must not contain it.
- BLE request IDs are 1–8 ASCII letters/digits/`_`/`-`; HTTP supports 32.
- Server advertises preferred MTU 247. Requests containing a 16–64 character token usually exceed default MTU 23's 20-byte payload. The client must negotiate sufficient MTU or implement an ATT long write. Whether HONOR's BLE tool handles this must be verified on the actual phone; it is not proven by a build.
- Each response is exactly one notification of **at most 20 bytes**. No client-side fragment assembly is required or assumed. Send requests sequentially and wait for the response before the next query.
- Only one BLE connection owns the command channel. Queued writes and notifications carry that connection's generation; disconnect discards queued/partial writes, and a reused connection ID cannot receive an old reply. Notifications are explicitly addressed to the owning connection and require its own subscription. An already accepted action still follows the local pump deadline or print task; disconnect is not an actuator stop or evidence that an action did not execute.
- Existing ATT prepare/execute writes use a separate bounded buffer with contiguous offsets, tied to the same connection generation. Cancellation, disconnect, invalid fragments and mismatched generations cannot commit a command. This adds no application fragmentation protocol and does not establish whether the HONOR client supports long writes.
- Library limitation: Arduino 2.0.17 processes prepare fragments before its public event hook, accumulating an internal copy that this application cannot clear through a public API. That internal accumulation is not bounded by the application's 240-byte limit and is not cleared by disconnect. The session-owned buffer prevents those residual bytes from becoming a business command, but malicious repeated prepare writes can still exhaust BLE-stack heap. Fixing that resource limit requires a reviewed library patch or replacement; this build does not claim memory-exhaustion resistance against untrusted BLE clients.
- No BLE pairing/encryption policy is implemented. The action token prevents unauthenticated commands but is visible to a suitably positioned BLE observer; restrict use to the controlled prototype and rotate exposed credentials.

| Request | Response format | Meaning |
| --- | --- | --- |
| `S\|token\|soil` | `S:raw:percent:valid:calibrated` | `x` means unavailable; percentage rounded to an integer. |
| `S\|token\|air` | `A:raw:valid` | Raw ADC. |
| `S\|token\|uv` | `U:raw:valid` | Raw ADC; board pull-up caveat applies. |
| `S\|token\|env` | `E:temp:humidity:valid` | One decimal place; `E:x:x:0` unavailable. |
| `S\|token\|pump` | `P:enabled:on:remaining_ms` | Booleans are `0` or `1`. |
| `S\|token\|light` | `L:enabled:on` | Current commanded light state. |
| `S\|token\|printer` | `T:enabled:status` | Status `off`, `idle`, `queued`, `sent`, or `fail`. |
| `S\|token` | `Q:soil,pump,air,uv` | Short query hint; other supported fields are listed above. |
| `R\|token\|id` | `A:id`, `D:id`, or `E:id:code` | Look up a cached request without submitting it again. `MISS` means not in this boot's cache. |
| `C\|token\|id\|water\|1000` | `A:id` or error | Duration in whole milliseconds. |
| `C\|token\|id\|stop_water` | `D:id` or error | Authenticated stop; available even with actions disabled. |
| `C\|token\|id\|light\|1` | `D:id` or error | Use `1` for on, `0` for off. |
| `C\|token\|id\|light\|1\|breath` | `D:id` or error | Optional sixth field: `solid`, `breath`, `chase`, `rainbow`; only with `1`. |
| `C\|token\|id\|print\|Hello plant` | `A:id` or error | ASCII only; at most 160 text bytes and 240 total request bytes. |

`A` means accepted/pending, `D` means completed. Command errors are `E:id:code`; malformed or unauthenticated messages can return `E:FORMAT`, `E:AUTH`, `E:SIZE`, `E:FIELD`, or `E:BUSY` without an ID. `E:STALE` means the sensor sampling cycle is older than 3 seconds; do not interpret that response as a current measurement. Business codes: `LOCK` actions/token not configured; `OFF` peripheral disabled; `BUSY` pump/printer busy; `ID` reused ID with conflicting payload; `FULL` dedupe cache full; `TIME` invalid duration; `IO` UART transmit failed; `ACT` unknown action; `ARG` invalid fields; `MISS` lookup not found. The characteristic is not readable, so a different client cannot read a previous notification from an unauthenticated read operation.

## Bring-up and verification

1. Build defaults and connect only the XIAO/Robot Board by a known safe supply. Read HTTP/BLE disabled state and confirm motors, heater and pump output remain low. Do not use the old car firmware.
2. Verify the exact sensor types, signal voltages and connector orientation. Enable one sensor at a time. Check physically meaningful raw changes before calibrating soil. Use SHT31 only if that chip is actually present.
3. With the pump disconnected, check the external driver's active-high polarity and off-at-reset behaviour using a meter. Then verify the 12 V supply, startup current, diode/protection and measured flow. Configure confirmation flags, a short local time cap, new device/AP credentials, and explicit action enable.
4. Test a short pulse, automatic timeout, explicit stop, HTTP/BLE replay and conflicting-ID rejection with the physical cutoff available. Deliberately hold an HTTP connection open during a pulse and confirm the independent stop still occurs. Test resets separately; the pull-down must keep the pump off.
5. Enable the verified printer separately. Check voltage/baud and an ASCII line; distinguish UART `sent` from actual paper success. Finally test pump/printer interlock.
6. Confirm HONOR client UUID selection, notifications, request MTU/long-write behaviour, short-response parsing and disconnect/reconnect before claiming end-to-end BLE integration. No HONOR integration is inferred from compilation alone.

Portable control tests are in `tests/core/`. They test the shared control logic without hardware. Electrical checks and live BLE/HTTP/print tests remain separate acceptance criteria.

## Recorded build verification

On 2026-10-24, the default-disabled configuration including the BLE connection-generation boundary built successfully with the pinned PlatformIO dependencies. The final compiler run reported no errors or warnings: internal RAM 78,172 / 327,680 bytes (23.9%); application flash 1,361,145 / 6,291,456 bytes (21.6%). Generated `firmware.bin` is 1,361,504 bytes at `.pio/build/xiao_robot_board/firmware.bin`. It is the application image, not a complete merged factory image. The portable suite passed 267 checks under MSVC, including disconnected/reused BLE connection IDs and bounded ATT prepared-write ownership. No firmware was flashed, and no electrical, timing, radio, sensor or printer bench result is claimed by these build checks.
