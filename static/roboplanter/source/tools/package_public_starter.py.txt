"""Build a deterministic, allowlisted source kit; never include local credentials.

Public source distribution does not change the repository's visibility or grant
a new software licence. Third-party files keep their existing notices.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXTRA = ("docs/device-protocol.md", "docs/wiring.md", "docs/indicator-ui.md", "docs/indicator-garden.md", "web/experience/assets/wiring-overview.svg")
BLOCKED_PARTS = {".pio", ".tools", ".git", ".aws", ".codex", ".agents", "__pycache__", "build", "tmp", "node_modules"}
BLOCKED_NAMES = {"config.local.h", "local_config.h", "photos.local.h", "secrets.h", ".env"}
KNOWN_DEFAULTS = {"change-me-before-use", "planter-demo", "RoboPlanter-XXXX", ""}


def source_files() -> list[Path]:
    manifest = json.loads((ROOT / "tools/public-starter-files.json").read_text(encoding="utf-8"))
    names = manifest.get("files", [])
    if manifest.get("schema_version") != 1 or not names or len(set(names)) != len(names):
        raise ValueError("Invalid explicit public source allowlist")
    result = []
    for name in sorted(names):
        rel = Path(name)
        if rel.is_absolute() or ".." in rel.parts or rel.as_posix() != name:
            raise ValueError("Unsafe public source allowlist path")
        path = ROOT / rel
        if not path.is_file() or any((ROOT / Path(*rel.parts[:i])).is_symlink() for i in range(1, len(rel.parts) + 1)):
            raise ValueError(f"Missing or symlinked public source: {rel}")
        if any(part in BLOCKED_PARTS for part in rel.parts):
            raise ValueError(f"Private directory in public source allowlist: {rel}")
        if path.name in BLOCKED_NAMES or path.name.startswith(".env"):
            raise ValueError(f"Private filename in public source allowlist: {rel}")
        text = path.read_text(encoding="utf-8")
        if re.search(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", text):
            raise ValueError(f"Private key marker in allowlisted file: {rel}")
        if path.name.endswith("example.h") or path.name in {"config.h", "robo_config.h"}:
            for value in re.findall(r'^\s*#define\s+(?:ROBO_DEVICE_TOKEN|ROBO_AP_PASSWORD|PLANTER_DEVICE_TOKEN|PLANTER_WIFI_PASSWORD)\s+"([^"]*)"', text, re.M):
                if value not in KNOWN_DEFAULTS:
                    raise ValueError(f"Non-placeholder credential in {rel}")
        result.append(path)
    return result


def write_member(bundle: zipfile.ZipFile, name: str, value: bytes) -> None:
    info = zipfile.ZipInfo(name, (2026, 10, 25, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    bundle.writestr(info, value)


def package(destination: Path) -> dict:
    files = source_files()
    if not files or not (ROOT / "firmware/xiao/src/main.cpp") in files:
        raise ValueError("Source allowlist is incomplete")
    destination.parent.mkdir(parents=True, exist_ok=True)
    manifest = {"schema_version": 1, "purpose": "public-reproduction-kit", "credential_policy": "placeholders-only; local config excluded", "files": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for path in files:
            write_member(bundle, path.relative_to(ROOT).as_posix(), path.read_bytes())
        write_member(bundle, ".gitignore", b".tools/\n**/.pio/\n**/__pycache__/\n*.pyc\n**/config.local.h\n**/local_config.h\n**/secrets.h\n**/photos.local.h\n.env*\nbuild/\ntmp/\n")
        readme = """# RoboPlanter public source reproduction kit

Start with docs/handbook/hardware-quickstart.md.
Public tutorial: https://peterpanstechland.github.io/docs/projects/2026/roboplanter/

This archive contains allowlisted source, example configuration, host tests and
documentation. It contains NO compiled firmware, device backup, credentials,
original vendor attachment, personal photos or platform account screenshots.
All actuators remain disabled by default. Reading this kit is not evidence that
YOYO BLE, your board or an attached pump has passed hardware validation.

Extract into an empty directory. Verify SOURCE-MANIFEST.json file hashes before
use. Copy only example configuration and create your own private credentials.
Start with offline tests and a disconnected bench load, following the tutorial.

Third-party notices remain in firmware/indicator/assets/fonts/OFL.txt and
firmware/indicator/third_party/esp-idf-LICENSE. This source availability does not
introduce a project-wide open-source licence; contact the maintainer regarding
reuse beyond project reproduction. Existing third-party licences still apply.
"""
        write_member(bundle, "README-START-HERE.md", readme.encode())
        write_member(bundle, "SOURCE-MANIFEST.json", (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode())
    return {"filename": destination.name, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "files": len(files), "bytes": destination.stat().st_size}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(package(args.output), ensure_ascii=False, indent=2))
