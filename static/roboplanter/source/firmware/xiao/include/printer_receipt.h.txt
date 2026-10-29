#pragma once
#include <cstring>
#include "printer_text.h"

namespace robo {
// Shared by the UART encoder and screen preview. The 32-row scratch buffer
// remains fixed even when a text line spans bands; no whole-page allocation.
inline void renderPrinterBand(const std::string& text, const PrinterLayout& layout,
                              uint16_t startY, uint8_t rows, uint8_t* pixels) {
  std::memset(pixels, 0, PrinterRowBytes * rows);
  for (uint8_t lineIndex=0; lineIndex<layout.count; ++lineIndex) {
    const auto& line = layout.lines[lineIndex];
    const uint16_t top = printerLineTop(lineIndex);
    if (top >= startY+rows || top+printer_font::kLineHeight <= startY) continue;
    uint16_t x = lineIndex ? PrinterMargin : (PrinterWidth-line.width)/2;
    size_t offset = line.begin;
    while (offset < line.end) {
      uint16_t code = 0;
      if (!nextPrinterCode(text, offset, code)) return;
      const auto* glyph = printer_font::find(code);
      if (!glyph) return;
      const uint8_t stride = (glyph->width+7)/8;
      for (uint8_t row=0; row<glyph->height; ++row) {
        const int py = top+glyph->y+row-startY;
        if (py<0 || py>=rows) continue;
        for (uint8_t col=0; col<glyph->width; ++col) {
          if (!(printer_font::kBitmap[glyph->offset+row*stride+col/8] & (0x80>>(col%8)))) continue;
          const int px = x+glyph->x+col;
          if (px>=0 && px<PrinterWidth) pixels[py*PrinterRowBytes+px/8] |= 0x80>>(px%8);
        }
      }
      x += glyph->advance;
    }
  }
  const uint16_t separator = PrinterMargin+printer_font::kLineHeight+4;
  if (layout.count>1 && separator>=startY && separator<startY+rows)
    for (uint16_t x=PrinterMargin; x<PrinterWidth-PrinterMargin; ++x)
      if ((x-PrinterMargin)%8<4) pixels[(separator-startY)*PrinterRowBytes+x/8] |= 0x80>>(x%8);
}

inline uint16_t printerReceiptRows(const PrinterLayout& layout) {
  return (printerLayoutRows(layout)+PrinterCommandRows-1)/PrinterCommandRows*PrinterCommandRows;
}
constexpr size_t MaxReceiptRows = ((2*PrinterMargin + MaxPrinterLines*printer_font::kLineHeight + PrinterTitleExtra+PrinterCommandRows-1)/PrinterCommandRows)*PrinterCommandRows;
constexpr size_t MaxReceiptWireBytes = 2 + (MaxReceiptRows/PrinterCommandRows)*8 + MaxReceiptRows*PrinterRowBytes + 6;
inline size_t plannedReceiptBytes(const std::string& text, bool cut = false) {
  PrinterLayout layout;
  if (!printerTextLayout(text, layout)) return 0;
  const size_t rows = printerReceiptRows(layout);
  return 2 + (rows/PrinterCommandRows)*8 + rows*PrinterRowBytes + (cut ? 6 : 3);
}

template <typename Write>
bool writeReceipt(const std::string& text, Write write, bool cut = false) {
  PrinterLayout layout;
  if (!printerTextLayout(text, layout)) return false;
  if (!write(0x1B) || !write('@')) return false;
  uint8_t pixels[PrinterRowBytes*PrinterBandRows];
  const uint16_t total = printerReceiptRows(layout);
  for (uint16_t top=0; top<total; top+=PrinterCommandRows) {
    const uint8_t header[] = {0x1D,0x76,0x30,0x00,PrinterRowBytes,0x00,128,0x00};
    for (uint8_t byte:header) if (!write(byte)) return false;
    for(uint16_t y=top;y<top+PrinterCommandRows;y+=PrinterBandRows) {
      renderPrinterBand(text, layout, y, PrinterBandRows, pixels);
      for (uint8_t byte:pixels) if (!write(byte)) return false;
    }
  }
  const uint8_t feed[] = {0x1B,0x64,0x06};
  for (uint8_t byte:feed) if (!write(byte)) return false;
  if (cut) {
    const uint8_t cutter[] = {0x1D,0x56,0x00};
    for (uint8_t byte:cutter) if (!write(byte)) return false;
  }
  return true;
}
}
