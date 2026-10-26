# Temporary XIAO RGB bench test

For XIAO ESP32-S3 Plus on Robot Board V1.0, using the J7 Grove RGB connector.
GPIO40 / D13 controls the board's buffered data output. The RGB socket is
powered from VSYS_5V; use the **Robot carrier board's USB-C input and power
switch**, as the XIAO module's own USB supply is isolated from that rail.
Confirm the board revision and disconnect other actuators for this bench test.

This is a temporary test image, not the RoboPlanter application or the existing
robot bridge. Before flashing, save the **complete 16 MiB flash** from the actual
target and verify it. Keep the backup private in `build/device-backups/`.
Restore and verify that full backup when the LED test is finished.

```sh
pio run -d firmware/xiao-led-diagnostics
```

The program boots with the strip off. Through its USB serial port at 115200,
send an ASCII line ending in LF:

- `INFO`: firmware identity and fixed test settings.
- `TEST`: scan pixels 1–10 in red, green, then blue, one lit pixel at a time,
  level 24/255, then off after approximately 26 seconds.
- `TESTV5`: an alternative timing candidate; not hardware-tested in this session.
- `OFF`: immediately clear the strip and stop the sequence.

The sequence uses the main loop and also stops on USB serial disconnect.
There are no motor, heater, servo, pump, printer, Wi-Fi, or BLE initialization
calls. Commands outside the lines above are ignored. GPIO40 is the only
explicitly configured application output. The 60-pixel frame does not detect
the strip length. Output reports requested colors, not visible-light feedback;
a person must observe whether the LEDs actually light.

On 2026-10-26, version 0.1.0 used Adafruit NeoPixel 1.12.3, GPIO40, level 8,
and the first pixel only. The commands completed, but the user reported no
visible light. Version **0.2.0 passed the bench light test**: all 30 phases and
the final off frame completed, and the user confirmed visible red/green/blue
moving pixels. Only the normal `TEST` timing profile was exercised. This does
not isolate whether timing, brightness, or the choice of pixel caused the
previous failure, as these variables changed together.

The proven profile uses direct ESP32 RMT at 10 MHz: zero high/low = 0.3/0.9 us,
one high/low = 0.9/0.3 us, then 300 us low. These values match the actual
bundled `main/rgb_led.c` and the older WS2813 timing table. RMT initialization,
submission, and completion return codes are checked. The bundled header's
GPIO41 comment conflicts with its implementation; both the schematic and
the implementation use **GPIO40**, which is the pin tested successfully.

The photographed strip has DI/BI and DO/BO markings, consistent with a
WS2813-type main/backup data pair, rather than a separate clock input. The
exact chip revision has not been read from a label. Carrier J7 pin 2 is NC in
the supplied schematic. The existing connector arrangement was successful
without an added BI wire; its BI voltage was not measured. Do not infer a
universal BI wiring rule from this particular test.

Before flashing, a complete 16 MiB backup matched the target's flash digest.
The carrier USB input, ON switch, RGB socket, and disconnected other actuators
were confirmed by the user; actual rail voltage was not measured with a meter.
The original bridge firmware is restored and checked after temporary testing.

The original reference schematic is the user-supplied
`XIAO Robot Board_V1.0.pdf`, pages 3–5: USB supply, power mux / switch, XIAO
supply isolation, and J7 RGB buffer. Do not infer that USB enumeration alone
proves the RGB rail is powered.

Timing reference: [Worldsemi WS2813-Mini datasheet hosted by Seeed](https://files.seeedstudio.com/wiki/Grove-RGB_LED_Ring-20-WS2813Mini/res/WS2813-Mini.pdf),
page 3. The main RoboPlanter application's NeoPixel driver has not yet been
replaced by this separately verified bench driver.
