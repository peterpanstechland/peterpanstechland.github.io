#include "ui_text.h"
#include "ui_glyphs.h"

namespace {
uint32_t next(const char *&p) {
  const uint8_t a = static_cast<uint8_t>(*p++);
  if (a < 0x80) return a;
  unsigned count = 0;
  uint32_t code = 0, minimum = 0;
  if (a >= 0xC2 && a <= 0xDF) { count = 1; code = a & 0x1F; minimum = 0x80; }
  else if (a >= 0xE0 && a <= 0xEF) { count = 2; code = a & 0x0F; minimum = 0x800; }
  else if (a >= 0xF0 && a <= 0xF4) { count = 3; code = a & 7; minimum = 0x10000; }
  else return '?';
  for (unsigned i = 0; i < count; ++i) {
    const uint8_t c = static_cast<uint8_t>(*p);
    if (c < 0x80 || c > 0xBF) return '?';
    code = (code << 6) | (c & 0x3F);
    ++p;
  }
  if (code < minimum || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) return '?';
  return code;
}
size_t glyphIndex(uint32_t code) {
  size_t left = 0, right = ui_font::kCount;
  while (left < right) {
    const size_t middle = left + (right - left) / 2;
    if (ui_font::kCharacters[middle].code < code) left = middle + 1;
    else right = middle;
  }
  if (left < ui_font::kCount && ui_font::kCharacters[left].code == code) return left;
  return ui_font::kFallback;
}
const ui_font::Font *fontForSize(uint8_t size) {
  for (size_t i = 0; i < ui_font::kFontCount; ++i) {
    if (ui_font::kFonts[i].size == size) return &ui_font::kFonts[i];
  }
  return nullptr;
}
void drawText(Arduino_GFX &gfx, int32_t x, int32_t y, const char *utf8,
              uint16_t color, const ui_font::Font &font, uint8_t legacyScale) {
  const int32_t start = x;
  while (*utf8) {
    const uint32_t code = next(utf8);
    if (code == '\n') { x = start; y += font.lineHeight; continue; }
    const size_t index = glyphIndex(code);
    const auto &g = font.glyphs[index];
    const int stride = (g.width + 7) / 8;
    for (int row = 0; row < g.height; ++row) {
      const uint8_t *bits = font.bitmap + g.offset + row * stride;
      int col = 0;
      while (col < g.width) {
        if (!(bits[col / 8] & (0x80U >> (col % 8)))) { ++col; continue; }
        const int begin = col++;
        while (col < g.width && (bits[col / 8] & (0x80U >> (col % 8)))) ++col;
        const int32_t px = x + g.x + begin, py = y + g.y + row;
        // Arduino_GFX takes int16_t coordinates. Clip before narrowing so a
        // long caption cannot wrap off-screen text back onto the display.
        const int32_t end = px + col - begin;
        if (py >= 0 && py < gfx.height() && px < gfx.width() && end > 0) {
          const int16_t clippedX = static_cast<int16_t>(px < 0 ? 0 : px);
          const int16_t clippedEnd = static_cast<int16_t>(end > gfx.width() ? gfx.width() : end);
          gfx.fillRect(clippedX, static_cast<int16_t>(py), clippedEnd - clippedX, 1, color);
        }
      }
    }
    x += legacyScale ? ui_font::kCharacters[index].legacyAdvance * legacyScale : g.advance;
  }
}
int16_t textWidth(const char *utf8, const ui_font::Font &font, uint8_t legacyScale) {
  int32_t line = 0, widest = 0;
  while (*utf8) {
    const uint32_t code = next(utf8);
    if (code == '\n') { if (line > widest) widest = line; line = 0; }
    else {
      const size_t index = glyphIndex(code);
      line += legacyScale ? ui_font::kCharacters[index].legacyAdvance * legacyScale
                          : font.glyphs[index].advance;
      if (line > 32767) line = 32767;
    }
  }
  if (line > widest) widest = line;
  return static_cast<int16_t>(widest);
}
}  // namespace
namespace ui_text {
void draw(Arduino_GFX &gfx, int16_t x, int16_t y, const char *utf8,
          uint16_t color, uint8_t scale) {
  if (!utf8 || scale == 0 || scale > 4) return;
  const auto *font = fontForSize(16 * scale);
  if (font) drawText(gfx, x, y, utf8, color, *font, scale);
}
int16_t width(const char *utf8, uint8_t scale) {
  if (!utf8 || scale == 0 || scale > 4) return 0;
  const auto *font = fontForSize(16 * scale);
  return font ? textWidth(utf8, *font, scale) : 0;
}
void drawSized(Arduino_GFX &gfx, int16_t x, int16_t y, const char *utf8,
               uint16_t color, uint8_t pixelSize) {
  const auto *font = fontForSize(pixelSize);
  if (utf8 && font) drawText(gfx, x, y, utf8, color, *font, 0);
}
int16_t widthSized(const char *utf8, uint8_t pixelSize) {
  const auto *font = fontForSize(pixelSize);
  return utf8 && font ? textWidth(utf8, *font, 0) : 0;
}
}  // namespace ui_text
