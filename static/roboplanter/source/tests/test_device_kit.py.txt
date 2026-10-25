"""Offline contracts, inventory integrity and telemetry interpretation."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "integrations" / "device-kit"
spec = importlib.util.spec_from_file_location("device_kit", KIT / "device_kit.py")
kit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kit)


class DeviceKitTests(unittest.TestCase):
    def setUp(self):
        self.profile = kit.load_profile(KIT / "profiles" / "xiao-roboplanter-v1.json")
        self.fixture = kit.read_json(KIT / "fixtures" / "xiao-state.json")

    def test_all_profiles_and_fixtures_validate_without_network(self):
        with patch("socket.socket", side_effect=AssertionError("No network allowed")):
            for profile_name, fixture_name, status in (
                ("xiao-roboplanter-v1", "xiao-state", "supported"),
                ("generic-ble-template-v1", "generic-ble-state", "experimental"),
                ("irrigation-zone-planned-v1", "irrigation-state", "planned"),
            ):
                profile = kit.load_profile(KIT / "profiles" / (profile_name + ".json"))
                result = kit.mock_check(profile, kit.read_json(KIT / "fixtures" / (fixture_name + ".json")))
                self.assertEqual(result["profile_status"], status)
                self.assertFalse(result["hardware_verified"])
                self.assertFalse(result["yoyo_bound"])
                self.assertFalse(result["execution_enabled"])

    def test_strict_json_rejects_duplicates_nonfinite_and_oversize(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "input.json"
            for text in ('{"key":1,"key":2}', '{"x":NaN}', '{"x":Infinity}', '{"x":1e400}', ' ' * (kit.MAX_DOCUMENT_BYTES + 1)):
                path.write_text(text)
                with self.assertRaises(kit.ContractError):
                    kit.read_json(path)

    def test_inline_secrets_and_unknown_fields_are_rejected_without_echo(self):
        for mutate in (lambda p: p.update(token="do-not-echo-me"),
                       lambda p: p["transports"][0].update(password="do-not-echo-me"),
                       lambda p: p["transports"][0].update(credential_ref="actual secret value")):
            profile = copy.deepcopy(self.profile)
            mutate(profile)
            with self.assertRaises(kit.ContractError) as caught:
                kit.validate_profile(profile)
            self.assertNotIn("do-not-echo-me", str(caught.exception))

    def test_yoyo_binding_and_execution_cannot_be_enabled_in_manifest(self):
        for field, value in (("execution_enabled", True), ("binding_status", "bound"), ("entrypoint", "xiaozhi")):
            profile = copy.deepcopy(self.profile)
            profile["assistant"][field] = value
            with self.assertRaises(kit.ContractError):
                kit.validate_profile(profile)

    def test_transport_reference_duplicates_and_origin_credentials(self):
        for mutate in (lambda p: p["capabilities"][0]["mappings"][0].update(transport_id="missing"),
                       lambda p: p["transports"].append(copy.deepcopy(p["transports"][0])),
                       lambda p: p["transports"][0].update(origin="http://user:secret@localhost"),
                       lambda p: p["transports"][0].update(origin="http://localhost/?token=secret"),
                       lambda p: p["transports"][1].update(status="supported", service_uuid=None)):
            profile = copy.deepcopy(self.profile)
            mutate(profile)
            with self.assertRaises(kit.ContractError):
                kit.validate_profile(profile)

    def test_water_requires_local_bound_and_actuator_interlocks(self):
        for field, value in (("max_duration_ms", None),):
            profile = copy.deepcopy(self.profile)
            water = next(item for item in profile["capabilities"] if item["id"] == "water")
            water["limits"][field] = value
            with self.assertRaises(kit.ContractError):
                kit.validate_profile(profile)
        profile = copy.deepcopy(self.profile)
        profile["capabilities"][-1]["interlocks"] = []
        with self.assertRaises(kit.ContractError):
            kit.validate_profile(profile)

    def test_template_cannot_claim_runtime_support(self):
        profile = kit.load_profile(KIT / "profiles" / "generic-ble-template-v1.json")
        profile["status"] = "supported"
        with self.assertRaises(kit.ContractError):
            kit.validate_profile(profile)

    def test_light_effects_are_constrained_and_do_not_enable_execution(self):
        light = next(item for item in self.profile["capabilities"] if item["id"] == "light")
        self.assertEqual(set(light["effects"]), {"solid", "breath", "chase", "rainbow"})
        self.assertFalse(self.profile["assistant"]["execution_enabled"])
        for effects in (["blink"], ["solid", "solid"], ["breath"]):
            with self.subTest(effects=effects):
                profile = copy.deepcopy(self.profile)
                next(item for item in profile["capabilities"] if item["id"] == "light")["effects"] = effects
                with self.assertRaises(kit.ContractError):
                    kit.validate_profile(profile)
        self.profile["capabilities"][0]["effects"] = ["solid"]
        with self.assertRaises(kit.ContractError):
            kit.validate_profile(self.profile)

    def test_unknown_uncalibrated_and_stale_are_preserved(self):
        result = kit.mock_check(self.profile, self.fixture)
        soil = next(item for item in result["observations"] if item["capability_id"] == "soil-moisture")
        self.assertIsNone(soil["value"])
        self.assertFalse(soil["usable"])
        self.assertIn("uncalibrated", soil["reasons"])
        self.fixture["sample_age_ms"] = 5001
        result = kit.mock_check(self.profile, self.fixture)
        self.assertTrue(all(not item["usable"] for item in result["observations"]))
        self.assertTrue(all("stale" in item["reasons"] for item in result["observations"]))

    def test_bool_age_and_invalid_valid_reading_are_rejected(self):
        for mutate in (lambda f: f.update(sample_age_ms=True),
                       lambda f: f["environment"].update(temperature_c=None),
                       lambda f: f["environment"].update(temperature_c=float("nan")),
                       lambda f: f["environment"].update(humidity_pct=101)):
            fixture = copy.deepcopy(self.fixture)
            mutate(fixture)
            with self.assertRaises(kit.ContractError):
                kit.mock_check(self.profile, fixture)

    def test_registry_duplicate_and_profile_drift_do_not_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "registry.json"
            kit.register(path, self.profile, "desk-planter-01", "Desk", "local-http")
            original = path.read_bytes()
            with self.assertRaises(kit.ContractError):
                kit.register(path, self.profile, "desk-planter-01", "Other", "local-http")
            self.assertEqual(path.read_bytes(), original)
            modified = copy.deepcopy(self.profile)
            modified["description"] += " Changed"
            with self.assertRaises(kit.ContractError):
                kit.record_mock(path, "desk-planter-01", modified, self.fixture)
            self.assertEqual(path.read_bytes(), original)

    def test_mock_record_requires_matching_instance_and_never_activates(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "registry.json"
            kit.register(path, self.profile, "desk-planter-01", "Desk", "local-http")
            wrong = copy.deepcopy(self.fixture)
            wrong["device_id"] = "another-device"
            with self.assertRaises(kit.ContractError):
                kit.record_mock(path, "desk-planter-01", self.profile, wrong)
            kit.record_mock(path, "desk-planter-01", self.profile, self.fixture)
            record = kit.load_registry(path)["devices"][0]
            self.assertEqual(record["stage"], "offline_checked")
            self.assertEqual(record["last_mock_check"]["scope"], "offline_fixture_only")

    def test_malformed_registry_is_rejected_without_rewrite(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "registry.json"
            kit.register(path, self.profile, "desk-01", "Desk", "local-http")
            registry = kit.read_json(path)
            for field in ("stage", "profile_status"):
                invalid = copy.deepcopy(registry)
                invalid["devices"][0][field] = []
                path.write_text(json.dumps(invalid))
                original = path.read_bytes()
                with self.assertRaises(kit.ContractError):
                    kit.load_registry(path)
                self.assertEqual(path.read_bytes(), original)

    def test_logical_name_and_physical_identity_are_distinct(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "registry.json"
            kit.register(path, self.profile, "desk-01", "Desk", "local-http", "RoboPlanter-ABCD")
            fixture = copy.deepcopy(self.fixture)
            fixture["device_id"] = "RoboPlanter-ABCD"
            kit.record_mock(path, "desk-01", self.profile, fixture)
            record = kit.load_registry(path)["devices"][0]
            self.assertEqual(record["hardware_id"], "RoboPlanter-ABCD")

    def test_cli_register_check_list_retire(self):
        with tempfile.TemporaryDirectory() as folder:
            registry = str(Path(folder) / "inventory.json")
            def run(*args):
                result = subprocess.run([sys.executable, str(KIT / "device_kit.py"), *args],
                                        capture_output=True, text=True, check=True)
                return json.loads(result.stdout)
            profile = str(KIT / "profiles" / "xiao-roboplanter-v1.json")
            fixture = str(KIT / "fixtures" / "xiao-state.json")
            run("register", "--profile", profile, "--registry", registry, "--device-id", "desk-planter-01", "--label", "Desk", "--transport", "local-http")
            result = run("mock-check", "--profile", profile, "--fixture", fixture, "--registry", registry, "--device-id", "desk-planter-01")
            self.assertFalse(result["execution_enabled"])
            self.assertEqual(run("list", "--registry", registry)["devices"][0]["stage"], "offline_checked")
            self.assertEqual(run("retire", "--registry", registry, "--device-id", "desk-planter-01")["devices"][0]["stage"], "retired")
            with self.assertRaises(kit.ContractError):
                kit.record_mock(Path(registry), "desk-planter-01", self.profile, self.fixture)


if __name__ == "__main__":
    unittest.main()
