"""Bench diagnostics for the original SenseCAP Indicator RP2040.

Run explicitly over USB REPL. No automatic LED activity on boot, no pump,
no ESP32 reset, and no claim that raw ADC equals calibrated soil moisture.
"""
import json
import time
from machine import ADC, Pin
import neopixel

VERSION = "0.1.0"


def emit(kind, **fields):
    fields["kind"] = kind
    fields["diagnostic_version"] = VERSION
    print(json.dumps(fields))


def sample(count=10, interval_ms=500):
    if not 1 <= count <= 120 or not 20 <= interval_ms <= 1000:
        raise ValueError("Invalid sample count or interval")
    # Same enable pin as Seeed's stock RP2040 firmware.
    Pin(18, Pin.OUT, value=1)
    a0, a1 = ADC(Pin(26)), ADC(Pin(27))
    time.sleep_ms(100)
    for index in range(count):
        emit("adc", index=index, adc_bits=12,
             gpio26_raw=a0.read_u16() >> 4, gpio27_raw=a1.read_u16() >> 4,
             note="GPIO27 is the left Grove yellow SIG. Connection unverified.")
        time.sleep_ms(interval_ms)


def led_test(pin, frame_pixels=60, level=8):
    # Caller must confirm physical wiring. Never drive an attached soil output.
    if pin not in (21, 27):
        raise ValueError("Use GPIO27 for left Grove or GPIO21 for right Grove")
    if not 1 <= frame_pixels <= 120 or not 1 <= level <= 16:
        raise ValueError("Diagnostic limit: 120 frame pixels; level 1..16")
    Pin(18, Pin.OUT, value=1)
    # The adjacent white lead is unused on WS2812 or BI on a WS2813 strip.
    # Hold the first pixel's backup input low instead of letting it float.
    Pin(pin - 1, Pin.OUT, value=0)
    strip = neopixel.NeoPixel(Pin(pin, Pin.OUT, value=0), frame_pixels)
    strip.fill((0, 0, 0))
    strip.write()
    time.sleep_ms(10)
    try:
        for cycle in range(2):
            for name, rgb in (("red", (level, 0, 0)),
                              ("green", (0, level, 0)),
                              ("blue", (0, 0, level))):
                strip[0] = rgb
                strip.write()
                emit("led_phase", pin=pin, cycle=cycle, color=name,
                     level=level, illuminated_pixels=1)
                time.sleep_ms(2000)
                strip[0] = (0, 0, 0)
                strip.write()
                time.sleep_ms(300)
    finally:
        strip.fill((0, 0, 0))
        strip.write()
        time.sleep_ms(10)
        Pin(pin, Pin.OUT, value=0)
        emit("led_off_sent", pin=pin,
             note="Command sent; visible light requires human confirmation.")


def info():
    emit("info", left_grove={"yellow": 27, "white": 26, "supply": "3.3V"},
         right_grove={"yellow": 21, "white": 20, "supply": "3.3V"},
         automatic_actions=False)
