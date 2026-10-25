"""Transport guarantees for a client that can operate physical actuators."""
import importlib.util
from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("device_cli", Path(__file__).parents[1] / "tools" / "device_cli.py")
cli = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cli)


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.mode = "ok"
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def respond(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                owner.calls.append((self.command, self.path, self.headers.get("X-Device-Token"), body))
                if owner.mode == "redirect":
                    self.send_response(307)
                    self.send_header("Location", "/unexpected")
                    self.end_headers()
                    return
                if owner.mode == "lost":
                    self.close_connection = True
                    return
                payload = b"[1,2]" if owner.mode == "invalid" else json.dumps({"ok": True, "status": "accepted"}).encode()
                self.send_response(200)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            do_GET = respond
            do_POST = respond

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def test_state_is_authenticated_get(self):
        cli.request(self.url, "test-token")
        self.assertEqual(self.calls, [("GET", "/api/v1/state", "test-token", b"")])

    def test_action_is_sent_once(self):
        body = {"request_id": "one", "action": "water", "duration_ms": 1000}
        result = cli.request(self.url, "token", body)
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(json.loads(self.calls[0][3]), body)

    def test_redirect_does_not_forward_token_or_repeat_action(self):
        self.mode = "redirect"
        with self.assertRaises(RuntimeError):
            cli.request(self.url, "token", {"request_id": "one", "action": "stop_water"})
        self.assertEqual(len(self.calls), 1)

    def test_lost_response_does_not_repeat_action(self):
        self.mode = "lost"
        with self.assertRaises(OSError):
            cli.request(self.url, "token", {"request_id": "one", "action": "water", "duration_ms": 1})
        self.assertEqual(len(self.calls), 1)

    def test_result_query_is_read_only(self):
        cli.request(self.url, "token", result_id="abc-123")
        self.assertEqual(self.calls[0][0:2], ("GET", "/api/v1/result?request_id=abc-123"))

    def test_invalid_result_id_rejected_before_network(self):
        with self.assertRaises(ValueError):
            cli.request(self.url, "token", result_id="id&action=water")
        self.assertEqual(self.calls, [])

    def test_non_object_response_rejected(self):
        self.mode = "invalid"
        with self.assertRaises(ValueError):
            cli.request(self.url, "token")

    def test_ambiguous_base_url_rejected(self):
        with self.assertRaises(ValueError):
            cli.request(self.url + "/other?query=1", "token")
        self.assertEqual(self.calls, [])


class LightArgumentTests(unittest.TestCase):
    def invoke(self, arguments):
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            return cli.main(["--request-id", "lamp-test", *arguments])

    def test_supported_effects_are_sent_once(self):
        for effect in ("solid", "breath", "chase", "rainbow"):
            with self.subTest(effect=effect), patch.object(cli, "request", return_value={"ok": True}) as request:
                self.assertEqual(self.invoke(["light", "on", "--effect", effect]), 0)
                self.assertEqual(request.call_count, 1)
                self.assertEqual(request.call_args.args[2], {
                    "request_id": "lamp-test", "action": "light", "on": True, "effect": effect})

    def test_legacy_on_and_off_payloads_have_no_effect(self):
        for state in ("on", "off"):
            with self.subTest(state=state), patch.object(cli, "request", return_value={"ok": True}) as request:
                self.assertEqual(self.invoke(["light", state]), 0)
                self.assertEqual(request.call_args.args[2], {
                    "request_id": "lamp-test", "action": "light", "on": state == "on"})

    def test_invalid_effect_or_effect_on_off_is_rejected_before_request(self):
        for arguments in (["light", "off", "--effect", "breath"],
                          ["light", "on", "--effect", "blink"],
                          ["water", "10", "--effect", "rainbow"]):
            with self.subTest(arguments=arguments), patch.object(cli, "request") as request:
                with self.assertRaises(SystemExit) as caught:
                    self.invoke(arguments)
                self.assertEqual(caught.exception.code, 2)
                request.assert_not_called()


if __name__ == "__main__":
    unittest.main()
