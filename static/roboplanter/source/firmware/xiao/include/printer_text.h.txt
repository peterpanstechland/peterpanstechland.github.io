#pragma once
#include <cstddef>
#include <cstdint>
#include <string>
#include "printer_font.h"

namespace robo {
constexpr size_t MaxPrinterTextBytes = 160;
constexpr uint16_t PrinterWidth = 384;
constexpr uint16_t PrinterRowBytes = PrinterWidth / 8;
constexpr uint8_t PrinterMargin = 16;
constexpr uint8_t PrinterBandRows = 32; // Rendering scratch only.
constexpr uint16_t PrinterCommandRows = 128; // EM5826H compresses short raster commands.
constexpr uint8_t PrinterTitleExtra = 12;
constexpr const char* PrinterLayoutVersion = "receipt32-v2";
constexpr uint8_t MaxPrinterLines = 8;
struct PrinterLine { uint16_t begin = 0, end = 0, width = 0; };
struct PrinterLayout { PrinterLine lines[MaxPrinterLines]; uint8_t count = 1; };

// Strict UTF-8 for this BMP font. Unsupported codepoints are rejected, not replaced.
inline bool nextPrinterCode(const std::string& text, size_t& offset, uint16_t& code) {
  if (offset >= text.size()) return false;
  size_t next = offset;
  const uint8_t first = static_cast<uint8_t>(text[next++]);
  uint32_t value = first, minimum = 0;
  unsigned remaining = 0;
  if (first < 0x80) {}
  else if (first >= 0xC2 && first <= 0xDF) { value = first & 0x1F; remaining = 1; minimum = 0x80; }
  else if (first >= 0xE0 && first <= 0xEF) { value = first & 0x0F; remaining = 2; minimum = 0x800; }
  else return false;
  if (next + remaining > text.size()) return false;
  while (remaining > 0) {
    --remaining;
    const uint8_t byte = static_cast<uint8_t>(text[next++]);
    if ((byte & 0xC0) != 0x80) return false;
    value = (value << 6) | (byte & 0x3F);
  }
  if (value < minimum || (value >= 0xD800 && value <= 0xDFFF)) return false;
  offset = next; code = static_cast<uint16_t>(value);
  return true;
}

inline bool printerTextLayout(const std::string& text, PrinterLayout& layout) {
  if (text.empty() || text.size() > MaxPrinterTextBytes) return false;
  layout = PrinterLayout{};
  size_t offset = 0;
  uint16_t x = PrinterMargin;
  while (offset < text.size()) {
    const size_t start = offset;
    uint16_t code = 0;
    if (!nextPrinterCode(text, offset, code)) return false;
    if (code == '\n') {
      layout.lines[layout.count-1].end = static_cast<uint16_t>(start);
      // A final LF terminates the last line without adding a blank page row.
      if (offset == text.size()) return true;
      if (layout.count == MaxPrinterLines) return false;
      layout.lines[layout.count++].begin = static_cast<uint16_t>(offset);
      x = PrinterMargin;
      continue;
    }
    if (code < 32 || (code >= 127 && code <= 159)) return false;
    const auto* glyph = printer_font::find(code);
    if (!glyph) return false;
    const int right = glyph->x + glyph->width;
    const uint16_t extent = static_cast<uint16_t>(right > glyph->advance ? right : glyph->advance);
    if (x + extent > PrinterWidth - PrinterMargin) {
      layout.lines[layout.count-1].end = static_cast<uint16_t>(start);
      if (layout.count == MaxPrinterLines) return false;
      layout.lines[layout.count++].begin = static_cast<uint16_t>(start);
      x = PrinterMargin;
    }
    x += glyph->advance;
    layout.lines[layout.count-1].end = static_cast<uint16_t>(offset);
    layout.lines[layout.count-1].width = x - PrinterMargin;
  }
  return true;
}
inline uint16_t printerLineTop(uint8_t line) {
  return PrinterMargin + line*printer_font::kLineHeight + (line ? PrinterTitleExtra : 0);
}
inline uint16_t printerLayoutRows(const PrinterLayout& layout) {
  return 2*PrinterMargin + layout.count*printer_font::kLineHeight + PrinterTitleExtra;
}
}
