"""Decode an offline firmware receipt.bin into a PNG (never sends to a printer).

Use tests/core/printer_preview.cpp to generate receipt.bin from a UTF-8 text file.
"""
from pathlib import Path
import argparse
from PIL import Image


def decode_receipt(data: bytes) -> Image.Image:
    if not data.startswith(b"\x1b@"):
        raise ValueError("Missing ESC @")
    offset, packed, height = 2, bytearray(), 0
    while data[offset:offset + 4] == b"\x1dv0\0":
        if len(data) < offset + 8:
            raise ValueError("Truncated raster header")
        width = int.from_bytes(data[offset + 4:offset + 6], "little")
        rows = int.from_bytes(data[offset + 6:offset + 8], "little")
        if width != 48 or not rows in (32,128):
            raise ValueError("Unexpected firmware band dimensions")
        offset += 8
        size = width * rows
        if len(data) < offset + size:
            raise ValueError("Truncated raster pixels")
        packed.extend(data[offset:offset + size])
        height += rows
        offset += size
    if not 1 <= height <= 1536:
        raise ValueError("Unexpected receipt height")
    if data[offset:] not in (b"\x1bd\x06", b"\x1bd\x06\x1dV\0"):
        raise ValueError("Unexpected feed/cut tail")
    # ESC/POS uses 1=black; Pillow's mode 1 uses 1=white.
    return Image.frombytes("1", (384, height), bytes(value ^ 255 for value in packed))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    decode_receipt(args.input.read_bytes()).save(args.output)
