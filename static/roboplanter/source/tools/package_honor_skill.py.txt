"""Package only the reviewed, public Honor Skill files; never load credentials."""
import hashlib
import json
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "integrations" / "yoyo" / "skill-draft"
FILES = ("SKILL.md", "references/ble-contract.md", "references/acceptance.md")
OUTPUT = ROOT / "build" / "honor" / "roboplanter-companion-draft.zip"


def package(destination: Path = OUTPUT) -> dict:
    contents = {name: (SOURCE / name).read_bytes() for name in FILES}
    # The retired private diagnostic command carried a real 16-hex key.
    # Check every packaged file before writing anything; never echo the key.
    for name, data in contents.items():
        if re.search(rb"Q\|[0-9a-fA-F]{16}(?![0-9a-fA-F])", data):
            raise ValueError(f"Embedded one-read credential in {name}")
    skill = contents["SKILL.md"].decode("utf-8").replace("\r\n", "\n")
    if not skill.startswith("---\n") or "\n---\n" not in skill[4:]:
        raise ValueError("SKILL.md must start with YAML front matter")
    header = skill.split("---", 2)[1]
    if not all(f"\n{key}:" in header for key in ("name", "description")):
        raise ValueError("name and description are required")
    version = re.search(r"^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$", header, re.M)
    if not version:
        raise ValueError("A three-part Skill version is required")
    if sum(map(len, contents.values())) >= 50 * 1024 * 1024:
        raise ValueError("Skill exceeds the platform size limit")
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, "w", compression=ZIP_DEFLATED) as archive:
        for name, data in contents.items():
            member = ZipInfo(name, (2026, 10, 26, 0, 0, 0))
            member.compress_type = ZIP_DEFLATED
            member.external_attr = 0o100644 << 16
            archive.writestr(member, data)
    with ZipFile(destination) as archive:
        if archive.namelist() != list(FILES) or archive.testzip() is not None:
            raise ValueError("Package verification failed")
    return {"filename": destination.name, "version": version.group(1),
            "files": len(FILES), "bytes": destination.stat().st_size,
            "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}


def main():
    print(json.dumps(package(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
