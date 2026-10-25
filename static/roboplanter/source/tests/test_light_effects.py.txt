"""Light effect bridge regressions, with no SDK, hardware or network requests."""
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "integrations" / "mcp"))
from bridge import Config, PlanterBridge


class LightEffectTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.bridge = PlanterBridge(Config(token="local-test-only-value"))
        self.bridge.get_state = AsyncMock(return_value={"_bridge": {"fresh": True}, "light": {"enabled": True}})
        self.calls = []

        async def request(method, path, payload=None):
            self.calls.append((method, path, payload))
            return 200, {"request_id": payload["request_id"], "ok": True, "status": "completed", "error": ""}

        self.bridge._request = request

    async def test_each_effect_is_forwarded_and_duplicate_never_reposts(self):
        for effect in ("solid", "breath", "chase", "rainbow"):
            result = await self.bridge.act(effect, "light", on=True, effect=effect)
            self.assertEqual(result["status"], "completed")
            self.assertEqual(self.calls[-1][2]["effect"], effect)
            cached = await self.bridge.act(effect, "light", on=True, effect=effect)
            self.assertTrue(cached["bridge_cached"])
        self.assertEqual(len(self.calls), 4)

    async def test_old_payload_and_explicit_solid_are_same_request(self):
        await self.bridge.act("default", "light", on=True)
        self.assertNotIn("effect", self.calls[0][2])
        self.assertTrue((await self.bridge.act("default", "light", on=True, effect="solid"))["bridge_cached"])
        await self.bridge.act("explicit", "light", on=True, effect="solid")
        self.assertTrue((await self.bridge.act("explicit", "light", on=True))["bridge_cached"])
        await self.bridge.act("off", "light", on=False)
        self.assertEqual(self.calls[2][2], {"request_id": "off", "action": "light", "on": False})
        self.assertEqual(len(self.calls), 3)

    async def test_different_effect_same_id_conflicts_without_post(self):
        await self.bridge.act("lamp", "light", on=True, effect="breath")
        result = await self.bridge.act("lamp", "light", on=True, effect="chase")
        self.assertEqual(result["error"], "request_id_conflict")
        self.assertFalse(result["sent"])
        self.assertEqual(len(self.calls), 1)

    async def test_invalid_values_never_read_state_or_post(self):
        for values in ({"on": False, "effect": "solid"}, {"on": True, "effect": "blink"},
                       {"on": True, "effect": []}, {"on": True, "effect": None},
                       {"on": "true", "effect": "breath"}, {"on": True, "effect": "Solid"},
                       {"on": True, "effect": "breath", "speed": 2}):
            with self.subTest(values=values):
                result = await self.bridge.act("bad", "light", **values)
                self.assertEqual(result["status"], "rejected")
                self.assertFalse(result["sent"])
        self.bridge.get_state.assert_not_called()
        self.assertEqual(self.calls, [])

    async def test_effects_retain_freshness_and_enable_checks(self):
        self.bridge.get_state.return_value = {"_bridge": {"fresh": False}, "light": {"enabled": True}}
        self.assertEqual((await self.bridge.act("stale", "light", on=True, effect="rainbow"))["error"], "state_not_fresh")
        self.bridge.get_state.return_value = {"_bridge": {"fresh": True}, "light": {"enabled": False}}
        self.assertEqual((await self.bridge.act("disabled", "light", on=True, effect="rainbow"))["error"], "light_disabled")
        self.assertEqual(self.calls, [])

    async def test_old_firmware_rejection_does_not_fallback_or_retry(self):
        self.bridge._request = AsyncMock(return_value=(409, {
            "request_id": "old-fw", "ok": False, "status": "rejected", "error": "invalid_fields"}))
        result = await self.bridge.act("old-fw", "light", on=True, effect="rainbow")
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["error"], "invalid_fields")
        await self.bridge.act("old-fw", "light", on=True, effect="rainbow")
        self.bridge._request.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
