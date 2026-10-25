#pragma once
#include <cstdint>
#include "ui_model.h"

// A local raising game. These entry points never submit actuator commands.
namespace garden_ui {
bool isOpen();
void close();
void openCare();
void openSpecies();
void openMood();
const char *title();
void drawHome(uint32_t now, uint8_t themeId);
void draw(uint32_t now, uint8_t themeId);
bool handleHome(ui::Gesture gesture, const ui::TouchGate &touch, uint32_t now);
bool handle(ui::Gesture gesture, const ui::TouchGate &touch, uint32_t now);
void focusCompleted(uint32_t now);
}
