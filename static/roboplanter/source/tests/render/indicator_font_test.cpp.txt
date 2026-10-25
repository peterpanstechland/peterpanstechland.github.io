// Exercise production text rendering with the pinned Arduino_GFX rasterizer.
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
#include "../../firmware/indicator/src/ui_text.cpp"
#include <Arduino_G.cpp>
#include <Arduino_GFX.cpp>
#include <canvas/Arduino_Canvas.cpp>

namespace {
unsigned checks = 0;
void require(bool value, const char *message) {
  if (!value) throw std::runtime_error(message);
  ++checks;
}
std::vector<uint16_t> pixels(Arduino_Canvas &canvas) {
  return {canvas.getFramebuffer(), canvas.getFramebuffer() + canvas.width() * canvas.height()};
}
bool ink(Arduino_Canvas &canvas, int x, int y) {
  return canvas.getFramebuffer()[y * canvas.width() + x] != 0;
}
}
int main() {
  try {
    Arduino_Canvas canvas(256, 180, nullptr);
    require(canvas.begin(GFX_SKIP_OUTPUT_BEGIN), "Canvas initialization");
    for (unsigned scale = 1; scale <= 4; ++scale) {
      require(ui_text::width("RoboPlanter", scale) == 95 * scale, "Legacy Latin advance changed");
      require(ui_text::width("工位花园", scale) == 64 * scale, "Legacy CJK advance changed");
      require(ui_text::width("gypqj\n工位", scale) == 41 * scale, "Legacy multiline width changed");
    }
    for (const char *letter : {"g", "y", "p", "q", "j"}) {
      canvas.fillScreen(0);
      ui_text::draw(canvas, 20, 20, letter, 0xFFFF);
      bool belowCell = false;
      for (int y = 36; y < 44; ++y)
        for (int x = 15; x < 40; ++x) belowCell |= ink(canvas, x, y);
      require(belowCell, "A descender was clipped to 16 px");
    }
    canvas.fillScreen(0);
    ui_text::draw(canvas, 20, 20, "j", 0xFFFF);
    bool negativeBearing = false;
    for (int y = 20; y < 45; ++y) negativeBearing |= ink(canvas, 19, y);
    require(negativeBearing, "Negative left bearing was clipped");
    canvas.fillScreen(0);
    ui_text::draw(canvas, 20, 20, "A", 0xFFFF, 2);
    bool subpixelDetail = false;
    for (int y = 20; y < 60; y += 2) {
      for (int x = 20; x < 60; x += 2) {
        const bool first = ink(canvas, x, y);
        subpixelDetail |= first != ink(canvas, x + 1, y) || first != ink(canvas, x, y + 1) ||
                          first != ink(canvas, x + 1, y + 1);
      }
    }
    require(subpixelDetail, "32 px is still a 2x enlargement of 16 px");
    for (const uint8_t size : {16, 24, 32, 48, 64}) {
      canvas.fillScreen(0);
      ui_text::drawSized(canvas, 20, 20, "温", 0xFFFF, size);
      const auto chinese = pixels(canvas);
      canvas.fillScreen(0);
      ui_text::drawSized(canvas, 20, 20, "?", 0xFFFF, size);
      require(chinese != pixels(canvas), "Native CJK glyph silently fell back");
      require(ui_text::widthSized("工位", size) == size * 2, "Sized CJK advance is incorrect");
      if (size != 24) {
        canvas.fillScreen(0);
        ui_text::draw(canvas, 20, 20, "温", 0xFFFF, size / 16);
        require(chinese == pixels(canvas), "Legacy API is not using the native-sized CJK bitmap");
      }
    }
    canvas.fillScreen(0);
    ui_text::drawSized(canvas, 20, 20, "g", 0xFFFF, 24);
    const auto oneLine = pixels(canvas);
    canvas.fillScreen(0);
    ui_text::drawSized(canvas, 20, -7, "\ng", 0xFFFF, 24);
    require(oneLine == pixels(canvas), "24 px line spacing must be 27 px");
    require(ui_text::width("\xC0") == ui_text::width("?"), "Invalid UTF-8 handling regressed");
    require(ui_text::width(nullptr) == 0 && ui_text::widthSized(nullptr, 24) == 0, "Null text handling");
    require(ui_text::widthSized("test", 20) == 0 && ui_text::width("test", 5) == 0,
            "Unsupported size must not silently scale");
    const std::string longText(10000, 'W');
    require(ui_text::width(longText.c_str(), 4) == 32767, "Legacy width saturation");
    require(ui_text::widthSized(longText.c_str(), 64) == 32767, "Sized width saturation");
    size_t bytes = sizeof(ui_font::kCharacters) + sizeof(ui_font::kFonts);
    bytes += sizeof(ui_font::kGlyphs16) + sizeof(ui_font::kGlyphs24) + sizeof(ui_font::kGlyphs32) +
             sizeof(ui_font::kGlyphs48) + sizeof(ui_font::kGlyphs64) + ui_font::kBitmapBytes;
    std::cout << "PASS: " << checks << " native font checks; font storage " << bytes << " bytes\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "FAIL: " << error.what() << '\n';
    return 1;
  }
}
