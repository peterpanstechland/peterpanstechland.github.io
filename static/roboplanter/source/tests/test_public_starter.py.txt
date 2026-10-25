"""Public archive privacy, integrity and reproducibility checks; no hardware I/O."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import sys
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("starter", ROOT / "tools/package_public_starter.py")
starter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(starter)


class PublicStarterTests(unittest.TestCase):
    def test_archive_excludes_local_state_and_verifies_every_source_hash(self):
        with tempfile.TemporaryDirectory() as work:
            result = starter.package(Path(work) / "source.zip")
            self.assertGreater(result["files"], 70)
            with zipfile.ZipFile(Path(work) / "source.zip") as archive:
                names = archive.namelist()
                self.assertIn("firmware/xiao/src/main.cpp", names)
                self.assertIn("firmware/indicator/assets/fonts/OFL.txt", names)
                self.assertIn("firmware/indicator/third_party/esp-idf-LICENSE", names)
                for name in names:
                    self.assertNotIn("deployment/", name)
                    self.assertNotIn("reference/", name)
                    self.assertFalse(any(p in starter.BLOCKED_PARTS for p in Path(name).parts))
                    self.assertNotIn(Path(name).name, starter.BLOCKED_NAMES)
                    self.assertNotIn(Path(name).suffix, {".bin", ".elf", ".png", ".zip", ".env"})
                manifest = json.loads(archive.read("SOURCE-MANIFEST.json"))
                for name, digest in manifest["files"].items():
                    self.assertEqual(hashlib.sha256(archive.read(name)).hexdigest(), digest)

    def test_same_source_produces_identical_bytes(self):
        with tempfile.TemporaryDirectory() as work:
            one, two = Path(work) / "one.zip", Path(work) / "two.zip"
            starter.package(one)
            starter.package(two)
            self.assertEqual(one.read_bytes(), two.read_bytes())

    def test_nonplaceholder_example_credential_blocks_packaging(self):
        with tempfile.TemporaryDirectory() as work:
            root = Path(work)
            sample = root / "firmware/xiao/include/config.local.example.h"
            sample.parent.mkdir(parents=True)
            sample.write_text('#define ROBO_DEVICE_TOKEN "must-never-ship-this-value"\n')
            for filename in starter.EXTRA:
                p = root / filename
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text("documentation")
            license_file = root / "firmware/indicator/third_party/esp-idf-LICENSE"
            license_file.parent.mkdir(parents=True)
            license_file.write_text("notice")
            with patch.object(starter, "ROOT", root):
                allowlist = root / "tools/public-starter-files.json"
                allowlist.parent.mkdir(parents=True)
                allowlist.write_text(json.dumps({"schema_version": 1, "files": ["firmware/xiao/include/config.local.example.h"]}))
                with self.assertRaisesRegex(ValueError, "Non-placeholder credential"):
                    starter.source_files()

    def test_unlisted_credential_file_never_enters_the_release(self):
        with tempfile.TemporaryDirectory() as work:
            root = Path(work)
            (root / "tools").mkdir()
            (root / "tools/safe.py").write_text("# public tool\n")
            (root / "tools/local-credentials.json").write_text('{"secret":"never-publish"}')
            (root / "tools/public-starter-files.json").write_text(json.dumps({"schema_version":1,"files":["tools/safe.py"]}))
            with patch.object(starter, "ROOT", root):
                self.assertEqual([p.name for p in starter.source_files()], ["safe.py"])

    def test_sync_clears_retired_exports_and_uses_owned_directory(self):
        sys.path.insert(0, str(ROOT / "tools"))
        from sync_docs_site import sync
        with tempfile.TemporaryDirectory() as work:
            site = Path(work)
            (site / "docusaurus.config.ts").write_text("export default {}")
            (site / "package.json").write_text("{}")
            for name in ["docs/projects/index.md", "i18n/zh-Hans/docusaurus-plugin-content-docs/current/projects/index.md"]:
                path = site / name
                path.parent.mkdir(parents=True)
                path.write_text("# Projects\n")
            old = site / "static/roboplanter/source/private-old.txt"
            old.parent.mkdir(parents=True)
            old.write_text("must disappear")
            with self.assertRaisesRegex(ValueError, "unowned"):
                sync(site, "main")
            (site / "static/roboplanter/.roboplanter-managed").write_text("owned")
            sync(site, "main")
            self.assertFalse(old.exists())
            self.assertTrue((site / "static/roboplanter/source/firmware/xiao/src/main.cpp.txt").exists())


if __name__ == "__main__":
    unittest.main()
