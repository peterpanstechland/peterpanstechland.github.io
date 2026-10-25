"""Image transformation checks; no hardware or personal photos required."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("photo_packer", ROOT / "tools/pack_indicator_photos.py")
packer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packer)


class PhotoPackTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def image(self, name="test.png", color=(255, 0, 0), size=(10, 10)):
        path = self.root / name
        Image.new("RGB", size, color).save(path)
        return path

    def test_rgb565_word_order_and_dimensions(self):
        for color, word in [((255, 0, 0), 0xF800), ((0, 255, 0), 0x07E0),
                            ((0, 0, 255), 0x001F), ((255, 255, 255), 0xFFFF)]:
            pixels = packer.read_pixels(self.image(color=color))
            self.assertEqual(len(pixels), 400 * 280)
            self.assertEqual(set(pixels), {word})

    def test_exif_orientation_applied_before_crop(self):
        source = Image.new("RGB", (280, 400), "red")
        source.paste("blue", (0, 200, 280, 400))
        exif = Image.Exif()
        exif[274] = 6  # 90 degrees clockwise: lower blue half becomes left.
        path = self.root / "rotated.png"
        source.save(path, exif=exif)
        pixels = packer.read_pixels(path)
        self.assertEqual(pixels[140 * 400 + 20], 0x001F)
        self.assertEqual(pixels[140 * 400 + 380], 0xF800)

    def test_transparent_pixels_get_matte(self):
        path = self.root / "alpha.png"
        Image.new("RGBA", (4, 4), (255, 0, 0, 0)).save(path)
        expected = ((244 >> 3) << 11) | ((241 >> 2) << 5) | (222 >> 3)
        self.assertEqual(set(packer.read_pixels(path)), {expected})

    def test_bad_input_and_count_preserve_previous_pack(self):
        output = self.root / "photos.local.h"
        output.write_text("previous", encoding="utf-8")
        photo = self.image()
        for paths in ([], [photo] * 5, [photo, self.root / "missing.png"]):
            with self.assertRaises((ValueError, OSError)):
                packer.pack(paths, output)
            self.assertEqual(output.read_text(encoding="utf-8"), "previous")

    def test_caption_private_paths_and_exif_not_in_header(self):
        photo = self.image(name="窗边照片.png")
        output = self.root / "photos.local.h"
        self.assertEqual(packer.pack([photo], output), 224000)
        header = output.read_text(encoding="utf-8")
        self.assertIn('"窗边照片"', header)
        self.assertNotIn(str(self.root), header)
        self.assertNotIn("GPSLatitude", header)
        self.assertIn("0xF800", header)

    def test_caption_sanitizes_control_and_supplementary_text(self):
        self.assertEqual(packer.caption_for(Path('hello\n😀.png')), "hello")
        self.assertEqual(packer.caption_for(Path('😀.jpg')), "照片")
        self.assertEqual(len(packer.caption_for(Path("中" * 40 + ".png"))), 24)


if __name__ == "__main__":
    unittest.main()
