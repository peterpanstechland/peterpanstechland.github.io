"""Check the shipped receipt font against its source; no printer required."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("printer_font", ROOT / "tools/build_printer_font.py")
font_build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(font_build)


class PrinterFontTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.font = ImageFont.truetype(str(font_build.DEFAULT_FONT), font_build.PIXEL_SIZE)

    def test_repertoire(self):
        chars = font_build.characters()
        self.assertEqual(len(chars), 7540)
        self.assertEqual(len(chars), len(set(chars)))
        self.assertEqual(chars, sorted(chars, key=ord))
        for code in range(32, 127):
            self.assertIn(chr(code), chars)
        for char in "工位花园薄荷九层塔蔷薇多肉温度湿度，。！？（）￥　":
            self.assertIn(char, chars)
        self.assertNotIn("\x1b", chars)
        self.assertNotIn("\x00", chars)
        self.assertNotIn("🌱", chars)

    def test_packed_pixels_match_source_without_clipping(self):
        # An independent large canvas catches incorrect cropping/bearings,
        # bottom descenders, and MSB/LSB or row-stride mistakes in the packer.
        for char in "gypqj|@/()工位花园温度，。薄荷九层塔蔷薇多肉　 ":
            with self.subTest(char=char):
                glyph = font_build.rasterize(self.font, char)
                direct = Image.new("L", (96, 96))
                ImageDraw.Draw(direct).text((16, 16 + font_build.BASELINE), char,
                                           font=self.font, fill=255, anchor="ls")
                direct = direct.point(lambda value: 255 if value >= font_build.THRESHOLD else 0)
                unpacked = Image.new("L", direct.size)
                stride = (glyph["width"] + 7) // 8
                for row in range(glyph["height"]):
                    for col in range(glyph["width"]):
                        byte = glyph["bitmap"][row * stride + col // 8]
                        if byte & (0x80 >> (col % 8)):
                            unpacked.putpixel((16 + glyph["x"] + col, 16 + glyph["y"] + row), 255)
                self.assertEqual(unpacked.tobytes(), direct.tobytes())

    def test_generated_header_is_reproducible(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "printer_font.h"
            count, bitmap_bytes = font_build.generate(font_build.DEFAULT_FONT, output)
            self.assertEqual(count, 7540)
            self.assertEqual(bitmap_bytes, 857846)
            self.assertEqual(output.read_bytes(), font_build.DEFAULT_OUTPUT.read_bytes())


if __name__ == "__main__":
    unittest.main()
