"""Opt-in original Indicator internal UART soil responder; never drives LEDs."""
from machine import Pin, ADC, UART
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
    overflow = False
    print("RoboPlanter soil UART responder ready; GPIO27 ADC12; no actuators")
    while True:
        data = uart.read(64)
        if data:
            for byte in data:
                if byte == 10:
                    request = bytes(pending)
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
