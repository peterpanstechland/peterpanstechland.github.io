"""Package only the reviewed Honor Skill files, without traversing secrets."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "integrations" / "yoyo" / "skill-draft"
FILES = ("SKILL.md", "references/ble-contract.md", "references/acceptance.md")
OUTPUT = ROOT / "build" / "honor" / "roboplanter-companion-draft.zip"


def main():
    contents = {name: (SOURCE / name).read_bytes() for name in FILES}
    skill = contents["SKILL.md"].decode("utf-8").replace("\r\n", "\n")
    if not skill.startswith("---\n") or "\n---\n" not in skill[4:]:
        raise ValueError("SKILL.md must start with YAML front matter")
    header = skill.split("---", 2)[1]
    if not all(f"\n{key}:" in header for key in ("name", "description")):
        raise ValueError("name and description are required")
    if sum(map(len, contents.values())) >= 50 * 1024 * 1024:
        raise ValueError("Skill exceeds the platform size limit")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED) as archive:
        for name, data in contents.items():
            archive.writestr(name, data)
    with ZipFile(OUTPUT) as archive:
        if archive.namelist() != list(FILES) or archive.testzip() is not None:
            raise ValueError("Package verification failed")
    print(f"Built {OUTPUT}: {OUTPUT.stat().st_size} bytes, {len(FILES)} files")


if __name__ == "__main__":
    main()
