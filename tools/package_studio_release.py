"""Archive public studio production assets without adding large blobs to Git."""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TAG = "techland-studio-2026-10-24"
SIGNED_RESPONSES = {
    "assets/tripo/records/04_cyber_lucky_cat_blue_v6.source-task.json",
    "assets/tripo/records/20_pc_tower_v2.fresh-task.json",
}


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def category(name):
    if name.startswith("deliverables/techland-ad-v4/"):
        return "direct" if name.endswith(".mp4") else "Techland-Film-v4-Support.zip"
    if name.startswith("deliverables/"):
        return "Techland-Film-Previous-Editions.zip"
    if name.startswith("assets/tripo/promo-video/"):
        return "Techland-Film-Production.zip"
    if name.startswith(("assets/tripo/", "PeterPansTechland_Tripo_Generation_Pack/")):
        return "Techland-Garage-Production.zip"
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-list", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    names = set(json.loads(args.input_list.read_text(encoding="utf-8")))
    # Source scripts may have been copied from the private runtime after inventory.
    names.update(p.relative_to(ROOT).as_posix() for p in
                 (ROOT / "assets/tripo/promo-video/pipeline").rglob("*") if p.is_file())
    groups, excluded = {}, []
    for name in sorted(names):
        group = category(name)
        if not group:
            continue
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():
            raise ValueError(f"Invalid archive input: {name}")
        if "/deps/" in name or path.suffix in {".log", ".flag"} or name in SIGNED_RESPONSES:
            excluded.append({"path": name, "reason": "runtime, temporary log, or signed response"})
            continue
        groups.setdefault(group, []).append(name)
    manifest = {"tag": TAG, "release": f"https://github.com/peterpanstechland/peterpanstechland.github.io/releases/tag/{TAG}",
                "files": [], "assets": [], "excluded": excluded,
                "privateInputs": "Voice reference samples, model weights, credentials and .local-media runtimes are not distributed."}
    for group, members in sorted(groups.items()):
        records = [{"path": name, "bytes": (ROOT/name).stat().st_size,
                    "sha256": digest(ROOT/name)} for name in members]
        if group == "direct":
            for record in records:
                manifest["assets"].append({"name": Path(record["path"]).name,
                                           "bytes": record["bytes"], "sha256": record["sha256"],
                                           "localPath": record["path"]})
        else:
            archive = output / group
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED,
                                 compresslevel=3, allowZip64=True) as bundle:
                for name in members:
                    bundle.write(ROOT/name, name)
                bundle.writestr("ARCHIVE-MANIFEST.json", json.dumps(records, ensure_ascii=False, indent=2))
            with zipfile.ZipFile(archive) as bundle:
                assert bundle.testzip() is None, f"Archive CRC check failed: {group}"
                assert len(bundle.infolist()) == len(records) + 1
            manifest["assets"].append({"name": group, "bytes": archive.stat().st_size,
                                       "sha256": digest(archive), "localPath": archive.relative_to(ROOT).as_posix()})
        for record in records:
            record["releaseAsset"] = Path(record["path"]).name if group == "direct" else group
        manifest["files"].extend(records)
        print(f"Verified {group}: {len(records)} files", flush=True)
    for asset in manifest["assets"]:
        asset["url"] = f"https://github.com/peterpanstechland/peterpanstechland.github.io/releases/download/{TAG}/{asset['name']}"
    public = ROOT / "releases" / TAG
    public.mkdir(parents=True, exist_ok=True)
    # Do not publish local workspace paths for the upload-only packages.
    public_manifest = {**manifest, "assets": [{k:v for k,v in asset.items() if k != "localPath"} for asset in manifest["assets"]]}
    (public/"manifest.json").write_text(json.dumps(public_manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (output/"upload-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"archivedFiles":len(manifest["files"]),"assets":len(manifest["assets"]),
                      "totalBytes":sum(a["bytes"] for a in manifest["assets"])}), flush=True)


if __name__ == "__main__":
    main()
