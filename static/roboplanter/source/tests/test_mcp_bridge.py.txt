"""Official MCP SDK discovery/call tests and simulated-device transport tests.

No real hardware is contacted. HTTP requests either use MockTransport or a
temporary loopback mock server; the SDK test talks to the actual stdio server.
"""
from __future__ import annotations

import asyncio
import copy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import site
import sys
import threading
import unittest
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
site.addsitedir(str(ROOT / ".tools" / "mcp-python"))
sys.path.insert(0, str(ROOT / "integrations" / "mcp"))

import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from bridge import Config, PlanterBridge, valid_print_text
from server import create_server

TOKEN = "mock-only-token-12345678"
STATE = {
    "schema_version": 1, "device_id": "mock-planter", "uptime_ms": 100,
    "sample_age_ms": 0,
    "soil": {"raw": None, "percent": None, "valid": False, "calibrated": False},
    "air": {"raw": None, "valid": False}, "uv": {"raw": None, "valid": False},
    "environment": {"temperature_c": None, "humidity_pct": None, "valid": False},
    "pump": {"enabled": True, "on": False, "remaining_ms": 0},
    "light": {"enabled": True, "on": False}, "printer": {"enabled": True, "status": "idle"},
    "last_command": {"request_id": "other", "status": "completed", "error": ""},
}


class BridgeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.calls = []
        self.state = copy.deepcopy(STATE)
        self.mode = "ok"

        async def respond(request):
            self.calls.append(request)
            if request.url.path.endswith("/state"):
                return httpx.Response(200, json=self.state)
            if request.url.path.endswith("/result"):
                identity = request.url.params["request_id"]
                if self.mode == "missing":
                    return httpx.Response(404, json={"ok": False, "request_id": identity,
                                                   "status": "rejected", "error": "request_not_found"})
                return httpx.Response(200, json={"ok": True, "request_id": identity, "status": "completed", "error": ""})
            payload = json.loads(request.content)
            if self.mode == "timeout":
                raise httpx.ReadTimeout("do not expose token or URL", request=request)
            if self.mode == "deadline":
                await asyncio.sleep(1)
            if self.mode == "redirect":
                return httpx.Response(307, headers={"Location": "http://untrusted.invalid/"}, json={})
            if self.mode == "wrong_id":
                return httpx.Response(200, json={"ok": True, "request_id": "wrong", "status": "completed", "error": ""})
            if self.mode == "invalid_409":
                return httpx.Response(409, json={"ok": True, "request_id": payload["request_id"], "status": "completed", "error": ""})
            if self.mode == "legacy_print":
                return httpx.Response(409, json={"ok": False, "request_id": payload["request_id"],
                                               "status": "rejected", "error": "invalid_print_text"})
            rejected = self.mode == "reject"
            status = "rejected" if rejected else "accepted" if payload["action"] == "water" else "completed"
            return httpx.Response(409 if rejected else 202 if status == "accepted" else 200,
                json={"ok": not rejected, "request_id": payload["request_id"], "status": status,
                      "error": "pump_disabled" if rejected else ""})

        self.transport = httpx.MockTransport(respond)
        self.bridge = PlanterBridge(Config(base_url="http://mock.invalid", token=TOKEN), transport=self.transport)

    def posts(self):
        return [r for r in self.calls if r.method == "POST"]

    async def test_state_keeps_unknown_and_never_waters(self):
        result = await self.bridge.get_state()
        self.assertIsNone(result["soil"]["percent"])
        self.assertFalse(result["soil"]["valid"])
        self.assertTrue(result["_bridge"]["fresh"])
        self.assertEqual(self.posts(), [])

    async def test_water_preflight_and_exactly_one_post(self):
        result = await self.bridge.act("water-1", "water", duration_ms=1000)
        self.assertEqual(result["status"], "accepted")
        self.assertEqual([r.method for r in self.calls], ["GET", "POST"])
        self.assertTrue(all(r.headers["X-Device-Token"] == TOKEN for r in self.calls))
        self.assertEqual(json.loads(self.posts()[0].content), {"request_id": "water-1", "action": "water", "duration_ms": 1000})

    async def test_duplicate_action_id_is_not_reposted(self):
        await self.bridge.act("same", "water", duration_ms=1000)
        result = await self.bridge.act("same", "water", duration_ms=1000)
        self.assertTrue(result["bridge_cached"])
        self.assertEqual(len(self.posts()), 1)

    async def test_full_bridge_cache_still_allows_new_stop_without_growing_cache(self):
        self.bridge._actions = {f"old-{i}": ("old", {"status": "completed"}) for i in range(512)}
        refused = await self.bridge.act("full-water", "water", duration_ms=1000)
        self.assertEqual(refused["error"], "bridge_cache_full")
        result = await self.bridge.act("full-stop", "stop_water")
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(self.posts()), 1)
        self.assertEqual(len(self.bridge._actions), 512)
        conflict = await self.bridge.act("old-0", "stop_water")
        self.assertEqual(conflict["error"], "request_id_conflict")
        self.assertEqual(len(self.posts()), 1)

    async def test_late_post_acceptance_cannot_overwrite_completed_result(self):
        posted = asyncio.Event()
        release = asyncio.Event()

        async def race(request):
            if request.method == "POST":
                posted.set()
                await release.wait()
                return httpx.Response(202, json={"ok": True, "request_id": "race", "status": "accepted", "error": ""})
            return httpx.Response(200, json={"ok": True, "request_id": "race", "status": "completed", "error": ""})

        bridge = PlanterBridge(Config(token=TOKEN), transport=httpx.MockTransport(race))
        action = asyncio.create_task(bridge.act("race", "stop_water"))
        await posted.wait()
        final = await bridge.get_result("race")
        self.assertEqual(final["status"], "completed")
        release.set()
        self.assertEqual((await action)["status"], "completed")
        self.assertEqual(bridge._actions["race"][1]["status"], "completed")

    async def test_same_id_different_payload_rejected(self):
        await self.bridge.act("same", "water", duration_ms=1000)
        result = await self.bridge.act("same", "water", duration_ms=2000)
        self.assertEqual(result["error"], "request_id_conflict")
        self.assertEqual(len(self.posts()), 1)

    async def test_timeout_unknown_no_retry_even_repeated_tool_call(self):
        self.mode = "timeout"
        result = await self.bridge.act("lost", "water", duration_ms=1000)
        repeated = await self.bridge.act("lost", "water", duration_ms=1000)
        self.assertEqual(result["status"], "unknown")
        self.assertEqual(repeated["status"], "unknown")
        self.assertNotIn(TOKEN, json.dumps(result))
        self.assertEqual(len(self.posts()), 1)

    async def test_total_deadline_returns_unknown(self):
        self.mode = "deadline"
        bridge = PlanterBridge(Config(base_url="http://mock.invalid", token=TOKEN, timeout_seconds=0.1), transport=self.transport)
        result = await bridge.act("slow", "stop_water")
        self.assertEqual(result["status"], "unknown")
        self.assertEqual(len(self.posts()), 1)

    async def test_verified_409_is_rejected_not_network_unknown(self):
        self.mode = "reject"
        result = await self.bridge.act("refused", "water", duration_ms=1000)
        self.assertEqual((result["status"], result["source"], result["error"]), ("rejected", "device", "pump_disabled"))

    async def test_unverified_409_is_unknown(self):
        self.mode = "invalid_409"
        result = await self.bridge.act("bad-conflict", "stop_water")
        self.assertEqual(result["status"], "unknown")

    async def test_result_miss_is_unknown_not_not_executed(self):
        self.mode = "missing"
        result = await self.bridge.get_result("old-boot")
        self.assertEqual(result["status"], "unknown")
        self.assertEqual(result["error"], "request_not_found")
        self.assertEqual(self.posts(), [])

    async def test_unknown_can_be_resolved_without_repost(self):
        self.mode = "timeout"
        await self.bridge.act("lost", "water", duration_ms=1000)
        self.mode = "ok"
        result = await self.bridge.get_result("lost")
        self.assertEqual(result["status"], "completed")
        repeated = await self.bridge.act("lost", "water", duration_ms=1000)
        self.assertEqual(repeated["status"], "completed")
        self.assertEqual(len(self.posts()), 1)

    async def test_redirect_is_not_followed(self):
        self.mode = "redirect"
        self.assertEqual((await self.bridge.act("redirect", "stop_water"))["status"], "unknown")
        self.assertEqual(len(self.calls), 1)

    async def test_wrong_response_id_cannot_confirm_action(self):
        self.mode = "wrong_id"
        self.assertEqual((await self.bridge.act("own-id", "stop_water"))["status"], "unknown")

    async def test_stale_state_prevents_write_but_not_stop(self):
        self.state["sample_age_ms"] = 5001
        self.assertEqual((await self.bridge.act("stale", "water", duration_ms=1000))["error"], "state_not_fresh")
        self.assertEqual(self.posts(), [])
        self.assertEqual((await self.bridge.act("stop", "stop_water"))["status"], "completed")
        self.assertEqual(len(self.posts()), 1)

    async def test_disabled_capability_prevents_write(self):
        self.state["light"]["enabled"] = False
        self.assertEqual((await self.bridge.act("disabled", "light", on=True))["error"], "light_disabled")
        self.assertEqual(self.posts(), [])

    async def test_default_token_is_read_only(self):
        bridge = PlanterBridge(Config(base_url="http://mock.invalid"), transport=self.transport)
        self.assertEqual((await bridge.act("unsafe", "water", duration_ms=1000))["error"], "nondefault_token_required")
        self.assertEqual(self.calls, [])
        self.assertEqual((await bridge.get_state())["schema_version"], 1)

    async def test_parameter_validation_before_network(self):
        for identity, action, args in [
            ("bad&url", "stop_water", {}), ("a", "water", {"duration_ms": True}),
            ("b", "water", {"duration_ms": 3001}), ("c", "light", {"on": "true"}),
            ("d", "print", {"text": "\x1b@"}), ("e", "print", {"text": "中文🌱"}),
            ("f", "print", {"text": "x" * 161}), ("g", "stop_water", {"url": "http://other"}),
        ]:
            with self.subTest(action=action, args=args):
                self.assertEqual((await self.bridge.act(identity, action, **args))["status"], "rejected")
        self.assertEqual(self.calls, [])

    async def test_chinese_note_is_preserved_and_posted_once(self):
        text = "工位花园 RoboPlanter\n薄荷：今天也要喝水。"
        result = await self.bridge.act("chinese", "print", text=text)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(json.loads(self.posts()[0].content),
                         {"request_id": "chinese", "action": "print", "text": text})
        self.assertEqual((await self.bridge.act("chinese", "print", text=text))["bridge_cached"], True)
        self.assertEqual((await self.bridge.act("chinese", "print", text=text + "！"))["error"], "request_id_conflict")
        self.assertEqual(len(self.posts()), 1)

    async def test_print_utf8_byte_limits_and_controls_fail_before_network(self):
        self.assertTrue(valid_print_text("中" * 53 + "!"))  # Exactly 160 UTF-8 bytes.
        self.assertTrue(valid_print_text("x" * 160))
        self.assertTrue(valid_print_text("1\n2\n3\n4\n5\n6\n7\n8\n"))
        invalid = [None, b"text", "", "中" * 54, "中" * 53 + "!!", "x" * 161,
                   "x\x00y", "\x1b@", "\x1dV\x00", "\t", "\r", "\x7f", "\x85",
                   "\ud800", "\udfff", "🌱", "☃", "\ufeff", "\u200b", "\uffff",
                   "1\n2\n3\n4\n5\n6\n7\n8\n9", "\n" * 9]
        for index, text in enumerate(invalid):
            with self.subTest(text=repr(text)):
                result = await self.bridge.act(f"invalid-{index}", "print", text=text)
                self.assertEqual(result["error"], "invalid_print_text")
                self.assertFalse(result["sent"])
        self.assertEqual(self.calls, [])

    def test_bridge_repertoire_matches_every_shipped_font_entry(self):
        # No font-rendering dependency: compare to the actual shipped firmware
        # table, catching Unicode aliases or an accidental GBK superset.
        import re
        header = (ROOT / "firmware/xiao/include/printer_font.h").read_text(encoding="utf-8")
        font_codes = {int(code, 16) for code in re.findall(r"\{0x([0-9A-F]{4}),", header)}
        self.assertEqual(len(font_codes), 7540)
        for code in range(0x10000):
            self.assertEqual(valid_print_text(chr(code)), code == 10 or code in font_codes,
                             f"U+{code:04X}")

    async def test_old_firmware_print_rejection_is_preserved_without_retry(self):
        self.mode = "legacy_print"
        result = await self.bridge.act("legacy", "print", text="中文小票")
        self.assertEqual((result["status"], result["source"], result["error"]),
                         ("rejected", "device", "invalid_print_text"))
        repeated = await self.bridge.act("legacy", "print", text="中文小票")
        self.assertTrue(repeated["bridge_cached"])
        self.assertEqual(repeated["error"], "invalid_print_text")
        self.assertEqual(len(self.posts()), 1)

    async def test_chinese_print_unknown_is_not_reposted(self):
        self.mode = "timeout"
        result = await self.bridge.act("lost-print", "print", text="中文小票")
        repeated = await self.bridge.act("lost-print", "print", text="中文小票")
        self.assertEqual(result["status"], "unknown")
        self.assertEqual(repeated["status"], "unknown")
        self.assertEqual(len(self.posts()), 1)

    def test_fixed_origin_configuration_and_hidden_token(self):
        for url in ["file:///tmp/device", "http://user:pass@host", "http://host/path", "http://host/?url=x"]:
            with self.assertRaises(ValueError):
                Config(base_url=url)
        self.assertNotIn(TOKEN, repr(self.bridge.config))

    def test_http_bind_is_loopback_and_dns_protection_enabled(self):
        server = create_server(Config(token=TOKEN))
        self.assertEqual(server.settings.host, "127.0.0.1")
        self.assertTrue(server.settings.transport_security.enable_dns_rebinding_protection)


class OfficialSdkStdioTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_stdio_discovery_and_six_tool_calls_to_mock_device(self):
        calls = []

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def handle_request(self):
                payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
                calls.append((self.command, self.path, self.headers.get("X-Device-Token"), payload))
                if self.path.endswith("/state"):
                    body = STATE
                else:
                    identity = payload.get("request_id") or parse_qs(urlsplit(self.path).query)["request_id"][0]
                    body = {"ok": True, "request_id": identity, "status": "completed", "error": ""}
                data = json.dumps(body).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            do_GET = handle_request
            do_POST = handle_request

        mock = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=mock.serve_forever, daemon=True)
        worker.start()
        environment = {**os.environ, "ROBOPLANTER_URL": f"http://127.0.0.1:{mock.server_port}", "ROBOPLANTER_TOKEN": TOKEN}
        params = StdioServerParameters(command=sys.executable, args=[str(ROOT / "integrations/mcp/server.py")], env=environment)
        try:
            async with asyncio.timeout(30):
                async with stdio_client(params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        tools = (await session.list_tools()).tools
                        self.assertEqual({t.name for t in tools}, {"get_planter_state", "water", "stop_water", "set_light", "print_note", "get_action_result"})
                        light = next(tool for tool in tools if tool.name == "set_light")
                        self.assertNotIn("effect", light.inputSchema["required"])
                        effect_schema = light.inputSchema["properties"]["effect"]
                        self.assertEqual(set(effect_schema["enum"]), {"solid", "breath", "chase", "rainbow"})
                        for tool in tools:
                            if tool.name != "get_planter_state":
                                self.assertIn("request_id", tool.inputSchema["required"])
                            self.assertNotIn("url", tool.inputSchema.get("properties", {}))
                            self.assertNotIn("token", tool.inputSchema.get("properties", {}))
                        samples = [
                            ("get_planter_state", {}), ("water", {"request_id": "sdk-water", "duration_ms": 1000}),
                            ("stop_water", {"request_id": "sdk-stop"}), ("set_light", {"request_id": "sdk-light", "on": True}),
                            ("set_light", {"request_id": "sdk-effect", "on": True, "effect": "breath"}),
                            ("print_note", {"request_id": "sdk-print", "text": "工位花园 Hello planter\n"}),
                            ("get_action_result", {"request_id": "sdk-water"}),
                        ]
                        for name, arguments in samples:
                            result = await session.call_tool(name, arguments)
                            self.assertFalse(result.isError, name)
                            self.assertIsInstance(result.structuredContent, dict)
                            self.assertNotIn(TOKEN, json.dumps(result.structuredContent))
                        invalid = await session.call_tool("water", {"request_id": "boolean-duration", "duration_ms": True})
                        self.assertTrue(invalid.isError)
                        invalid_effect = await session.call_tool("set_light", {"request_id": "invalid-effect", "on": True, "effect": "blink"})
                        self.assertTrue(invalid_effect.isError)
                        null_effect = await session.call_tool("set_light", {"request_id": "null-effect", "on": True, "effect": None})
                        self.assertTrue(null_effect.isError)
                        invalid_off = await session.call_tool("set_light", {"request_id": "off-effect", "on": False, "effect": "solid"})
                        self.assertEqual(invalid_off.structuredContent["status"], "rejected")
                        invalid_note = await session.call_tool("print_note", {"request_id": "invalid-note", "text": "中" * 54})
                        self.assertEqual(invalid_note.structuredContent["error"], "invalid_print_text")
            self.assertEqual(sum(method == "POST" for method, *_ in calls), 5)
            effect_payload = next(payload for method, _, _, payload in calls if method == "POST" and payload["request_id"] == "sdk-effect")
            self.assertEqual(effect_payload, {"request_id": "sdk-effect", "action": "light", "on": True, "effect": "breath"})
            note_payload = next(payload for method, _, _, payload in calls if method == "POST" and payload["request_id"] == "sdk-print")
            self.assertEqual(note_payload["text"], "工位花园 Hello planter\n")
            self.assertTrue(all(token == TOKEN for _, _, token, _ in calls))
        finally:
            mock.shutdown()
            mock.server_close()
            worker.join()


if __name__ == "__main__":
    unittest.main()
