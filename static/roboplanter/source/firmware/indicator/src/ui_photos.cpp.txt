#include "ui_photos.h"
#if __has_include("photos.local.h")
#include "photos.local.h"
#define ROBO_HAS_PHOTOS 1
#else
#define ROBO_HAS_PHOTOS 0
#endif
namespace ui_photos {
size_t count() {
#if ROBO_HAS_PHOTOS
  return local_photos::kCount;
#else
  return 0;
#endif
}
const char *caption(size_t index) {
#if ROBO_HAS_PHOTOS
  if (index < local_photos::kCount) return local_photos::kPhotos[index].caption;
#endif
  (void)index;
  return "";
}
bool draw(Arduino_GFX &gfx, size_t index, int16_t x, int16_t y) {
#if ROBO_HAS_PHOTOS
  static_assert(local_photos::kWidth == kWidth && local_photos::kHeight == kHeight,
                "Photo pack resolution must match the UI");
  if (index < local_photos::kCount) {
    // One scanline in RAM selects the RGB driver's bulk-copy overload instead
    // of Arduino_GFX's slow per-pixel const bitmap fallback. Only 800 B stack.
    uint16_t row[kWidth];
    const uint16_t *pixels = local_photos::kPhotos[index].pixels;
    for (int16_t line = 0; line < kHeight; ++line) {
      memcpy(row, pixels + line * kWidth, sizeof(row));
      gfx.draw16bitRGBBitmap(x, y + line, row, kWidth, 1);
    }
    return true;
  }
#endif
  (void)gfx; (void)index; (void)x; (void)y;
  return false;
}
}  // namespace ui_photos
