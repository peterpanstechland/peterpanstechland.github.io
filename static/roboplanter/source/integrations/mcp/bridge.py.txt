"""A fixed-device HTTP adapter. No MCP framing or automatic actuator retries."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
import json
import math
import os
import re
import time
from typing import Any
from urllib.parse import urlsplit

import httpx

DEFAULT_TOKEN = "change-me-before-use"
ID_PATTERN = re.compile(r"[A-Za-z0-9_-]{1,32}\Z")
FINAL_STATUSES = {"completed", "rejected", "failed", "cancelled", "stopped"}


@dataclass(frozen=True)
class Config:
    base_url: str = "http://192.168.4.1"
    token: str = field(default=DEFAULT_TOKEN, repr=False)
    timeout_seconds: float = 3.0
    max_water_ms: int = 3000
    stale_ms: int = 5000

    def __post_init__(self) -> None:
        parsed = urlsplit(self.base_url)
        if (parsed.scheme not in ("http", "https") or not parsed.hostname or
                parsed.username is not None or parsed.password is not None or
                parsed.path not in ("", "/") or parsed.query or parsed.fragment):
            raise ValueError("ROBOPLANTER_URL must be a fixed http(s)://host[:port] origin")
        try:
            parsed.port
        except ValueError:
            raise ValueError("Invalid device URL port") from None
        if not self.token or len(self.token) > 64 or any(ord(c) <= 32 or ord(c) > 126 or c == "|" for c in self.token):
            raise ValueError("ROBOPLANTER_TOKEN must contain 1..64 printable ASCII characters without spaces or pipes")
        if not math.isfinite(self.timeout_seconds) or not 0.1 <= self.timeout_seconds <= 10:
            raise ValueError("HTTP timeout must be 0.1..10 seconds")
        if type(self.max_water_ms) is not int or not 1 <= self.max_water_ms <= 30000:
            raise ValueError("Maximum water duration must be 1..30000 ms")
        if type(self.stale_ms) is not int or not 1 <= self.stale_ms <= 5000:
            raise ValueError("State freshness limit must be 1..5000 ms")

    @classmethod
    def from_env(cls) -> Config:
        return cls(
            base_url=os.environ.get("ROBOPLANTER_URL", "http://192.168.4.1"),
            token=os.environ.get("ROBOPLANTER_TOKEN", DEFAULT_TOKEN),
            timeout_seconds=float(os.environ.get("ROBOPLANTER_TIMEOUT_SECONDS", "3")),
            max_water_ms=int(os.environ.get("ROBOPLANTER_MAX_WATER_MS", "3000")),
        )

    @property
    def writes_configured(self) -> bool:
        return self.token != DEFAULT_TOKEN and len(self.token) >= 16


def valid_id(value: Any) -> bool:
    return isinstance(value, str) and ID_PATTERN.fullmatch(value) is not None


def outcome(request_id: str, status: str, error: str = "", **details: Any) -> dict[str, Any]:
    return {"ok": status in ("accepted", "completed"), "request_id": request_id,
            "status": status, "error": error, **details}


class InvalidDeviceResponse(Exception):
    pass


class PlanterBridge:
    def __init__(self, config: Config, *, transport: httpx.AsyncBaseTransport | None = None):
        self.config = config
        self._transport = transport
        self._write_lock = asyncio.Lock()
        # No eviction during this process: even a repeated ambiguous tool call
        # must not re-POST after a device restart has erased the ID.
        self._actions: dict[str, tuple[str, dict[str, Any]]] = {}

    async def _request(self, method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
        # Overall deadline includes body reading, not just an idle socket timeout.
        async with asyncio.timeout(self.config.timeout_seconds):
            async with httpx.AsyncClient(
                base_url=self.config.base_url.rstrip("/"),
                headers={"X-Device-Token": self.config.token},
                follow_redirects=False, trust_env=False,
                timeout=self.config.timeout_seconds, transport=self._transport,
            ) as client:
                async with client.stream(method, path, json=payload) as response:
                    data = bytearray()
                    async for block in response.aiter_bytes():
                        data.extend(block)
                        if len(data) > 16384:
                            raise InvalidDeviceResponse("response_too_large")
                    try:
                        body = json.loads(data)
                    except (ValueError, UnicodeError):
                        raise InvalidDeviceResponse("invalid_json") from None
                    if not isinstance(body, dict):
                        raise InvalidDeviceResponse("invalid_object")
                    return response.status_code, body

    async def get_state(self) -> dict[str, Any]:
        started = time.monotonic()
        try:
            code, body = await self._request("GET", "/api/v1/state")
        except (httpx.HTTPError, TimeoutError, InvalidDeviceResponse):
            return {"ok": False, "status": "unavailable", "error": "state_unavailable"}
        if code != 200:
            return {"ok": False, "status": "unavailable", "error": "state_http_error", "http_status": code}
        if type(body.get("schema_version")) is not int or body["schema_version"] != 1 or not isinstance(body.get("device_id"), str):
            return {"ok": False, "status": "unavailable", "error": "invalid_state_schema"}
        age = body.get("sample_age_ms")
        elapsed_ms = int((time.monotonic() - started) * 1000)
        effective_age = age + elapsed_ms if type(age) is int and age >= 0 else None
        fresh = effective_age is not None and effective_age <= self.config.stale_ms
        # Preserve the device's null/valid/calibrated fields. Never invent zeros.
        body["_bridge"] = {
            "fresh": fresh, "read_only": True, "effective_age_ms": effective_age,
            "warning": "A sensor reading is not permission to water. Check valid and calibrated fields.",
        }
        return body

    def _validate(self, request_id: str, action: str, values: dict) -> str:
        if not valid_id(request_id):
            return "invalid_request_id"
        expected = {"water": {"duration_ms"}, "light": {"on"}, "print": {"text"}, "stop_water": set()}
        if action not in expected or set(values) != expected[action]:
            return "invalid_action_fields"
        if action == "water":
            duration = values.get("duration_ms")
            if type(duration) is not int or not 1 <= duration <= self.config.max_water_ms:
                return "invalid_duration"
        elif action == "light":
            if type(values.get("on")) is not bool:
                return "invalid_light_value"
        elif action == "print":
            text = values.get("text")
            if (not isinstance(text, str) or not 1 <= len(text) <= 160 or
                    any(c != "\n" and not 32 <= ord(c) <= 126 for c in text)):
                return "invalid_print_text"
        elif action != "stop_water":
            return "invalid_action"
        return ""

    @staticmethod
    def _verified_result(body: dict, request_id: str) -> bool:
        return (body.get("request_id") == request_id and type(body.get("ok")) is bool and
                isinstance(body.get("status"), str) and
                body["status"] in ({"accepted"} | FINAL_STATUSES) and isinstance(body.get("error"), str) and
                body["ok"] == (body["status"] in ("accepted", "completed")))

    def _remember(self, request_id: str, fingerprint: str, result: dict[str, Any]) -> dict[str, Any]:
        previous = self._actions.get(request_id)
        if previous and previous[1].get("status") in FINAL_STATUSES and result.get("status") not in FINAL_STATUSES:
            # A result GET can complete before the older POST reply arrives.
            # Never regress a confirmed final record to late accepted/unknown.
            return previous[1]
        self._actions[request_id] = (fingerprint, result)
        return result

    async def act(self, request_id: str, action: str, **values: Any) -> dict[str, Any]:
        error = self._validate(request_id, action, values)
        if error:
            return outcome(request_id, "rejected", error, source="bridge", sent=False)
        if not self.config.writes_configured:
            return outcome(request_id, "rejected", "nondefault_token_required", source="bridge", sent=False)
        payload = {"request_id": request_id, "action": action, **values}
        fingerprint = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        # Serialise writes and retain one POST per ID. Read-only tools remain free
        # to run concurrently. A network stop is not a physical emergency stop.
        async with self._write_lock:
            if request_id in self._actions:
                previous, result = self._actions[request_id]
                if previous != fingerprint:
                    return outcome(request_id, "rejected", "request_id_conflict", source="bridge", sent=False)
                return {**result, "bridge_cached": True}
            cache_available = len(self._actions) < 512
            if not cache_available and action != "stop_water":
                return outcome(request_id, "rejected", "bridge_cache_full", source="bridge", sent=False)
            if action != "stop_water":
                state = await self.get_state()
                capability = {"water": "pump", "light": "light", "print": "printer"}[action]
                if not state.get("_bridge", {}).get("fresh"):
                    return outcome(request_id, "rejected", "state_not_fresh", source="bridge", sent=False)
                if not isinstance(state.get(capability), dict) or state[capability].get("enabled") is not True:
                    return outcome(request_id, "rejected", f"{capability}_disabled", source="bridge", sent=False)
            unknown = outcome(request_id, "unknown", "response_unverified", source="bridge", sent=True,
                              next_step="Call get_action_result with this ID; do not retry the action.")
            # Reserve before awaiting a POST. Cancellation may happen after the
            # XIAO has received it, so the reserved outcome stays unknown.
            if cache_available:
                self._actions[request_id] = (fingerprint, unknown)
            try:
                code, body = await self._request("POST", "/api/v1/command", payload)
            except (httpx.HTTPError, TimeoutError, InvalidDeviceResponse):
                return unknown
            if code in (200, 202, 409) and self._verified_result(body, request_id):
                if code == 409 and (body["ok"] is not False or body["status"] != "rejected"):
                    return unknown
                if code in (200, 202) and body["ok"] is not True:
                    return unknown
                result = {**body, "source": "device", "http_status": code, "sent": True}
                if action == "print" and body["status"] == "completed":
                    result["completion_scope"] = "UART bytes sent; paper output is not verified."
                elif action == "water" and body["status"] == "completed":
                    result["completion_scope"] = "Software pump command ended; water flow is not measured."
                return self._remember(request_id, fingerprint, result) if cache_available else result
            return unknown

    async def get_result(self, request_id: str) -> dict[str, Any]:
        if not valid_id(request_id):
            return outcome(request_id, "rejected", "invalid_request_id", source="bridge", sent=False)
        try:
            code, body = await self._request("GET", "/api/v1/result?request_id=" + request_id)
        except (httpx.HTTPError, TimeoutError, InvalidDeviceResponse):
            return outcome(request_id, "unknown", "result_unavailable", source="bridge", read_only=True)
        if code == 404 and body.get("request_id") == request_id and body.get("error") == "request_not_found":
            return outcome(request_id, "unknown", "request_not_found", source="device", read_only=True,
                           next_step="Inspect the planter; a device restart may erase an executed request. Do not replay.")
        if code != 200 or not self._verified_result(body, request_id):
            return outcome(request_id, "unknown", "result_unverified", source="bridge", read_only=True)
        result = {**body, "source": "device", "read_only": True,
                  "completion_scope": "Software result only; no flow, light or paper feedback is available."}
        if request_id in self._actions:
            fingerprint, _ = self._actions[request_id]
            return self._remember(request_id, fingerprint, result)
        return result
