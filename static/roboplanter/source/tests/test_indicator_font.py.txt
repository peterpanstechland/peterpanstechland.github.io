"""Native font geometry regression checks; no hardware or generated fixtures."""
import importlib.util
import math
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("indicator_font", ROOT / "tools/build_indicator_font.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def restored(glyph, size=256, origin=80):
    image = Image.new("1", (size, size))
    stride = (glyph["width"] + 7) // 8
    for y in range(glyph["height"]):
        for x in range(glyph["width"]):
            if glyph["bitmap"][y * stride + x // 8] & (0x80 >> (x % 8)):
                image.putpixel((origin + glyph["x"] + x, origin + glyph["y"] + y), 1)
    return image


class IndicatorFontTests(unittest.TestCase):
    def font(self, size):
        return ImageFont.truetype(str(builder.DEFAULT_FONT), size)

    def test_packed_native_ink_matches_unclipped_reference(self):
        # Independently render to a generous canvas, not the builder's bbox.
        for size in builder.PIXEL_SIZES:
            font = self.font(size)
            for char in "gypqj|@/()工位花园温度":
                with self.subTest(size=size, char=char):
                    expected = Image.new("L", (256, 256))
                    ImageDraw.Draw(expected).text((80, 80 + 14 * size // 16), char,
                                                  font=font, fill=255, anchor="ls")
                    expected = expected.point(lambda v: 255 if v >= 100 else 0).convert("1")
                    actual = restored(builder.rasterize(font, char))
                    self.assertEqual(actual.tobytes(), expected.tobytes())

    def test_descenders_and_negative_bearing_survive(self):
        for size in builder.PIXEL_SIZES:
            font = self.font(size)
            for char in "gypqj":
                with self.subTest(size=size, char=char):
                    glyph = builder.rasterize(font, char)
                    self.assertGreater(glyph["y"] + glyph["height"], size)
            self.assertLess(builder.rasterize(font, "j")["x"], 0)

    def test_32_px_is_not_nearest_neighbor_16_px(self):
        for char in "Ag工":
            small = restored(builder.rasterize(self.font(16), char), size=128, origin=32)
            enlarged = small.resize((256, 256), Image.Resampling.NEAREST)
            native = restored(builder.rasterize(self.font(32), char), origin=64)
            self.assertNotEqual(native.tobytes(), enlarged.tobytes(), char)

    def test_legacy_advance_matches_original_formula_for_every_character(self):
        font = self.font(16)
        for char in builder.required_characters():
            original = 16 if ord(char) >= 0x2E80 else min(16, max(1, math.ceil(font.getlength(char))))
            self.assertEqual(builder.legacy_advance(font, char), original)

    def test_all_required_glyphs_exist_at_every_native_size(self):
        for size in builder.PIXEL_SIZES:
            font = self.font(size)
            for char in builder.required_characters():
                glyph = builder.rasterize(font, char)
                self.assertGreater(glyph["advance"], 0)
                if not char.isspace():
                    self.assertTrue(any(glyph["bitmap"]), (size, char))

    def test_generated_coverage_checks_every_size_and_bitmap_bounds(self):
        builder.check_coverage(builder.DEFAULT_OUTPUT)
        source = builder.DEFAULT_OUTPUT.read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory() as directory:
            broken = Path(directory) / "font.h"
            broken.write_text(source.replace("kGlyphs64[]", "kMissing64[]", 1), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Missing 64"):
                builder.check_coverage(broken)
            broken.write_text(source.replace("kBitmap24[] = {", "kBitmap24[] = {\n  0x00,", 1),
                              encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "24 px bitmap bounds"):
                builder.check_coverage(broken)


if __name__ == "__main__":
    unittest.main()
