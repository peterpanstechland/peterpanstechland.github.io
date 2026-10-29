# RoboPlanter Indicator bitmap font

`include/ui_glyphs.h` contains monochrome subsets independently rasterized at **16, 24, 32, 48 and 64 pixels** from **Noto Sans SC Regular**, from the official [Noto CJK repository](https://github.com/notofonts/noto-cjk). Each size contains the same character set, with cropped bitmap bounds and offsets that preserve descenders and negative bearings. Larger text does not scale a 16-pixel bitmap. The font is licensed under the **SIL Open Font License 1.1**; the complete upstream license is preserved in `OFL.txt`.

Original font copyright: **© 2014–2021 Adobe (http://www.adobe.com/).** Embedded source version: **2.004**. These values were read from the source font's OpenType name table.

Source: https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf

Source SHA-256: `faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9`

The original OTF is cached locally at `.tools/fonts/NotoSansSC-Regular.otf` and is not required for a normal firmware build. The generated bitmap subset is named RoboPlanter Indicator bitmap font, rather than a modified upstream font release. Keep this notice and `OFL.txt` when distributing the font data.

Regenerate after changing Chinese labels or adding photo captions:

```powershell
python tools/build_indicator_font.py --font .tools/fonts/NotoSansSC-Regular.otf --preview tmp/indicator-font.png
python tools/build_indicator_font.py --check
```

The generator requires Pillow and includes ASCII plus printable BMP characters found in the Indicator source and headers. Unsupported characters render as `?`; supplementary-plane emoji are omitted from photo captions. This is the display font. The separate `firmware/xiao/include/printer_font.h` receipt font is generated from the same licensed OTF by `tools/build_printer_font.py`: 32px, 7,540 printable ASCII/GB2312 glyphs, 44px line height. Printer output uses bitmaps rather than the printer-resident Chinese font. Keep this notice and `OFL.txt` with both generated fonts. Run `python -m unittest discover -s tests -p test_printer_font.py` to verify reproducibility with the original OTF installed.
