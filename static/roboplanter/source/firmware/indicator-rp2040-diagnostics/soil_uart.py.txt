"""Opt-in original Indicator internal UART soil responder; never drives LEDs."""
from machine import Pin, ADC, UART, PWM
import time


def crc(data):
    value = 0xffff
    for byte in data:
        value ^= byte << 8
        for _ in range(8):
            value = ((value << 1) ^ 0x1021 if value & 0x8000 else value << 1) & 0xffff
    return value


def serve():
    Pin(18, Pin.OUT, value=1)
    adc = ADC(Pin(27))
    uart = UART(0, baudrate=115200, tx=Pin(16), rx=Pin(17), timeout=0)
    pending = bytearray()
    buzzer = PWM(Pin(19))
    buzzer.duty_u16(0)
    chime_until = None
    last_chime = time.ticks_add(time.ticks_ms(), -2000)
    overflow = False
    print("RoboPlanter soil UART responder ready; GPIO27 ADC12; optional GPIO19 focus chime")
    try:
        while True:
            if chime_until is not None and time.ticks_diff(time.ticks_ms(), chime_until) >= 0:
                buzzer.duty_u16(0)
                chime_until = None
            data = uart.read(64)
            if data:
                for byte in data:
                    if byte == 10:
                        request = bytes(pending)
                        if not overflow and request == b"B|focus" and time.ticks_diff(time.ticks_ms(), last_chime) >= 2000:
                            buzzer.freq(2400)
                            buzzer.duty_u16(8192)
                            last_chime = time.ticks_ms()
                            chime_until = time.ticks_add(last_chime, 180)
                        if not overflow and len(request) == 10 and request[:2] == b"S|" and all(
                                c in b"0123456789abcdef" for c in request[2:]):
                            raw = sum(adc.read_u16() >> 4 for _ in range(8)) // 8
                            body = b"R|" + request[2:] + b"|" + str(raw).encode()
                            uart.write(body + ("*%04x\n" % crc(body)).encode())
                        pending = bytearray()
                        overflow = False
                    elif byte != 13:
                        if len(pending) < 32:
                            pending.append(byte)
                        else:
                            overflow = True
            time.sleep_ms(2)
    finally:
        buzzer.duty_u16(0)
        buzzer.deinit()
