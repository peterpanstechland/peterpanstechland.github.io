#include "garden_art.h"
#include "ui_theme.h"

namespace garden_art {
namespace {
constexpr uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
  return ((r & 248) << 8) | ((g & 252) << 3) | (b >> 3);
}
uint16_t blend(uint16_t a, uint16_t b, uint8_t amount) {
  const uint32_t inverse = 255U - amount;
  const uint32_t r = (((a >> 11) & 31) * inverse + ((b >> 11) & 31) * amount) / 255U;
  const uint32_t g = (((a >> 5) & 63) * inverse + ((b >> 5) & 63) * amount) / 255U;
  const uint32_t bl = ((a & 31) * inverse + (b & 31) * amount) / 255U;
  return static_cast<uint16_t>((r << 11) | (g << 5) | bl);
}
constexpr uint16_t kIvory = rgb(247, 244, 220);
constexpr uint16_t kSoil = rgb(81, 66, 56);
constexpr uint16_t kSoilLight = rgb(126, 100, 72);
constexpr uint16_t kPink = rgb(235, 173, 182);
constexpr uint16_t kGold = rgb(235, 204, 130);
constexpr uint16_t kBerry = rgb(192, 103, 122);

// A 64-cell sprite, rasterized without antialiasing. The plant and planter
// keep fixed anchors; expression and particles provide motion without moving
// the complete silhouette. Every primitive clips to the sprite bounds.
struct Pixels {
  Arduino_GFX &g;
  int32_t left, top, extent;
  Pixels(Arduino_GFX &display, int32_t x, int32_t y, int32_t size)
      : g(display), left(x), top(y), extent(size) {}
  void rect(int16_t u, int16_t v, int16_t w, int16_t h, uint16_t color) const {
    if (w <= 0 || h <= 0) return;
    int32_t x0 = left + static_cast<int32_t>(u) * extent / 64;
    int32_t y0 = top + static_cast<int32_t>(v) * extent / 64;
    int32_t x1 = left + static_cast<int32_t>(u + w) * extent / 64;
    int32_t y1 = top + static_cast<int32_t>(v + h) * extent / 64;
    const int32_t minX = left > 0 ? left : 0;
    const int32_t minY = top > 0 ? top : 0;
    const int32_t right = left + extent;
    const int32_t bottom = top + extent;
    const int32_t maxX = right < g.width() ? right : g.width();
    const int32_t maxY = bottom < g.height() ? bottom : g.height();
    if (x0 < minX) x0 = minX;
    if (y0 < minY) y0 = minY;
    if (x1 > maxX) x1 = maxX;
    if (y1 > maxY) y1 = maxY;
    if (x1 > x0 && y1 > y0)
      g.fillRect(static_cast<int16_t>(x0), static_cast<int16_t>(y0),
                 static_cast<int16_t>(x1 - x0), static_cast<int16_t>(y1 - y0), color);
  }
  void plus(int16_t x, int16_t y, uint16_t color) const {
    rect(x, y - 1, 1, 3, color);
    rect(x - 1, y, 3, 1, color);
  }
};

struct Leaves { uint16_t dark, body, light; };
Leaves leafColors(uint8_t species, const ui_theme::Theme &t, uint8_t health) {
  const uint16_t colors[4][3] = {
    {rgb(60, 104, 76), rgb(121, 178, 133), rgb(182, 219, 156)},
    {rgb(56, 96, 62), rgb(112, 160, 100), rgb(179, 207, 135)},
    {rgb(62, 103, 75), rgb(121, 166, 109), rgb(176, 204, 137)},
    {rgb(60, 113, 110), rgb(125, 184, 168), rgb(187, 223, 192)}
  };
  const uint8_t dim = health < 30 ? 55 : 0;
  return {blend(colors[species][0], t.background, dim),
          blend(colors[species][1], t.background, dim),
          blend(colors[species][2], t.background, dim)};
}

// Left-facing 14 x 10 leaves taper to their stem at the bottom right.
// The alternating outside pixels give mint a recognisable scalloped edge.
constexpr uint16_t kMintLeaf[10] = {
  0x3000, 0x7C00, 0x7E00, 0x3F80, 0x7FC0,
  0x1FE0, 0x0FF0, 0x03F8, 0x00FC, 0x000C
};
constexpr uint16_t kBasilLeaf[10] = {
  0x3C00, 0x7E00, 0x7F80, 0x7FC0, 0x3FE0,
  0x3FF0, 0x1FF8, 0x07FC, 0x01FC, 0x000C
};
void leaf(const Pixels &p, int16_t x, int16_t y, bool right,
          bool mint, const Leaves &c) {
  const uint16_t *shape = mint ? kMintLeaf : kBasilLeaf;
  for (int16_t row = 0; row < 10; ++row) {
    for (int16_t col = 0; col < 14; ++col) {
      const uint16_t bit = static_cast<uint16_t>(0x8000U >> col);
      if (!(shape[row] & bit)) continue;
      const bool edge = row == 0 || row == 9 || col == 0 || col == 13 ||
          !(shape[row] & (bit << 1)) || !(shape[row] & (bit >> 1)) ||
          !(shape[row - 1] & bit) || !(shape[row + 1] & bit);
      const bool vein = col == row + 2 || col == row + 3;
      const uint16_t color = edge ? c.dark : (vein ? c.light : c.body);
      p.rect(x + (right ? 13 - col : col), y + row, 1, 1, color);
    }
  }
}

void tinyLeaf(const Pixels &p, int16_t x, int16_t y, bool right, const Leaves &c) {
  p.rect(x + (right ? 2 : 0), y, 5, 2, c.dark);
  p.rect(x + 1, y + 2, 6, 2, c.dark);
  p.rect(x + (right ? 0 : 3), y + 4, 4, 1, c.dark);
  p.rect(x + (right ? 3 : 1), y, 3, 1, c.light);
  p.rect(x + 2, y + 1, 4, 2, c.body);
}

void expression(const Pixels &p, int16_t center, int16_t y,
                uint16_t ink, uint8_t health, uint8_t mood,
                bool blink, bool celebrate, bool small = false) {
  const int16_t separation = small ? 4 : 6;
  const int16_t left = center - separation - 1;
  const int16_t right = center + separation - 1;
  if (blink) {
    p.rect(left, y + 1, 3, 1, ink); p.rect(right, y + 1, 3, 1, ink);
  } else if (celebrate || (mood >= 80 && health >= 40)) {
    p.rect(left, y + 1, 1, 1, ink); p.rect(left + 1, y, 1, 1, ink);
    p.rect(left + 2, y + 1, 1, 1, ink);
    p.rect(right, y + 1, 1, 1, ink); p.rect(right + 1, y, 1, 1, ink);
    p.rect(right + 2, y + 1, 1, 1, ink);
  } else if (health < 30 || mood < 30) {
    p.rect(left, y + 1, 3, 1, ink); p.rect(left + 2, y + 2, 1, 1, ink);
    p.rect(right, y + 1, 3, 1, ink); p.rect(right, y + 2, 1, 1, ink);
  } else {
    p.rect(left + 1, y, 2, 3, ink); p.rect(right, y, 2, 3, ink);
    p.rect(left + 1, y, 1, 1, kIvory); p.rect(right, y, 1, 1, kIvory);
  }
  p.rect(left - 2, y + 3, 2, 1, kPink);
  p.rect(right + 3, y + 3, 2, 1, kPink);
  if (health < 30 || mood < 30) {
    p.rect(center - 1, y + 4, 3, 1, ink);
    p.rect(center - 2, y + 5, 1, 1, ink); p.rect(center + 2, y + 5, 1, 1, ink);
  } else {
    p.rect(center - 2, y + 4, 1, 1, ink); p.rect(center + 2, y + 4, 1, 1, ink);
    p.rect(center - 1, y + 5, 3, 1, ink);
    if (celebrate) p.rect(center - 1, y + 4, 3, 1, ink);
  }
}

void pot(const Pixels &p, const ui_theme::Theme &t, bool seed,
         uint8_t health, uint8_t mood, bool blink, bool celebrate) {
  const uint16_t shade = blend(t.face, t.outline, 65);
  p.rect(14, 59, 36, 2, blend(t.background, t.outline, 100));
  p.rect(17, 43, 30, 12, t.outline); p.rect(19, 55, 26, 3, t.outline);
  p.rect(20, 58, 24, 1, t.outline);
  p.rect(18, 43, 28, 11, t.face); p.rect(20, 54, 24, 3, t.face);
  p.rect(18, 44, 2, 9, blend(t.face, kIvory, 140));
  p.rect(44, 44, 2, 10, shade); p.rect(21, 56, 22, 1, shade);
  p.rect(14, 39, 36, 5, t.outline); p.rect(15, 40, 34, 3, t.face);
  p.rect(18, 40, 28, 2, kSoil); p.rect(20, 40, 3, 1, kSoilLight);
  p.rect(39, 40, 4, 1, kSoilLight); p.rect(16, 43, 32, 1, shade);
  if (!seed) expression(p, 32, 47, t.outline, health, mood, blink, celebrate);
  else {
    // A little seed emblem, leaving the real seed as the expressive character.
    p.rect(30, 48, 4, 5, shade); p.rect(29, 49, 6, 3, shade);
    p.rect(31, 48, 1, 4, blend(t.face, kIvory, 100));
  }
}

void seed(const Pixels &p, const ui_theme::Theme &t,
          uint8_t health, uint8_t mood, bool blink, bool celebrate) {
  const uint16_t edge = blend(kSoilLight, t.outline, 90);
  const uint16_t body = rgb(219, 192, 139);
  p.rect(29, 21, 6, 2, edge); p.rect(26, 23, 12, 3, edge);
  p.rect(24, 26, 16, 11, edge); p.rect(26, 37, 12, 3, edge);
  p.rect(28, 40, 8, 1, edge);
  p.rect(29, 23, 6, 2, body); p.rect(27, 25, 10, 13, body);
  p.rect(25, 27, 14, 9, body); p.rect(29, 38, 6, 2, body);
  p.rect(28, 25, 2, 3, kGold); p.rect(26, 28, 1, 4, kGold);
  p.rect(36, 27, 2, 3, blend(body, kSoilLight, 90));
  expression(p, 32, 30, t.outline, health, mood, blink, celebrate, true);
}

void herb(const Pixels &p, uint8_t species, uint8_t stage,
          const Leaves &c, const ui_theme::Theme &t, uint32_t now) {
  const bool mint = species == 0;
  p.rect(31, stage == 1 ? 28 : 17, 2, stage == 1 ? 14 : 25, c.dark);
  p.rect(32, stage == 1 ? 28 : 17, 1, stage == 1 ? 13 : 24, c.body);
  if (stage == 1) {
    tinyLeaf(p, 24, 24, false, c); tinyLeaf(p, 32, 22, true, c);
    return;
  }
  leaf(p, 18, 24, false, mint, c); leaf(p, 32, 23, true, mint, c);
  leaf(p, 18, 12, false, mint, c); leaf(p, 32, 11, true, mint, c);
  if (stage < 3) {
    tinyLeaf(p, 26, 9, false, c); tinyLeaf(p, 32, 7, true, c);
    return;
  }
  // Herbs have little flowering spikes, then golden harvest/seed details.
  const uint16_t petal = stage == 3 ? (mint ? t.second : kIvory) : kGold;
  const uint16_t petalShade = blend(petal, c.dark, 70);
  for (int16_t branch = 0; branch < 2; ++branch) {
    const int16_t x = branch == 0 ? 26 : 39;
    const int16_t top = branch == 0 ? 3 : 7;
    p.rect(x, top + 2, 1, 17, c.dark);
    for (int16_t row = 0; row < 3; ++row) {
      const int16_t y = top + row * 4;
      p.rect(x - 2, y + 1, 5, 2, petalShade);
      p.rect(x - 1, y, 3, 2, petal);
      p.rect(x, y, 1, 1, kIvory);
    }
  }
  if (stage == 4) {
    leaf(p, 13, 29, false, mint, c); leaf(p, 37, 28, true, mint, c);
    const int16_t drift = static_cast<int16_t>((now / 650U) % 3U);
    p.rect(49, 22 + drift, 1, 2, kGold); p.rect(13, 17 + drift, 1, 2, kGold);
  }
}

void roseFlower(const Pixels &p, int16_t x, int16_t y, const ui_theme::Theme &t) {
  const uint16_t dark = blend(kBerry, t.outline, 50);
  p.rect(x - 5, y - 8, 10, 2, dark); p.rect(x - 8, y - 6, 16, 11, dark);
  p.rect(x - 6, y + 5, 12, 2, dark); p.rect(x - 3, y + 7, 6, 1, dark);
  p.rect(x - 5, y - 7, 10, 3, kPink); p.rect(x - 7, y - 4, 14, 8, kBerry);
  p.rect(x - 5, y + 4, 10, 2, kBerry);
  p.rect(x - 7, y - 4, 3, 5, kPink); p.rect(x + 3, y - 3, 3, 6, kPink);
  p.rect(x - 3, y - 3, 6, 2, dark); p.rect(x - 4, y - 1, 2, 4, dark);
  p.rect(x - 2, y + 2, 5, 2, dark); p.rect(x + 2, y - 1, 2, 3, dark);
  p.rect(x - 2, y - 2, 4, 3, kPink); p.rect(x - 1, y - 1, 2, 1, kIvory);
}

void rose(const Pixels &p, uint8_t stage, const Leaves &c, const ui_theme::Theme &t) {
  p.rect(31, stage == 1 ? 28 : 18, 2, stage == 1 ? 14 : 24, c.dark);
  p.rect(32, stage == 1 ? 28 : 18, 1, stage == 1 ? 13 : 23, c.body);
  if (stage == 1) {
    tinyLeaf(p, 24, 25, false, c); tinyLeaf(p, 32, 23, true, c); return;
  }
  leaf(p, 18, 27, false, true, c); leaf(p, 32, 22, true, true, c);
  p.rect(29, 24, 2, 1, c.dark); p.rect(33, 34, 2, 1, c.dark);
  if (stage == 2) {
    tinyLeaf(p, 25, 17, false, c); tinyLeaf(p, 32, 15, true, c);
    p.rect(29, 11, 6, 7, c.dark); p.rect(30, 10, 4, 8, c.body);
    p.rect(31, 10, 2, 6, c.light);
  } else if (stage == 3) {
    roseFlower(p, 32, 13, t);
    p.rect(28, 21, 3, 2, c.dark); p.rect(34, 21, 3, 2, c.dark);
  } else {
    // A warm rose hip replaces the bloom; a smaller new bud marks renewal.
    const uint16_t red = rgb(215, 129, 93);
    p.rect(28, 10, 8, 2, c.dark); p.rect(26, 12, 12, 10, c.dark);
    p.rect(28, 22, 8, 2, c.dark); p.rect(27, 13, 10, 8, red);
    p.rect(29, 11, 6, 12, red); p.rect(28, 13, 2, 4, kGold);
    p.rect(31, 7, 2, 5, c.dark); p.rect(28, 8, 2, 2, c.dark);
    p.rect(34, 8, 2, 2, c.dark); p.rect(43, 20, 1, 11, c.dark);
    p.rect(41, 17, 5, 5, kBerry); p.rect(42, 16, 3, 2, kPink);
  }
}

void rosette(const Pixels &p, int16_t x, int16_t y, bool small, const Leaves &c) {
  if (small) {
    p.rect(x - 2, y - 5, 4, 7, c.dark); p.rect(x - 6, y - 2, 12, 4, c.dark);
    p.rect(x - 4, y + 2, 8, 2, c.dark);
    p.rect(x - 1, y - 4, 2, 6, c.light);
    p.rect(x - 5, y - 1, 4, 2, c.body); p.rect(x + 1, y - 1, 4, 2, c.body);
    p.rect(x - 3, y + 1, 6, 2, c.body); p.rect(x, y, 1, 2, c.light);
    return;
  }
  p.rect(x - 3, y - 14, 6, 16, c.dark); p.rect(x - 2, y - 13, 4, 14, c.body);
  p.rect(x - 1, y - 12, 2, 9, c.light);
  p.rect(x - 12, y - 8, 8, 12, c.dark); p.rect(x - 10, y - 10, 4, 14, c.dark);
  p.rect(x + 4, y - 8, 8, 12, c.dark); p.rect(x + 6, y - 10, 4, 14, c.dark);
  p.rect(x - 10, y - 7, 5, 10, c.body); p.rect(x + 5, y - 7, 5, 10, c.body);
  p.rect(x - 9, y - 8, 2, 6, c.light); p.rect(x + 7, y - 8, 2, 6, c.light);
  p.rect(x - 17, y - 1, 12, 7, c.dark); p.rect(x + 5, y - 1, 12, 7, c.dark);
  p.rect(x - 14, y + 6, 28, 4, c.dark); p.rect(x - 10, y + 10, 20, 2, c.dark);
  p.rect(x - 16, y, 11, 4, c.body); p.rect(x + 5, y, 11, 4, c.body);
  p.rect(x - 14, y + 6, 12, 2, c.body); p.rect(x + 2, y + 6, 12, 2, c.body);
  p.rect(x - 14, y, 6, 1, c.light); p.rect(x + 8, y, 6, 1, c.light);
  p.rect(x - 7, y + 1, 14, 7, c.dark); p.rect(x - 5, y - 4, 10, 11, c.dark);
  p.rect(x - 3, y - 7, 6, 9, c.dark);
  p.rect(x - 4, y - 3, 8, 9, c.body); p.rect(x - 2, y - 6, 4, 9, c.light);
  p.rect(x - 6, y + 2, 4, 4, c.light); p.rect(x + 2, y + 2, 4, 4, c.light);
  p.rect(x - 2, y + 3, 4, 4, c.dark); p.rect(x - 1, y + 2, 2, 4, c.body);
}

void succulent(const Pixels &p, uint8_t stage, const Leaves &c, const ui_theme::Theme &t) {
  if (stage == 1) { rosette(p, 32, 36, true, c); return; }
  if (stage == 3) {
    p.rect(41, 10, 2, 22, c.dark); p.rect(42, 9, 1, 22, c.body);
    p.rect(39, 8, 6, 2, t.second); p.rect(40, 6, 4, 6, t.second);
    p.rect(41, 8, 2, 2, kGold);
    p.rect(46, 14, 1, 17, c.dark); p.rect(44, 13, 5, 3, kPink);
    p.rect(45, 12, 3, 5, kPink); p.rect(46, 14, 1, 1, kGold);
  }
  rosette(p, 32, stage == 4 ? 25 : 28, false, c);
  if (stage == 4) {
    rosette(p, 20, 36, true, c); rosette(p, 44, 36, true, c);
    p.rect(19, 31, 2, 1, t.second); p.rect(43, 31, 2, 1, t.second);
  }
}

void weeds(const Pixels &p, uint8_t count, const Leaves &c) {
  for (uint8_t n = 0; n < count && n < 3; ++n) {
    const int16_t x = n == 0 ? 19 : (n == 1 ? 44 : 23);
    const int16_t y = n == 2 ? 34 : 36;
    p.rect(x, y, 1, 6, c.dark); p.rect(x - 2, y + 1, 2, 1, c.body);
    p.rect(x + 1, y - 1, 2, 1, c.body); p.rect(x - 3, y, 1, 1, c.light);
  }
}
}

