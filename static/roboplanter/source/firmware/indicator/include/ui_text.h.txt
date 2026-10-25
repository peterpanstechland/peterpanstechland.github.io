#pragma once
#include <Arduino_GFX_Library.h>

// Compact UTF-8 native-size bitmap subset, generated from OFL Noto Sans SC.
// Origin is the nominal cell top-left; ink retains negative left bearings and
// descenders below the nominal size. Width measures advance, not ink bounds.
namespace ui_text {
// Compatibility API: scale 1..4 selects native 16/32/48/64 px glyphs, preserving
// the original 16 px advances multiplied by scale and 18*scale line spacing.
// Every size contains the complete same Latin/CJK subset; none is upscaled.
void draw(Arduino_GFX &gfx, int16_t x, int16_t y, const char *utf8,
          uint16_t color, uint8_t scale = 1);
int16_t width(const char *utf8, uint8_t scale = 1);
// Native advances; supported sizes 16, 24, 32, 48, 64 px. Line spacing is
// ceil(18*pixelSize/16). Unsupported sizes draw nothing and return width 0.
void drawSized(Arduino_GFX &gfx, int16_t x, int16_t y, const char *utf8,
               uint16_t color, uint8_t pixelSize);
int16_t widthSized(const char *utf8, uint8_t pixelSize);
}
