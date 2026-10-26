#!/usr/bin/env python3
"""Install/run the opt-in RP2040 diagnostics on an already flashed MicroPython.

Requires pyserial. Does not flash UF2, modify ESP32, or infer physical wiring.
"""
import argparse
import hashlib
import pathlib
import time

import serial
from serial.tools import list_ports


class Repl:
    def __init__(self, port):
        self.port = serial.Serial(port, 115200, timeout=0.2, write_timeout=3)
        self.port.dtr = True

    def until(self, marker, timeout=5):
        data = bytearray()
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            data.extend(self.port.read(1))
            if data.endswith(marker):
                return bytes(data[:-len(marker)])
        raise TimeoutError(f"REPL did not send {marker!r}: {data[-300:]!r}")

    def run(self, code, timeout=30):
        self.port.write(b"\r\x03\x03")
        time.sleep(0.2)
        self.port.reset_input_buffer()
        self.port.write(b"\r\x01")
        self.until(b"raw REPL; CTRL-B to exit\r\n>")
        data = code.encode("utf-8")
        for offset in range(0, len(data), 128):
            self.port.write(data[offset:offset + 128])
            time.sleep(0.01)
        self.port.write(b"\x04")
        self.until(b"OK")
        output = self.until(b"\x04", timeout).decode("utf-8", "replace")
        error = self.until(b"\x04", timeout).decode("utf-8", "replace")
        self.until(b">")
        if error:
            raise RuntimeError(error)
        return output

    def close(self):
        # Restore friendly REPL only. Do not interrupt an active LED test;
        # its own finally block turns the pixel off after the finite sequence.
        self.port.write(b"\x02")
        self.port.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial-number", required=True,
                        help="Exact target USB serial (case insensitive)")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("install")
    sub.add_parser("info")
    sample = sub.add_parser("sample")
    sample.add_argument("--count", type=int, default=10, choices=range(1, 121))
    led = sub.add_parser("led-test")
    led.add_argument("--pin", type=int, required=True, choices=(21, 27))
    led.add_argument("--frame-pixels", type=int, default=60, choices=range(1, 121))
    led.add_argument("--level", type=int, default=8, choices=range(1, 17))
    args = parser.parse_args()
    ports = [p for p in list_ports.comports()
             if (p.vid, p.pid) == (0x2E8A, 0x0005)
             and (p.serial_number or "").lower() == args.serial_number.lower()]
    if len(ports) != 1:
        parser.exit(2, f"Expected one matching MicroPython target; got {len(ports)}\n")
    repl = Repl(ports[0].device)
    try:
        if args.command == "install":
            source = (pathlib.Path(__file__).resolve().parents[1]
                      / "firmware/indicator-rp2040-diagnostics/rpdiag.py").read_bytes()
            digest = hashlib.sha256(source).hexdigest()
            code = (f"data={source!r}\n"
                    "import os, hashlib, binascii, sys\n"
                    f"assert binascii.hexlify(hashlib.sha256(data).digest()).decode()=={digest!r}\n"
                    "with open('rpdiag.py.tmp', 'wb') as f: f.write(data)\n"
                    "with open('rpdiag.py.tmp', 'rb') as f: saved=f.read()\n"
                    "assert saved==data\n"
                    "os.rename('rpdiag.py.tmp', 'rpdiag.py')\n"
                    "os.sync()\n"
                    "if 'rpdiag' in sys.modules: del sys.modules['rpdiag']\n"
                    f"print('Installed and verified rpdiag.py SHA256 {digest}')\n")
        elif args.command == "sample":
            code = f"import rpdiag\nrpdiag.sample(count={args.count})\n"
        elif args.command == "led-test":
            code = (f"import rpdiag\nrpdiag.led_test(pin={args.pin}, "
                    f"frame_pixels={args.frame_pixels}, level={args.level})\n")
        else:
            code = "import rpdiag\nrpdiag.info()\n"
        print(repl.run(code, timeout=75), end="")
    finally:
        repl.close()


if __name__ == "__main__":
    main()
