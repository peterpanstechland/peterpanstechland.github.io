"""Convert native firmware framebuffer captures; no independent UI drawing."""
import argparse
import hashlib
import json
from pathlib import Path
import re

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
THEMES = ["work-garden", "purple-afternoon", "mint-breeze", "warm-tea",
          "night-shift", "berry-note", "moss-study", "pixel-idle"]


def convert(output: Path) -> None:
    if output in ((ROOT / "build/indicator-preview").resolve(), (ROOT / "build/indicator-preview-v2").resolve()):
        raise ValueError("The deployed v1/v2 previews are preserved; choose build/indicator-preview-v3")
    frames = output / "frames"
    manifest = json.loads((frames / "captures.json").read_text(encoding="utf-8"))
    animations = {i: [] for i in range(8)}
    for capture in manifest["captures"]:
        name = capture["name"]
        # Only process the basename emitted by our native renderer.
        if Path(name).name != name or not all(c.isalnum() or c == "-" for c in name):
            raise ValueError("Unexpected capture filename")
        source = frames / f"{name}.ppm"
        with Image.open(source) as raw:
            image = raw.convert("RGB")
        if image.size != (480, 480):
            raise ValueError(f"Unexpected framebuffer dimensions: {name}")
        destination = frames if capture["kind"] == "animation" else output
        image.save(destination / f"{name}.png")
        if capture["kind"] == "animation":
            animations[capture["theme"]].append(image)
        # Remove only the exact intermediate successfully converted above.
        source.unlink()
    for theme, images in animations.items():
        if not images:
            continue
        # One common palette avoids frame-to-frame palette color shifts.
        palette = images[0].quantize(colors=256)
        indexed = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in images]
        indexed[0].save(output / f"theme-{theme}-{THEMES[theme]}.gif", save_all=True,
                        append_images=indexed[1:], duration=manifest["frame_duration_ms"],
                        loop=0, disposal=2, optimize=False)
    # Contact sheets only arrange captured pixels and labels outside each screen.
    pages = ["face", "today", "info", "photos", "focus", "themes", "controls", "confirm-water", "confirm-print"]
    for page in pages:
        sheet = Image.new("RGB", (480 * 4, 512 * 2), "#d9d9d9")
        labels = ImageDraw.Draw(sheet)
        for theme, title in enumerate(THEMES):
            x, y = theme % 4 * 480, theme // 4 * 512
            with Image.open(output / f"theme-{theme}-{page}.png") as screen:
                sheet.paste(screen, (x, y + 32))
            labels.text((x + 12, y + 8), f"{theme}: {title} / {page}", fill="#222222")
        sheet.save(output / f"all-themes-{page}.png")
    def sheet(names: list[str], destination: str, columns: int) -> None:
        rows = (len(names) + columns - 1) // columns
        overview = Image.new("RGB", (480 * columns, 512 * rows), "#d9d9d9")
        labels = ImageDraw.Draw(overview)
        for index, name in enumerate(names):
            x, y = index % columns * 480, index // columns * 512
            with Image.open(output / f"{name}.png") as screen:
                overview.paste(screen, (x, y + 32))
            note = " [virtual game fixture]" if "garden-" in name else " [sample fixture]" if "keyboard" in name or "wifi-sample" in name else ""
            labels.text((x + 12, y + 8), name + note, fill="#222222")
        overview.save(output / destination)

    settings_pages = ["menu", "wifi-empty", "about", "wifi-sample", "keyboard",
                      "keyboard-upper", "keyboard-symbols", "keyboard-symbols-2"]
    for language, prefix in [("zh", ""), ("en", "en-")]:
        sheet([f"{prefix}theme-0-{page}" for page in pages], f"{language}-main-overview.png", 3)
        sheet([f"{language}-settings-{page}" for page in settings_pages], f"{language}-settings-overview.png", 4)
    sheet(["theme-0-face", "en-theme-0-face"], "bilingual-face.png", 2)
    species_names = ["mint", "basil", "rose", "succulent"]
    stage_names = ["seed", "sprout", "leafy", "bloom", "mature"]
    sheet([f"garden-{species}-{stage}" for species in species_names for stage in stage_names],
          "garden-growth-overview.png", 5)
    garden_pages = ["care", "care-watered", "care-cooldown", "species", "mood",
                    "atmosphere-0", "atmosphere-1", "atmosphere-2", "atmosphere-3"]
    for language in ("zh", "en"):
        sheet([f"{language}-garden-{page}" for page in garden_pages], f"{language}-garden-overview.png", 3)
    # An illustrated stage catalogue, not an accelerated recording of gameplay.
    # Every frame is a complete production home screen at a valid stage fixture.
    stages = []
    for stage in stage_names:
        with Image.open(output / f"garden-rose-{stage}.png") as frame:
            stages.append(frame.convert("RGB"))
    palette_strip = Image.new("RGB", (480 * len(stages), 480))
    for index, frame in enumerate(stages):
        palette_strip.paste(frame, (480 * index, 0))
    stage_palette = palette_strip.quantize(colors=256)
    indexed_stages = [frame.quantize(palette=stage_palette, dither=Image.Dither.NONE) for frame in stages]
    indexed_stages[0].save(output / "garden-growth.gif", save_all=True,
                          append_images=indexed_stages[1:], duration=800,
                          loop=0, disposal=2, optimize=False)
    source_files = [ROOT / "firmware/indicator/src" / f for f in
                    ["main.cpp", "ui_theme.cpp", "ui_text.cpp", "ui_photos.cpp", "settings_ui.cpp",
                     "garden_ui.cpp", "garden_art.cpp", "indicator_board.cpp",
                     "indicator_rgb_driver.cpp", "lcd_diagnostics.cpp"]]
    source_files += [ROOT / "firmware/indicator/include" / f for f in
                     ["ui_glyphs.h", "ui_model.h", "ui_theme.h", "ui_text.h", "ui_photos.h",
                      "settings_ui.h", "device_settings.h", "indicator_board.h", "planter_client.h",
                      "garden_ui.h", "garden_art.h", "garden_model.h", "garden_store.h",
                      "lcd_diagnostics.h", "indicator_rgb_driver.h"]]
    source_files += [ROOT / "tests/render/indicator_render.cpp", Path(__file__),
                     ROOT / "tools/render-indicator-ui.ps1", ROOT / "tools/build_indicator_font.py"]
    source_files += sorted((ROOT / "tests/render/stubs").glob("*.h"))
    gfx = ROOT / "firmware/indicator/.pio/libdeps/sensecap_indicator/GFX Library for Arduino"
    source_files += [gfx / f for f in ["library.properties", "src/Arduino_G.cpp",
                    "src/Arduino_GFX.cpp", "src/canvas/Arduino_Canvas.cpp"]]
    manifest["source_sha256"] = {
        str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in source_files
    }
    manifest["unexecuted_hardware_source_paths"] = [
        "firmware/indicator/src/indicator_board.cpp",
        "firmware/indicator/src/indicator_rgb_driver.cpp",
        "firmware/indicator/include/indicator_rgb_driver.h",
        "firmware/indicator/src/lcd_diagnostics.cpp",
        "firmware/indicator/include/lcd_diagnostics.h",
    ]
    glyph_header = (ROOT / "firmware/indicator/include/ui_glyphs.h").read_text(encoding="utf-8")
    characters = glyph_header.split("static const Character kCharacters[] = {", 1)[1].split("};", 1)[0]
    manifest["font"] = {
        "format": "native_size_cropped_row_aligned_1bpp",
        "pixel_sizes": [16, 24, 32, 48, 64],
        "character_count": len(re.findall(r"\{0x[0-9A-Fa-f]+,", characters)),
        "legacy_api": "Scale selects a separately rasterized native size; no enlarged 16px bitmap",
    }
    manifest["limitations"] = [
        "Actual firmware drawing and pinned Arduino_GFX raster algorithms; host Canvas RGB565 output.",
        "Network and hardware disconnected; sensor and actuator values remain unknown.",
        "device_settings is a host-only sample fixture; no Wi-Fi scan, connection, credentials, NVS, or OS backend is linked.",
        "Settings Wi-Fi list and keyboard use only the synthetic SSID 'example'; no nearby networks were read.",
        "Game rules, game UI, and plant artwork are production code; garden_store is RAM-only and never accesses device NVS.",
        "Growth gallery uses explicit virtual-game stage fixtures, not sensor readings or real botanical progress.",
        "garden-growth.gif is a five-stage illustrated catalogue (800 ms per stage), not the actual progression speed.",
        "Backlight duty is simulated as a stored number; these images do not validate physical brightness.",
        "Board, RGB driver and LCD diagnostic source hashes are provenance only; those hardware implementations are not compiled or executed by the host renderer.",
        "Does not emulate LCD timing, PSRAM/DMA, backlight, touch hardware, or on-device performance.",
        "PNG is lossless; GIF uses a 256-color palette. Contact sheet labels are outside screen pixels.",
        "GIF uses 100 ms host-simulated timestamps, not a measured physical-device frame rate.",
        "Confirmation screenshots force the modal open for layout QA while keeping actions disabled.",
    ]
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (output / "REVIEW.txt").write_text(
        "Native firmware pixel captures, disconnected / unknown data.\n"
        "Start with zh-main-overview.png, en-main-overview.png,\n"
        "zh-settings-overview.png, en-settings-overview.png, and bilingual-face.png.\n"
        "Settings backend is a SAMPLE FIXTURE: SSID 'example', no real Wi-Fi or credentials.\n"
        "Game UI: garden-growth-overview.png, zh-garden-overview.png, en-garden-overview.png.\n"
        "garden-growth.gif is a stage catalogue, not actual gameplay speed. Game stage fixtures are virtual.\n"
        "Also inspect all-themes-face.png, all-themes-today.png, all-themes-focus.png,\n"
        "all-themes-confirm-water.png, all-themes-confirm-print.png, and theme-*.gif.\n"
        "Other all-themes-*.png sheets cover information, photos, theme menu and controls.\n"
        "The individual 480x480 images and frames/ directory are for zoomed inspection only.\n"
        "manifest.json records firmware and rasterizer hashes plus limitations.\n",
        encoding="utf-8",
    )
    print(f"Exported {len(manifest['captures'])} PNG captures, 8 animation GIFs, 1 stage catalogue GIF, {len(pages) + 8} contact sheets.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "build/indicator-preview-v3")
    convert(parser.parse_args().output.resolve())
