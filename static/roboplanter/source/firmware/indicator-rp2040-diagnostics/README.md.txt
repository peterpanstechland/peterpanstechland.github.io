# Indicator RP2040 bench diagnostics

This is a USB-operated diagnostic module for the **original SenseCAP Indicator
D1**, running on MicroPython RPI_PICO 1.29.0. It is separate from the ESP32-S3
screen application. It does not implement the production UART/COBS sensor
bridge, YOYO integration, irrigation, or calibrated moisture. The separate
opt-in `soil_uart.py` responder added for two-board testing uses the internal
UART and a custom challenge/CRC protocol; it is not the stock COBS protocol.

## Optional two-board soil responder

Back up the ESP32 and RP2040 separately before installing integration firmware.
Copy `soil_uart.py` to the MicroPython filesystem. Preserve any existing
`main.py`, then explicitly opt in with:

```python
import soil_uart
soil_uart.serve()
```

This enables Grove sensor power on GPIO18 and samples only GPIO27. UART0 uses
RP2040 TX16 / RX17 at 115200 baud. It replies only to `S|<8 lowercase hex>\n`
with `R|<same challenge>|<ADC12 raw>*<CRC16-CCITT>\n`. CRC starts at `0xffff`
and covers the bytes before `*`; it is encoded as four lowercase hex digits.
There is no LED test, calibration percentage, pump or printer operation in
this responder. A USB REPL interrupt stops sampling; a soft restart resumes
`main.py`. The screen firmware must separately enable its local soil path;
see [Indicator instructions](../indicator/README.md#optional-local-soil-relay).

## Wiring

Face the device's back, with its label upright and the sockets below it:

- Left Grove: capacitive analog moisture probe; yellow SIG = RP2040 GPIO27,
  white = GPIO26. Both signal pins are ADC-capable.
- Middle: USB-C to the computer.
- Right Grove: diagnostic addressable LED output; yellow DIN = GPIO21,
  white = GPIO20. The test holds the white wire low for WS2813 BI / unused
  WS2812 input. Confirm this wire mapping against the actual strip before use.
- Both Grove power pins are **3.3V**. A successful low-brightness experiment
  would not qualify a nominal 5V strip for full-strip operation from this rail.
  A proper 5V supply must not be fed back into the Grove 3V3 pin; use common
  ground and suitable data-level translation when required by the strip.

The blue Grove Capacitive Moisture Sensor (Corrosion Resistant) measures
relative soil moisture, not temperature. Keep its connector and components
dry; only the blade below the printed limit may touch moist material.

## Preserve the existing firmware first

Identify the RP2040 separately from the Indicator's CH340 / ESP32 serial
interface. The stock Arduino-Pico USB serial supports a 1200-baud touch to
enter BOOTSEL. Its BOOTSEL USB identity differs from its application identity;
verify the physical USB path and flash ID before writing.

Using official `picotool`, in BOOTSEL:

```sh
picotool info -a --bus <bus> --address <address>
picotool save -a -v original-full.uf2 --bus <bus> --address <address>
```

Proceed only after the full-flash save and verification succeed. Keep this
backup private: it can contain settings and credentials. This repository's
`build/device-backups/` is excluded from Git and public starter packages.
The tested board has 2 MiB flash; a full UF2 backup occupies 4 MiB.

The diagnostic runtime is the official
[MicroPython RPI_PICO 1.29.0 UF2](https://micropython.org/resources/firmware/RPI_PICO-20260824-v1.29.0.uf2).
The downloaded artifact used for this test has SHA256
`e1160e602e277d85920adb5fe741435edccba9ba6ecadc85fdab75252eeff4e9`.

```sh
picotool load -v -x RPI_PICO-20260824-v1.29.0.uf2 --bus <bus> --address <address>
```

The runtime replaces the RP2040 program. It does not replace ESP32 firmware.
An unformatted MicroPython filesystem may be initialized at first boot, which
is another reason the full-flash backup must precede the upload.

## Install and run

Use a Python environment with `pyserial`. Run from the repository root;
substitute the verified target's USB serial number for `<serial>`:

```sh
python tools/indicator_diagnostic_cli.py --serial-number <serial> install
python tools/indicator_diagnostic_cli.py --serial-number <serial> info
python tools/indicator_diagnostic_cli.py --serial-number <serial> sample --count 20
python tools/indicator_diagnostic_cli.py --serial-number <serial> led-test --pin 21 --level 8
```

The installer checks the module hash and reads the saved file back. Nothing
automatically lights on boot. `led-test` requires confirmed wiring: GPIO21 for
the right socket or GPIO27 for the left socket. Never select a socket with an
analog sensor attached. The test addresses one pixel at level 8/255, cycles
red/green/blue twice, then sends an all-off frame in a `finally` block. The
60-pixel frame length is a transmission setting, not a detected strip length.

`sample` emits **12-bit raw ADC values**. The stock Arduino log previously used
a different scale; do not compare its numbers directly. Do not convert these
diagnostic values into a moisture percentage. Record confirmed dry/wet states,
allow readings to settle, and repeat after drying. A floating ADC also returns
numbers, so nonzero output alone is not proof that the probe works.

On 2026-10-26, after the user confirmed the corrected left-socket wiring,
the moist-tissue stable sample had 20 readings in 1557–1655 (median 1583).
After removing the tissue and wiping the blade dry, the later 10 readings
were 2447–2498 (median 2456.5). This establishes a moisture response in the
expected direction for that bench session. The first air sample near 574 was
inconsistent and is excluded from calibration; its cause is unresolved. No
calibrated soil-water percentage or long-term reliability claim follows.

`led_phase` and `led_off_sent` mean the program executed the commands. These
strips do not return an optical acknowledgement; a human must confirm visible
light and color. The first test on 2026-10-26 completed normally, but the user
reported **no visible light**. The LED has not passed hardware acceptance.

## Restore

In the MicroPython USB REPL, run `import machine; machine.bootloader()` (or use
the board's physical BOOTSEL procedure). Identify its new bus/address again:

```sh
picotool info -a --bus <bus> --address <address>
picotool load -v -x original-full.uf2 --bus <bus> --address <address>
```

This restores the complete original RP2040 flash, including its filesystem.
Verify that the original USB identity and `grove adc:` logs return. The stock
log reader is `tools/indicator_grove_probe.py`; it does not parse MicroPython
diagnostic JSON.

Sources: [Seeed Grove ADC and port diagram](https://wiki.seeedstudio.com/SenseCAP_Indicator_RP2040_Grove_ADC/),
[Seeed Grove I2C](https://wiki.seeedstudio.com/SenseCAP_Indicator_RP2040_Grove_IIC/),
[capacitive probe](https://wiki.seeedstudio.com/Grove-Capacitive_Moisture_Sensor-Corrosion-Resistant/),
[MicroPython Pico](https://micropython.org/download/RPI_PICO/),
[official picotool](https://github.com/raspberrypi/picotool).

## Optional focus chime (2026-10-29)

The soil responder also accepts `B|focus\n` from the internal UART. It drives the built-in passive buzzer on GPIO19 at 2400 Hz for 180 ms, non-blocking, at most once per two seconds. The Indicator UI keeps this off by default and persists its sound toggle. PWM is disabled on interruption/exit. This is a tone, not a speech speaker. See [the integration record](../../docs/deployment/yoyo-companion-v2.md) for validation limits.
