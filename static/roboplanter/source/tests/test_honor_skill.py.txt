"""Prevent retired private soil credentials from re-entering a Skill archive."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("honor", ROOT / "tools/package_honor_skill.py")
honor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(honor)


class HonorSkillTests(unittest.TestCase):
    def test_public_package_uses_bonded_transport_without_credentials(self):
        with tempfile.TemporaryDirectory() as work:
            output = Path(work) / "skill.zip"
            honor.package(output)
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(archive.namelist(), list(honor.FILES))
                root = archive.read("SKILL.md")
                self.assertIn(b"V|S|desk", root)
                self.assertIn(b"requires_local_pairing", root)
                self.assertNotIn(b"S|probe|soil", root)
                self.assertNotIn(b"Q|", root)

    def test_private_credential_in_any_file_blocks_archive_without_leaking_it(self):
        # Synthetic test value only, never a real device credential.
        marker = "Q|" + "0123456789abcdef"
        for target in honor.FILES:
            with self.subTest(target=target), tempfile.TemporaryDirectory() as work:
                source = Path(work) / "source"
                for name in honor.FILES:
                    path = source / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes((honor.SOURCE / name).read_bytes())
                with (source / target).open("a", encoding="utf-8") as stream:
                    stream.write("\n" + marker)
                output = Path(work) / "must-not-exist.zip"
                with patch.object(honor, "SOURCE", source):
                    with self.assertRaises(ValueError) as raised:
                        honor.package(output)
                self.assertNotIn(marker, str(raised.exception))
                self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
