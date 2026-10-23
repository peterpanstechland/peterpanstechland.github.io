#!/usr/bin/env python3
"""Create texture-only GLB download variants for the maker garage.

Requires Pillow. Run from any directory; source GLBs are never overwritten.
    python tools/optimize_preview_downloads.py
    python tools/optimize_preview_downloads.py --verify-only

Only image bytes, image MIME types, affected bufferView offsets/lengths and the
BIN buffer length may change. Geometry, UVs, skins, animations and all other
metadata are compared against their originals before a result is accepted.
JPEG is used only for opaque color textures. Normal/ORM maps use PNG with
bounded two-level channel rounding after resizing; no decoder or glTF extension
is introduced.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from hashlib import sha256
from io import BytesIO
import json
from math import log10
from pathlib import Path
import struct

from PIL import Image, ImageChops, ImageStat, __version__ as pillow_version


ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "static/maker-garage-preview"
MANIFEST = PREVIEW / "optimized-assets.json"
REPORT = ROOT / "assets/tripo/loading-performance/asset-report.json"
PROFILES = {"desktop": 1024, "mobile": 512}
JPEG_QUALITY = 88
DATA_CHANNEL_STEP = 4
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def digest(data: bytes) -> str:
    return sha256(data).hexdigest()


def read_glb(data: bytes) -> tuple[dict, bytes]:
    magic, version, length = struct.unpack_from("<4sII", data)
    assert magic == b"glTF" and version == 2 and length == len(data)
    chunks = []
    cursor = 12
    while cursor < len(data):
        size, kind = struct.unpack_from("<II", data, cursor)
        assert size % 4 == 0
        chunks.append((kind, data[cursor + 8:cursor + 8 + size]))
        cursor += size + 8
    assert cursor == length
    assert [kind for kind, _ in chunks] == [JSON_CHUNK, BIN_CHUNK]
    document = json.loads(chunks[0][1])
    assert len(document["buffers"]) == 1 and "uri" not in document["buffers"][0]
    assert document["buffers"][0]["byteLength"] <= len(chunks[1][1])
    return document, chunks[1][1]


def write_glb(document: dict, binary: bytes) -> bytes:
    encoded = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    binary += b"\0" * (-len(binary) % 4)
    length = 12 + 8 + len(encoded) + 8 + len(binary)
    return (struct.pack("<4sII", b"glTF", 2, length)
            + struct.pack("<II", len(encoded), JSON_CHUNK) + encoded
            + struct.pack("<II", len(binary), BIN_CHUNK) + binary)


def view_bytes(document: dict, binary: bytes, index: int) -> bytes:
    view = document["bufferViews"][index]
    assert view.get("buffer", 0) == 0
    start = view.get("byteOffset", 0)
    return binary[start:start + view["byteLength"]]


def image_roles(document: dict) -> dict[int, set[str]]:
    roles: dict[int, set[str]] = {}
    for material in document.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        entries = [(pbr.get("baseColorTexture"), "color" if material.get("alphaMode", "OPAQUE") == "OPAQUE" else "alpha-color"),
                   (pbr.get("metallicRoughnessTexture"), "data"),
                   (material.get("normalTexture"), "data"),
                   (material.get("occlusionTexture"), "data"),
                   (material.get("emissiveTexture"), "color")]
        for info, role in entries:
            if info is not None:
                source = document["textures"][info["index"]]["source"]
                roles.setdefault(source, set()).add(role)
    return roles


def resized_texture(data: bytes, max_size: int, roles: set[str]) -> tuple[bytes, str, dict]:
    with Image.open(BytesIO(data)) as original:
        original.load()
        original_size = list(original.size)
        image = original.copy()
    image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
    opaque = not has_alpha or image.convert("RGBA").getchannel("A").getextrema() == (255, 255)
    color_only = roles == {"color"} and opaque
    result = BytesIO()
    if color_only:
        image = image.convert("RGB")
        image.save(result, format="JPEG", quality=JPEG_QUALITY, subsampling=0,
                   optimize=True, progressive=True)
        mime = "image/jpeg"
    else:
        if image.mode not in ("RGB", "RGBA", "L", "LA"):
            image = image.convert("RGBA" if has_alpha else "RGB")
        if roles == {"data"} and image.mode == "RGB":
            # Six bits remove entropy introduced by resampling, with at most
            # 2/255 channel error. Keep exact PNG samples for alpha/unknown maps.
            levels = [min(255, round(value / DATA_CHANNEL_STEP) * DATA_CHANNEL_STEP) for value in range(256)]
            image = image.point(levels * 3)
        image.save(result, format="PNG", optimize=True, compress_level=9)
        mime = "image/png"
    encoded = result.getvalue()
    metric = None
    if color_only:
        with Image.open(BytesIO(encoded)) as decoded:
            difference = ImageChops.difference(image, decoded.convert("RGB"))
            mse = sum(ImageStat.Stat(difference).sum2) / (image.width * image.height * 3)
            metric = round(10 * log10(255 * 255 / mse), 2) if mse else None
    return encoded, mime, {"sourceBytes": len(data), "bytes": len(encoded),
                           "sourceSize": original_size, "size": list(image.size),
                           "roles": sorted(roles), "mimeType": mime,
                           "dataMaxChannelRoundingError": DATA_CHANNEL_STEP // 2 if roles == {"data"} else 0,
                           "colorPsnrDbAgainstResizedSource": metric}


def strip_image_layout(document: dict) -> dict:
    """Keep every metadata field except those necessarily changed by images."""
    result = deepcopy(document)
    result["buffers"][0].pop("byteLength")
    image_views = {image["bufferView"] for image in result.get("images", [])}
    for image in result.get("images", []):
        image.pop("mimeType", None)
    for index, view in enumerate(result.get("bufferViews", [])):
        view.pop("byteOffset", None)
        if index in image_views:
            view.pop("byteLength")
    return result


def validate(original: bytes, optimized: bytes, max_size: int) -> dict:
    source, source_binary = read_glb(original)
    result, result_binary = read_glb(optimized)
    assert strip_image_layout(source) == strip_image_layout(result), "Non-image metadata changed"
    image_views = {image["bufferView"] for image in source.get("images", [])}
    verified_bytes = 0
    for index, view in enumerate(source.get("bufferViews", [])):
        if index not in image_views:
            before = view_bytes(source, source_binary, index)
            after = view_bytes(result, result_binary, index)
            assert before == after, f"Non-image bufferView {index} changed"
            verified_bytes += len(before)
        offset = result["bufferViews"][index].get("byteOffset", 0)
        assert offset % 4 == 0
        assert offset + result["bufferViews"][index]["byteLength"] <= len(result_binary)
    roles = image_roles(source)
    data_images_verified = 0
    largest_data_rounding_error = 0
    for image_index, image in enumerate(result.get("images", [])):
        assert image["mimeType"] in ("image/jpeg", "image/png")
        with Image.open(BytesIO(view_bytes(result, result_binary, image["bufferView"]))) as bitmap:
            bitmap.load()
            assert max(bitmap.size) <= max_size
            assert (bitmap.format == "JPEG") == (image["mimeType"] == "image/jpeg")
            if roles.get(image_index) == {"data"}:
                assert bitmap.format == "PNG", "Data maps must avoid JPEG ringing"
                with Image.open(BytesIO(view_bytes(source, source_binary, image["bufferView"]))) as reference:
                    reference.load()
                    reference.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                    assert reference.size == bitmap.size
                    bounds = ImageChops.difference(reference.convert("RGB"), bitmap.convert("RGB")).getextrema()
                    maximum = max(high for _, high in bounds)
                    assert maximum <= DATA_CHANNEL_STEP // 2, "Data map rounding exceeded its bound"
                    largest_data_rounding_error = max(largest_data_rounding_error, maximum)
                    data_images_verified += 1
    return {"metadataEquivalent": True, "nonImageBufferViewsEquivalent": True,
            "nonImageBytesVerified": verified_bytes,
            "accessors": len(source.get("accessors", [])),
            "nodes": len(source.get("nodes", [])),
            "meshes": len(source.get("meshes", [])),
            "skins": len(source.get("skins", [])),
            "animations": len(source.get("animations", [])),
            "dataImagesVerified": data_images_verified,
            "dataMaxObservedChannelErrorAgainstResizedSource": largest_data_rounding_error,
            "addedExtensions": []}


def optimize(original: bytes, max_size: int) -> tuple[bytes, list[dict]]:
    source, binary = read_glb(original)
    result = deepcopy(source)
    roles = image_roles(source)
    intervals = []
    image_report = []
    used_views = set()
    for image_index, image in enumerate(source.get("images", [])):
        index = image["bufferView"]
        assert index not in used_views, "Shared image bufferView needs explicit handling"
        used_views.add(index)
        view = source["bufferViews"][index]
        start = view.get("byteOffset", 0)
        end = (start + view["byteLength"] + 3) // 4 * 4
        assert start % 4 == 0
        for other_index, other in enumerate(source["bufferViews"]):
            if index == other_index:
                continue
            other_start = other.get("byteOffset", 0)
            assert max(start, other_start) >= min(end, other_start + other["byteLength"]), "Image bufferView overlaps another bufferView"
        encoded, mime, stats = resized_texture(view_bytes(source, binary, index), max_size, roles.get(image_index, {"unknown"}))
        stats.update({"index": image_index, "name": image.get("name", "")})
        image_report.append(stats)
        result["images"][image_index]["mimeType"] = mime
        intervals.append((start, end, index, encoded))
    intervals.sort()
    rebuilt = bytearray()
    cursor = 0
    for start, end, index, encoded in intervals:
        assert cursor <= start
        rebuilt.extend(binary[cursor:start])
        result["bufferViews"][index]["byteOffset"] = len(rebuilt)
        result["bufferViews"][index]["byteLength"] = len(encoded)
        rebuilt.extend(encoded)
        rebuilt.extend(b"\0" * (-len(rebuilt) % 4))
        cursor = end
    rebuilt.extend(binary[cursor:])
    for index, view in enumerate(source["bufferViews"]):
        if index in used_views:
            continue
        old_offset = view.get("byteOffset", 0)
        delta = sum((len(encoded) + 3) // 4 * 4 - (end - start)
                    for start, end, _, encoded in intervals if end <= old_offset)
        # Preserve omitted zero offsets as well as all unrelated bufferView metadata.
        if old_offset + delta or "byteOffset" in view:
            result["bufferViews"][index]["byteOffset"] = old_offset + delta
    result["buffers"][0]["byteLength"] = len(rebuilt)
    encoded_glb = write_glb(result, bytes(rebuilt))
    validate(original, encoded_glb, max_size)
    return encoded_glb, image_report


def process_asset(asset: dict, verify_only: bool) -> tuple[str, dict, dict]:
    source_file = asset["file"]
    original_path = PREVIEW / source_file
    original = original_path.read_bytes()
    entry = {"sourceSha256": digest(original), "sourceBytes": len(original)}
    source, source_binary = read_glb(original)
    texture_bytes = sum(len(view_bytes(source, source_binary, image["bufferView"])) for image in source.get("images", []))
    details = {"id": asset["id"], "file": source_file, "sourceBytes": len(original),
               "sourceTextureBytes": texture_bytes, "sourceOtherBytes": len(original) - texture_bytes,
               "profiles": {}}
    for profile, max_size in PROFILES.items():
        relative = f"models/optimized/{profile}/{Path(source_file).name}"
        target = PREVIEW / relative
        if verify_only:
            optimized = target.read_bytes()
            image_report = []
        else:
            optimized, image_report = optimize(original, max_size)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(optimized)
        validation = validate(original, optimized, max_size)
        entry[profile] = {"file": relative, "sha256": digest(optimized), "bytes": len(optimized),
                          "maxTextureSize": max_size}
        details["profiles"][profile] = {"bytes": len(optimized), "savedPercent": round(100 * (1 - len(optimized) / len(original)), 2),
                                          "validation": validation, "images": image_report}
    assert digest(original_path.read_bytes()) == entry["sourceSha256"], "Source changed while building"
    print(f"{source_file}: {len(original):,} -> {entry['desktop']['bytes']:,} desktop / {entry['mobile']['bytes']:,} mobile", flush=True)
    return source_file, entry, details


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true", help="Check existing files and manifest without writing")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    assets = [asset for asset in json.loads((PREVIEW / "assets.json").read_text(encoding="utf-8"))["assets"]
              if asset.get("file") and asset.get("status", "").startswith("verified")]
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        outputs = list(executor.map(lambda asset: process_asset(asset, args.verify_only), assets))
    manifest = {"version": 1, "profiles": {profile: {"maxTextureSize": size} for profile, size in PROFILES.items()},
                "assets": {name: entry for name, entry, _ in outputs}}
    if args.verify_only:
        assert manifest == json.loads(MANIFEST.read_text(encoding="utf-8")), "Manifest does not match files"
        print(f"Validated {len(outputs) * len(PROFILES)} variants; source metadata and every non-image bufferView are identical.")
        return
    totals = {"sourceBytes": sum(entry["sourceBytes"] for _, entry, _ in outputs),
              "sourceTextureBytes": sum(details["sourceTextureBytes"] for _, _, details in outputs),
              "profiles": {}}
    for profile in PROFILES:
        size = sum(entry[profile]["bytes"] for _, entry, _ in outputs)
        totals["profiles"][profile] = {"bytes": size, "savedBytes": totals["sourceBytes"] - size,
                                         "savedPercent": round(100 * (1 - size / totals["sourceBytes"]), 2)}
    report = {"version": 1, "tool": "tools/optimize_preview_downloads.py", "pillowVersion": pillow_version,
              "strategy": "Resize embedded textures only; opaque color JPEG q88 4:4:4 progressive; data maps 6-bit/channel PNG (maximum 2/255 rounding error)",
              "sourceFilesUnchanged": True, "modelCount": len(outputs), "variantCount": len(outputs) * len(PROFILES),
              "totals": totals, "assets": [details for _, _, details in outputs]}
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(totals, indent=2))


if __name__ == "__main__":
    main()
