#pragma once
#include <Arduino_GFX_Library.h>

namespace garden_art {
// Decorative game artwork, independent of real plant or sensor health.
// species: Mint=0, Basil=1, Rose=2, Succulent=3.
// stage: Seed=0, Sprout=1, Leafy=2, Bloom=3, Mature=4.
// health and mood are percentages. weeds is a count (up to three are shown).
// Every pixel, including moving particles, stays inside cx/cy +/- radius.
void draw(Arduino_GFX &g, uint8_t themeId, uint8_t species, uint8_t stage,
          int16_t cx, int16_t cy, int16_t radius, uint8_t health,
          uint8_t mood, uint8_t weeds, uint32_t now, bool celebrate = false);
}
