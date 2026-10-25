# Portable controller tests

This test executable exercises the same header used by the ESP32 firmware. It has no Arduino dependencies and does not access hardware or open network connections.

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
