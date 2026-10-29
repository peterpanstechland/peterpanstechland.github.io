#!/usr/bin/env python3
"""Generate private Indicator settings from a verified XIAO connection.

Reads credentials from local files, performs one authenticated read-only state
request, then writes local_config.h. No actuator command or firmware upload.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

from device_cli import request

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ("PLANTER_WIFI_SSID", "PLANTER_WIFI_PASSWORD", "PLANTER_BASE_URL",
          "PLANTER_DEVICE_TOKEN")


def defines(path: Path) -> dict[str, str | int]:
    values: dict[str, str | int] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r'\s*#define\s+(\w+)\s+("(?:[^"\\]|\\.)*"|0x[0-9a-fA-F]+|\d+)\s*(?://.*)?', line)
        if not match:
            continue
        name, raw = match.groups()
        if name in values:
            raise ValueError("Duplicate configuration define: " + name)
        try:
            values[name] = json.loads(raw) if raw.startswith('"') else int(raw, 0)
        except (ValueError, json.JSONDecodeError):
            raise ValueError("Unsupported literal in configuration: " + name) from None
    return values


def text_value(values: dict, key: str, default: str | None = None) -> str:
    value = values.get(key, default)
    if not isinstance(value, str) or any(ord(c) < 32 for c in value):
        raise ValueError("Missing or invalid configuration: " + key)
    return value


def pair(source: Path, output: Path, url: str, expected_id: str | None = None,
         replace: bool = False) -> str:
    if output.resolve() == source.resolve():
        raise ValueError("Output must not replace the XIAO configuration")
    if output.name != "local_config.h":
        raise ValueError("Output must be named local_config.h (excluded from Git)")
    if output.exists() and not replace:
        raise ValueError("Indicator configuration exists; use --replace to update pairing fields")
    cfg = defines(source)
    token = text_value(cfg, "ROBO_DEVICE_TOKEN")
    if (not 16 <= len(token) <= 64 or token == "change-me-before-use" or
            any(not 33 <= ord(c) <= 126 or c == '|' for c in token)):
        raise ValueError("Configure a nondefault XIAO device token first")
    sta = cfg.get("ROBO_WIFI_STA", 0)
    if sta not in (0, 1):
        raise ValueError("ROBO_WIFI_STA must be 0 or 1")
    # Validate local inputs before any network request. Only the explicitly
    # selected device endpoint receives the token; device_cli rejects redirects.
    password = text_value(cfg, "ROBO_STA_PASSWORD" if sta else "ROBO_AP_PASSWORD",
                          "" if sta else "planter-demo")
    if password and not 8 <= len(password.encode("utf-8")) <= 63:
        raise ValueError("Wi-Fi password must be empty or 8..63 UTF-8 bytes")
    ssid = text_value(cfg, "ROBO_STA_SSID") if sta else None
    if sta and not 1 <= len(ssid.encode("utf-8")) <= 32:
        raise ValueError("Wi-Fi SSID must be 1..32 UTF-8 bytes")
    state = request(url, token)
    device_id = state.get("device_id")
    if (state.get("schema_version") != 1 or not isinstance(device_id, str) or
            not re.fullmatch(r"RoboPlanter-[A-Za-z0-9_-]+", device_id)):
        raise ValueError("Endpoint did not return a RoboPlanter v1 device state")
    if expected_id is not None and device_id != expected_id:
        raise ValueError("Connected device does not match --device-id")
    if not sta:
        ssid = device_id
    replacements = dict(zip(FIELDS, (ssid, password, url.rstrip('/'), token)))
    # Preserve UI/local sensor options, comments and any other existing fields.
    original = output.read_text(encoding="utf-8") if output.exists() else "#pragma once\n"
    for field, value in replacements.items():
        pattern = r"^\s*#define\s+" + field + r"\b[^\n]*$"
        matches = list(re.finditer(pattern, original, re.M))
        if len(matches) > 1:
            raise ValueError("Ambiguous Indicator pairing field: " + field)
        line = "#define " + field + " " + json.dumps(value, ensure_ascii=True)
        original = re.sub(pattern, lambda _: line, original, flags=re.M) if matches else original.rstrip() + '\n' + line + '\n'
    if "PLANTER_ENABLE_LOCAL_SOIL" not in original:
        original += "#define PLANTER_ENABLE_LOCAL_SOIL 0 // Enable only with the RP2040 soil responder.\n"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(original, encoding="utf-8")
    return device_id


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="Trusted XIAO base URL from its current serial log")
    parser.add_argument("--device-id", help="Expected device_id, when already known")
    parser.add_argument("--xiao-config", type=Path, default=ROOT / "firmware/xiao/include/config.local.h")
    parser.add_argument("--output", type=Path, default=ROOT / "firmware/indicator/include/local_config.h")
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args(argv)
    try:
        device_id = pair(args.xiao_config, args.output, args.url, args.device_id, args.replace)
    except Exception as error:
        # HTTP/server exception bodies may contain arbitrary data; never echo
        # credentials or request/response bodies during provisioning.
        print("Pairing failed (" + type(error).__name__ + "). Check the local configuration, trusted URL and device identity. No firmware was uploaded.", file=sys.stderr)
        return 1
    print("Verified " + device_id + "; private Indicator pairing saved. Build/upload Indicator, then select its configured network. Credentials were not displayed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
