# Portable controller tests

This test executable exercises the same header used by the ESP32 firmware. It has no Arduino dependencies and does not access hardware or open network connections.

`tools/test-core.ps1` also runs `sen54_tank_test.cpp`: the documented CRC vector,
corrupted/truncated SEN54 frames, signed temperature, unavailable/warmup values,
transport/readiness failures, ultrasonic range, tank calibration, low water,
stale/missing echo, obstruction, timer rollover, and no pump restart on replay.
These tests do not establish acoustic reliability inside a real water tank.

With GCC or Clang, from the repository root:

```sh
g++ -std=c++11 -Wall -Wextra -Werror -pedantic tests/core/controller_test.cpp -o controller_test
./controller_test
```

With MSVC in a developer command prompt:

```bat
cl /std:c++14 /EHsc /W4 tests\core\controller_test.cpp /Fe:controller_test.exe
controller_test.exe
```

Coverage includes pump timeout and millis rollover, stable retry results, conflicting request IDs, explicit stop, disabled outputs and unchanged/default credentials, duration overflow, unsupported commands, pump/printer interlock, print completion/failure, calibration, and fail-closed cache exhaustion. These host checks cannot establish electrical safety, real timer jitter, GPIO routing, Bluetooth compatibility, or successful paper output; those require the documented physical bench checks.

## Indicator presentation model

Run `tools/test-indicator-ui.ps1` on Windows, or compile `tests/core/indicator_ui_test.cpp` with a C++17 compiler. Its 99 assertions cover release-only taps, swipe/tap separation, invalid-touch cancellation, page boundaries, theme overlays, pause/resume/completion, timer wraparound, and theme/navigation independence. It shares `firmware/indicator/include/ui_model.h` with the actual firmware; LCD/touch hardware and networking remain separate bench checks.

## WS2812 frame model

The optional soil relay has a separate portable check:

```sh
g++ -std=c++11 -Wall -Wextra -Werror -pedantic tests/core/soil_relay_test.cpp -o /tmp/roboplanter-soil-relay-test
/tmp/roboplanter-soil-relay-test
```

It checks UART challenge/CRC corruption, invalid ranges, duplicate uploads not renewing freshness, boot changes and timer rollover. Real UART wiring, HTTP transmission and sensor response remain hardware acceptance steps.

The opt-in one-use read session has its own portable check:

```sh
g++ -std=c++11 -Wall -Wextra -Werror -pedantic tests/core/diagnostic_read_session_test.cpp -o /tmp/roboplanter-one-read-test
/tmp/roboplanter-one-read-test
```

It covers key format, lifetime limits, wrong-key isolation, one-use consumption, explicit clearing, expiry and timer rollover. Real BLE response delivery and platform handling require a phone test.

```sh
g++ -std=c++11 -Wall -Wextra -Werror -pedantic tests/core/light_effects_test.cpp -o /tmp/roboplanter-light-test
/tmp/roboplanter-light-test
```

The pure frame model covers effect parsing, green/capped colour output, a one-pixel chase fallback, off, unchanged snapshots, and unsigned timer rollover. Controller tests also check optional light effects, invalid/off fields, and omitted-versus-explicit solid idempotency. These do not validate physical LEDs, electrical current or scheduler timing.
