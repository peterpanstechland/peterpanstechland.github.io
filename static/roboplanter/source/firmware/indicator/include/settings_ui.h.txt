#pragma once
#include <cstdint>
#include "ui_model.h"

// UI only: the device_settings worker owns Wi-Fi and persistent storage.
namespace settings_ui {
bool isOpen();
void open();
void close();
void back();
const char *title();
// Draw only y=76..475. The caller draws its shared header and presents the frame.
void draw(uint32_t now, uint8_t themeId);
// While open, consume every gesture (including None) to prevent fall-through.
// Actions require a released Tap with both endpoints inside the same target.
bool handle(ui::Gesture gesture, const ui::TouchGate &touch, uint32_t now);
}
