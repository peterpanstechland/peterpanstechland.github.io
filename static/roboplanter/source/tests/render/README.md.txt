# Indicator native pixel preview

Run from the repository root:

```powershell
./tools/render-indicator-ui.ps1
```

Requires Visual Studio C++ Build Tools, the Arduino_GFX dependency installed by
the Indicator PlatformIO build, and Python with Pillow. Use `-Python PATH` or
`-OutputDirectory PATH` to override defaults. This script does not build or flash
device firmware and never opens a serial port.

The harness includes the real `firmware/indicator/src/main.cpp`,
`settings_ui.cpp`, `garden_ui.cpp` and `garden_art.cpp`, uses the production
header-only garden model, and links the real theme, text and photo code plus
generated native-size glyphs. It compiles the installed
Arduino_GFX `Arduino_G.cpp`, `Arduino_GFX.cpp`, and `Arduino_Canvas.cpp` unchanged.
Arduino, Preferences, display hardware, PWM, network/settings and garden storage
boundaries are stubbed. The garden store runs the real model in RAM only.
This keeps actual RGB565 clipping, shape rasterization, layout and font pixels.
The disconnected fixture leaves readings and actuator states unknown.

Output defaults to `build/indicator-preview-v3/`; the deployed v1 and v2 files in
`build/indicator-preview/` and `build/indicator-preview-v2/` are preserved, and the
tools reject both exact old output directories. The output contains 562 PNG
frame captures, nine GIFs and 17 contact sheets. It includes all eight themes on every Chinese page,
theme menus, disabled hardware controls, water/print confirmations, timer phases, PNG animation frames,
and eight theme animation GIFs. The default theme also has English captures of
all five pages, the theme menu, controls and both confirmations. Both languages
include settings, an empty Wi-Fi list, About, a sample list and all four keyboard
modes, plus virtual care, care feedback/cooldown, species and desk-mood panels.
The growth gallery covers all four species across all five stages.
`manifest.json` records source hashes, language, sample and game fixture flags,
capture times and the font format (493 characters at native 16/24/32/48/64 px).
The PNG pixels are lossless; GIF colors are palette limited. Start review with
`garden-growth-overview.png`, `zh-garden-overview.png`, `en-garden-overview.png`,
`zh-main-overview.png`, `en-main-overview.png`, `zh-settings-overview.png`,
`en-settings-overview.png`, then `all-themes-*.png` and the GIFs; individual frames are only for close
inspection. The confirmation modal is forced open for layout review with actions
still disabled, not evidence that an offline user could open it normally.
Theme GIFs sample 53 real code frames at 100 ms timestamps across the 5.3-second blink
cycle. This is host-simulated animation timing, not measured hardware FPS.
The plant body now keeps a fixed anchor; a single 260 ms blink window replaces
the earlier body sway, seed bob and short second blink. Peripheral sparkle and
care-feedback animation remain. The GIF samples this code at 100 ms intervals;
its timing does not prove LCD scanout stability.
`garden-growth.gif` assembles five actual home-screen captures, each held for
800 ms. It is a rose growth-stage catalogue, not actual gameplay progression speed.

Before capture, 40 host interaction assertions exercise the actual firmware
`handle()` and `TouchGate`: two-step water/print confirmation, repeat taps, swipe
cancellation, stale-state rejection and direct STOP through an uncertain-command
lock, plus opening settings, hidden-action isolation, settings swipes, language
switching and invalid-touch cancellation. Garden checks cover care actions and
cooldowns, seed feeding restrictions, independent species progress, mood selection,
overlay isolation, and the completed 25-minute focus reward. They check reward
deduplication, exclude break timers, and cover a reset released at the completion
deadline. The original 11 hardware-action assertions are retained. A further 44
assertions validate the imported virtual stage fixtures and their resulting stages.
Another 84 pixel assertions cover fixed plant/pot anchors across all four species
and five stages, plus a visible blink spanning multiple nominal frames without a
second short blink. Eighteen bilingual settings images remain pixel-identical to
the v2 preview, and the Chinese/English garden layouts were visually reviewed.
Six additional checks inject one failed frame handoff into the production loop:
rendering becomes unavailable, the failure is logged once, and subsequent loop
calls yield without accessing, changing or presenting the framebuffer. This
tests the main-loop failure policy; the host does not emulate VSYNC or DMA.
Only the isolated interaction phase enables a counting submit stub; the render
phase throws if any action is attempted. Network/device implementations remain
unexecuted, and no fake sensor values are placed in screenshots or firmware.

The game gallery imports explicit local-game snapshots through the real model's
validation API. These snapshots demonstrate virtual health, mood and growth;
they do not claim real botanical progress or sensor measurements. The RAM-only
garden store never reads or writes the device's NVS. Persistence and recovery
are covered separately by the garden model/store tests, not by framebuffer images.

The settings backend is a clearly marked host-only sample fixture: its only
network name is the literal `example`. No real adapter scan, network request,
password, NVS store or production backend is used. An attempted connection throws
even at the mock boundary. Backlight changes update a number rather than hardware.
The independently tested production settings UI is still the code drawing and
handling each captured panel; its backend is the simulated part.

These are native code captures, not photographs of the physical display. They
cannot verify RGB scanout timing, PSRAM/DMA flicker, backlight, real touch input,
network behavior or device frame rate. Re-run after UI or generated-font edits.
`-CompileOnly` checks the native harness build without generating captures.
The v3 firmware has separate device checks on COM13. Earlier revisions still
received occasional-flicker feedback; host screenshots cannot settle that issue.
See the [current double-buffer deployment record](../../docs/deployment/indicator-vsync-double-buffer.md)
and [earlier v3 record](../../docs/deployment/indicator-garden-ui.md).
