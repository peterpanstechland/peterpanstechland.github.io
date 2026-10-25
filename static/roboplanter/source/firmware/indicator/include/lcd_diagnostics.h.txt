#pragma once

// Present only in the explicitly selected sensecap_indicator_lcdtest build.
#if defined(ARDUINO) && defined(RP_LCD_FLASH_STRESS)
namespace lcd_diagnostics {
bool runFlashStress();
}
#endif
