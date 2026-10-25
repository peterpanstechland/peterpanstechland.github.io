"""Result parsing regressions; no MCP SDK, network, or asyncio.timeout needed."""
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "integrations" / "mcp"))
from bridge import Config, PlanterBridge


class ResultValidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_malformed_status_stays_unknown_for_query_and_action(self):
        for status in ([], {}, None, 3, False):
            with self.subTest(status_type=type(status).__name__):
                bridge = PlanterBridge(Config(token="local-test-only-value"))
                calls = []

                async def response(method, path, payload=None):
                    calls.append(method)
                    return 200, {"request_id": "job", "ok": False, "status": status, "error": ""}

                bridge._request = response
                result = await bridge.get_result("job")
                self.assertEqual(result["status"], "unknown")
                self.assertEqual(result["error"], "result_unverified")
                action = await bridge.act("job", "stop_water")
                self.assertEqual(action["status"], "unknown")
                self.assertTrue(action["sent"])
                cached = await bridge.act("job", "stop_water")
                self.assertEqual(cached["status"], "unknown")
                self.assertEqual(calls, ["GET", "POST"])


if __name__ == "__main__":
    unittest.main()
