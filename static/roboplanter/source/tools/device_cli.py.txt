#!/usr/bin/env python3
"""RoboPlanter HTTP client. Sends each action exactly once; no action retries."""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Device credentials and actuator requests must stay at the chosen endpoint.
        return None


def request(base: str, token: str, payload: dict | None = None, timeout: float = 3.0,
            result_id: str | None = None) -> dict:
    parsed = urlsplit(base)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username
            or parsed.query or parsed.fragment or parsed.path not in ("", "/")):
        raise ValueError("base URL must be http(s)://host[:port], without credentials")
    path = "/api/v1/state" if payload is None else "/api/v1/command"
    if result_id is not None:
        if payload is not None or not valid_id(result_id):
            raise ValueError("invalid result request ID")
        path = "/api/v1/result?request_id=" + result_id
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = Request(base.rstrip("/") + path, data=body,
                  headers={"X-Device-Token": token, "Content-Type": "application/json"},
                  method="GET" if payload is None else "POST")
    try:
        with build_opener(NoRedirect).open(req, timeout=timeout) as response:
            raw = response.read(16385)
    except HTTPError as error:
        detail = error.read(2048).decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail}") from error
    if len(raw) > 16384:
        raise ValueError("response exceeds 16 KiB")
    result = json.loads(raw)
    if not isinstance(result, dict):
        raise ValueError("device returned a non-object response")
    return result


def valid_id(value: str) -> bool:
    return 1 <= len(value) <= 32 and all(c.isascii() and (c.isalnum() or c in "-_") for c in value)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://192.168.4.1")
    parser.add_argument("--request-id", help="reuse only when reconciling the same action")
    commands = parser.add_subparsers(dest="action", required=True)
    commands.add_parser("state")
    result_parser = commands.add_parser("result")
    result_parser.add_argument("id", help="read the outcome of an existing request; sends no action")
    water = commands.add_parser("water")
    water.add_argument("duration_ms", type=int)
    commands.add_parser("stop_water")
    light = commands.add_parser("light")
    light.add_argument("value", choices=("on", "off"))
    light.add_argument("--effect", choices=("solid", "breath", "chase", "rainbow"),
                       help="optional effect for light on; omitted means solid")
    printing = commands.add_parser("print")
    printing.add_argument("text")
    args = parser.parse_args(argv)
    token = os.environ.get("ROBOPLANTER_TOKEN", "change-me-before-use")
    payload = None
    if args.action == "result" and not valid_id(args.id):
        parser.error("invalid result request ID")
    if args.action not in ("state", "result"):
        request_id = args.request_id or uuid.uuid4().hex
        if not valid_id(request_id):
            parser.error("request-id must contain 1–32 ASCII letters, digits, '-' or '_'")
        payload = {"request_id": request_id, "action": args.action}
        if args.action == "water":
            if not 1 <= args.duration_ms <= 30000:
                parser.error("duration_ms must be 1–30000; device may impose a lower limit")
            payload["duration_ms"] = args.duration_ms
        elif args.action == "light":
            payload["on"] = args.value == "on"
            if args.effect is not None:
                if not payload["on"]:
                    parser.error("--effect is only valid with light on")
                payload["effect"] = args.effect
        elif args.action == "print":
            payload["text"] = args.text
        print(f"request_id={request_id}", file=sys.stderr)
    try:
        result = request(args.url, token, payload, result_id=args.id if args.action == "result" else None)
    except (OSError, URLError, RuntimeError, ValueError) as error:
        print(f"Request failed: {error}", file=sys.stderr)
        if payload is not None:
            print("Outcome may be unknown. Read state before sending another action; no retry was sent.", file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result.get("ok") is False else 0


if __name__ == "__main__":
    raise SystemExit(main())
