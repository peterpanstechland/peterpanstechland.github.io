#!/usr/bin/env python3
"""Read the stock Indicator RP2040 USB log; does not flash or send commands.

Requires pyserial. With the back facing you and ports below the label, connect
the analog moisture probe to the LEFT Grove socket (yellow SIG = GPIO27).
The stock log's first value is GPIO26; its second is GPIO27. A numeric value
alone does not prove a sensor is connected: compare confirmed dry/wet states.
"""
import argparse
import json
import re
import statistics
import time
from datetime import datetime, timezone

import serial
from serial.tools import list_ports


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seconds", type=int, default=20)
    parser.add_argument("--label", default="condition-unconfirmed")
    args = parser.parse_args()
    if not 1 <= args.seconds <= 300:
        parser.error("--seconds must be between 1 and 300")
    ports = [p for p in list_ports.comports()
             if (p.vid, p.pid) == (0x2886, 0x0050)]
    if len(ports) != 1:
        parser.exit(2, f"Expected one stock Indicator RP2040; found {len(ports)}.\n")
    samples = []
    try:
        with serial.Serial(ports[0].device, 115200, timeout=0.5) as port:
            # Arduino USB Serial logging requires the host to assert DTR.
            port.dtr = True
            deadline = time.monotonic() + args.seconds
            while time.monotonic() < deadline:
                line = port.readline().decode("utf-8", errors="replace")
                match = re.search(r"grove adc:\s*(\d+)\s*,\s*(\d+)", line)
                if not match:
                    continue
                adc26, adc27 = map(int, match.groups())
                samples.append(adc27)
                print(json.dumps({
                    "time": datetime.now(timezone.utc).isoformat(),
                    "condition": args.label, "gpio26_raw": adc26,
                    "gpio27_raw": adc27,
                }), flush=True)
    except serial.SerialException as exc:
        parser.exit(2, f"Serial read failed: {exc}\n")
    if not samples:
        parser.exit(2, "No stock Grove ADC log received; no sensor result.\n")
    print(json.dumps({"condition": args.label, "samples": len(samples),
                      "gpio27_min": min(samples), "gpio27_max": max(samples),
                      "gpio27_median": statistics.median(samples),
                      "note": "Raw ADC only; not moisture percent or a pass verdict."}))


if __name__ == "__main__":
    main()