void draw(Arduino_GFX &g, uint8_t themeId, uint8_t species, uint8_t stage,
          int16_t cx, int16_t cy, int16_t radius, uint8_t health,
          uint8_t mood, uint8_t weedCount, uint32_t now, bool celebrate) {
  if (radius <= 0) return;
  if (species > 3) species = 0;
  if (stage > 4) stage = 4;
  if (health > 100) health = 100;
  if (mood > 100) mood = 100;
  const ui_theme::Theme &t = ui_theme::get(themeId);
  Pixels p{g, static_cast<int32_t>(cx) - radius,
           static_cast<int32_t>(cy) - radius, static_cast<int32_t>(radius) * 2};
  const Leaves c = leafColors(species, t, health);
  const uint32_t blinkPhase = now % 5300U;
  // One readable blink, longer than two nominal animation intervals. The
  // previous 90 ms second blink could disappear between rendered frames.
  const bool blink = blinkPhase < 260U;
  pot(p, t, stage == 0, health, mood, blink, celebrate);
  if (stage == 0) seed(p, t, health, mood, blink, celebrate);
  else if (species <= 1) herb(p, species, stage, c, t, now);
  else if (species == 2) rose(p, stage, c, t);
  else succulent(p, stage, c, t);
  weeds(p, weedCount, c);

  if (radius >= 48 && mood >= 55 && health >= 30) {
    const uint8_t phase = (now / 650U) % 4U;
    p.plus(9, 18, phase == 0 ? t.second : blend(t.second, t.background, 130));
    p.plus(54, 29, phase == 2 ? kGold : blend(kGold, t.background, 150));
  }
  if (celebrate) {
    const int16_t rise = static_cast<int16_t>((now / 160U) % 6U);
    p.plus(9, 34 - rise, t.second); p.plus(54, 19 - rise, kGold);
    p.rect(17, 13 - rise, 1, 2, kPink); p.rect(48, 38 - rise, 1, 2, t.second);
    p.rect(24, 8 - rise, 2, 1, kGold); p.rect(51, 10 - rise, 2, 1, t.accent);
  }
}
}
