"""Offline applicability, observed phenology and fail-closed input contracts."""
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
KIT = ROOT / "integrations" / "crop-knowledge"
spec = importlib.util.spec_from_file_location("crop_knowledge", KIT / "knowledge.py")
knowledge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(knowledge)


def source_document():
    return {"schema_version": 1, "reviewed_on": "2026-10-25", "sources": [{
        "id": "synthetic-source", "title": "Synthetic reference", "publisher": "Synthetic publisher",
        "url": "https://example.org/reference", "kind": "official_guidance", "topics": ["pruning"],
        "scope": "Synthetic test scope", "access": "test only", "license": "test only",
        "reuse_policy": "test only", "notes": "Not agronomic evidence"}]}


def card_document():
    return {"schema_version": 1, "cards": [{
        "id": "synthetic-card", "source_ids": ["synthetic-source"], "operation": "pruning",
        "taxa": ["Solanum lycopersicum"], "countries": ["US"], "admin1": ["US-NY"],
        "environments": ["open_field"], "stages": ["flowering"],
        "required_fields": ["growth_habit", "goal"], "summary": "Synthetic reference for applicability testing only."}]}


class CropKnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.sources = knowledge.validate_sources(source_document())
        self.cards = knowledge.validate_cards(card_document(), self.sources)
        self.context = knowledge.read_json(KIT / "examples" / "synthetic-us-ny.json")

    def assess(self, context=None, cards=None):
        return knowledge.assess(self.context if context is None else context,
                                self.cards if cards is None else cards, self.sources, "2026-10-25")

    def test_matching_only_returns_offline_references(self):
        with patch("socket.socket", side_effect=AssertionError("Network forbidden")):
            result = self.assess()
        self.assertFalse(result["automatic_action"])
        self.assertEqual(result["mode"], "offline_reference")
        self.assertEqual(result["matched_references"][0]["operation"], "pruning")
        self.assertIn("irrigation", result["unsupported_operations"])
        self.assertIn("cultivar", result["missing"])

    def test_cross_taxon_country_environment_stage_are_explained(self):
        for field, value, reason in (("taxon", "Ocimum basilicum", "taxon_mismatch"),
                                     ("country", "CN", "country_mismatch"),
                                     ("environment", "greenhouse", "environment_mismatch"),
                                     ("stage", "ripening", "stage_mismatch")):
            with self.subTest(field=field):
                context = copy.deepcopy(self.context)
                if field == "country":
                    context["region"].update(country=value, admin1="CN-SH")
                elif field == "stage":
                    context["observations"][0]["stage"] = value
                else:
                    context[field] = value
                result = self.assess(context)
                self.assertEqual(result["matched_references"], [])
                self.assertIn(reason, result["excluded_cards"][0]["reasons"])

    def test_subdivision_unknown_or_different_does_not_match(self):
        for admin1 in (None, "US-MD"):
            context = copy.deepcopy(self.context)
            context["region"]["admin1"] = admin1
            result = self.assess(context)
            self.assertEqual(result["matched_references"], [])
            self.assertIn("admin1_mismatch", result["excluded_cards"][0]["reasons"])

    def test_unknown_context_lists_missing_without_inventing_stage(self):
        result = self.assess(knowledge.read_json(KIT / "examples" / "synthetic-unknown.json"))
        self.assertIsNone(result["last_confirmed_stage"])
        self.assertIn("taxon", result["missing"])
        self.assertIn("region.country", result["missing"])
        self.assertEqual(result["matched_references"], [])

    def test_missing_required_field_blocks_otherwise_matching_card(self):
        self.context["growth_habit"] = None
        result = self.assess()
        self.assertIn("missing:growth_habit", result["excluded_cards"][0]["reasons"])
        self.assertIn("pruning", result["unsupported_operations"])

    def test_required_fields_reject_containers_and_observation_array_paths(self):
        for path in ("region", "cycle_anchor", "observations", "observations.stage"):
            with self.subTest(path=path):
                cards = copy.deepcopy(self.cards)
                cards[0]["stages"] = ["ANY"]
                cards[0]["required_fields"] = [path]
                self.context["observations"] = []
                self.context["cycle_anchor"] = {"kind": None, "date": None}
                with self.assertRaisesRegex(knowledge.ValidationError, "Unknown required field path"):
                    self.assess(cards=cards)

    def test_prediction_never_confirms_or_advances_stage(self):
        self.context["observations"][0].update(kind="predicted", confirmed_by="agronomist")
        result = self.assess()
        self.assertIsNone(result["last_confirmed_stage"])
        self.assertEqual(result["ignored_observations"][0]["reason"], "not_observed")

    def test_future_and_other_plant_observations_are_ignored(self):
        actual = self.context["observations"][0]
        for index, changes in enumerate(({"plant_id": "other"}, {"observed_at": "2026-10-26T00:00:00Z"})):
            added = {**actual, "id": "extra-" + str(index), "stage": "ripening", **changes}
            self.context["observations"].append(added)
        result = self.assess()
        self.assertEqual(result["last_confirmed_stage"], "flowering")
        self.assertEqual({item["reason"] for item in result["ignored_observations"]}, {"different_plant", "after_as_of"})

    def test_latest_real_observation_is_chronological_not_stage_rank(self):
        latest = {**self.context["observations"][0], "id": "new", "observed_at": "2026-10-22T09:00:00Z", "stage": "vegetative"}
        self.context["observations"].insert(0, latest)
        self.assertEqual(self.assess()["last_confirmed_stage"], "vegetative")

    def test_simultaneous_stages_exceed_scalar_summary_without_biological_judgment(self):
        self.context["observations"].append({**self.context["observations"][0], "id": "conflict", "stage": "ripening"})
        result = self.assess()
        self.assertIsNone(result["last_confirmed_stage"])
        self.assertEqual(result["ignored_observations"][-1]["reason"], "multiple_stages_at_latest_time")
        self.assertIn("not a biological contradiction", result["stage_summary_note"])

    def test_germination_seedling_senescence_are_supported_without_numeric_stage_codes(self):
        schema = knowledge.read_json(KIT / "context.schema.json")
        stages = schema["properties"]["observations"]["items"]["properties"]["stage"]["enum"]
        for stage in ("germination", "seedling", "senescence"):
            with self.subTest(stage=stage):
                self.assertIn(stage, stages)
                self.context["observations"][0]["stage"] = stage
                self.assertEqual(self.assess()["last_confirmed_stage"], stage)
        self.context["observations"][0]["stage"] = 60
        with self.assertRaises(knowledge.ValidationError):
            self.assess()

    def test_duplicate_record_ids_and_missing_source_rejected(self):
        self.context["observations"].append(copy.deepcopy(self.context["observations"][0]))
        with self.assertRaises(knowledge.ValidationError):
            self.assess()
        document = card_document()
        document["cards"][0]["source_ids"] = ["absent"]
        with self.assertRaises(knowledge.ValidationError):
            knowledge.validate_cards(document, self.sources)
        document = source_document()
        document["sources"].append(copy.deepcopy(document["sources"][0]))
        with self.assertRaises(knowledge.ValidationError):
            knowledge.validate_sources(document)
        document = card_document()
        document["cards"].append(copy.deepcopy(document["cards"][0]))
        with self.assertRaises(knowledge.ValidationError):
            knowledge.validate_cards(document, self.sources)

    def test_null_observations_are_missing_and_never_confirmed(self):
        self.context["observations"] = None
        result = self.assess()
        self.assertIn("observations", result["missing"])
        self.assertIsNone(result["last_confirmed_stage"])

    def test_non_https_and_naive_timestamp_rejected(self):
        document = source_document()
        document["sources"][0]["url"] = "http://example.org"
        with self.assertRaises(knowledge.ValidationError):
            knowledge.validate_sources(document)
        self.context["observations"][0]["observed_at"] = "2026-10-20T09:00:00"
        with self.assertRaises(knowledge.ValidationError):
            self.assess()

    def test_dose_execution_and_xp_injections_rejected(self):
        for key, value in (("dose_ml", 10), ("execute", True), ("xp", 100), ("device_runtime_days", 10)):
            context = {**self.context, key: value}
            with self.assertRaises(knowledge.ValidationError):
                self.assess(context)
        for summary in ("浇水20毫升再观察", "Apply 2 L", "使用两克肥料"):
            cards = copy.deepcopy(self.cards)
            cards[0]["summary"] = summary
            with self.assertRaises(knowledge.ValidationError):
                self.assess(cards=cards)
        cards = copy.deepcopy(self.cards)
        cards[0]["execute"] = {"tool": "water"}
        with self.assertRaises(knowledge.ValidationError):
            self.assess(cards=cards)

    def test_invalid_json_duplicate_keys_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "bad.json"
            path.write_text('{"x":1,"x":2}')
            with self.assertRaises(knowledge.ValidationError):
                knowledge.read_json(path)

    def test_cli_uses_only_local_catalogue(self):
        with tempfile.TemporaryDirectory() as folder:
            sources, cards = Path(folder) / "sources.json", Path(folder) / "cards.json"
            sources.write_text(json.dumps(source_document()))
            cards.write_text(json.dumps(card_document()))
            command = [sys.executable, str(KIT / "knowledge.py"), "--sources", str(sources), "--evidence", str(cards)]
            result = subprocess.run(command + ["sources", "--topic", "pruning"], text=True, capture_output=True, check=True)
            payload = json.loads(result.stdout)
            self.assertEqual(len(payload["sources"]), 1)
            self.assertFalse(payload["automatic_action"])
            result = subprocess.run(command + ["assess", "--context", str(KIT / "examples" / "synthetic-us-ny.json"), "--as-of", "2026-10-25"], text=True, capture_output=True, check=True)
            self.assertEqual(json.loads(result.stdout)["last_confirmed_stage"], "flowering")


if __name__ == "__main__":
    unittest.main()
