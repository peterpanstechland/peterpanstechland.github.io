#pragma once
#include <Arduino_GFX_Library.h>
namespace ui_photos {
constexpr int16_t kWidth = 400, kHeight = 280;
size_t count();
const char *caption(size_t index);
bool draw(Arduino_GFX &gfx, size_t index, int16_t x, int16_t y);
}
