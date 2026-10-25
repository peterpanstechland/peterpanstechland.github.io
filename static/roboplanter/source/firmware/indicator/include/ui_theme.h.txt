#pragma once
#include <Arduino_GFX_Library.h>

namespace ui_theme {
constexpr uint8_t kCount = 8;
struct Theme {
  const char *name;
  uint16_t background, card, ink, muted, accent, second, face, outline;
  // Light-card text uses these rather than the light-on-dark ink.
  uint16_t cardInk, cardMuted, surface;
};
enum class Icon : uint8_t {
  Water, Temp, Humidity, Light, Print, Yoyo, Settings, Leaf, Clock, Wifi, Back
};
const Theme &get(uint8_t id);
// Artwork is decorative companionship, never a sensor/plant-health diagnosis.
void background(Arduino_GFX &g, uint8_t id);
void face(Arduino_GFX &g, uint8_t id, int16_t cx, int16_t cy,
          int16_t radius, bool blink, uint32_t now);
// Monochrome glyph, scaled into a square with top-left x/y. Settings uses a
// native 32x32 thin outline; the other pixel glyphs use a 16x16 source grid.
void icon(Arduino_GFX &g, Icon kind, int16_t x, int16_t y,
          int16_t size, uint16_t color);
// Water/Temp use a coloured interior and a separate outline; others stay mono.
void accentIcon(Arduino_GFX &g, Icon kind, int16_t x, int16_t y,
                int16_t size, uint16_t outlineColor, uint16_t fillColor);
// Home props: cup x67..126, books x340..418; desk line y355..356.
void deskScene(Arduino_GFX &g, uint8_t id, uint32_t now);
}
