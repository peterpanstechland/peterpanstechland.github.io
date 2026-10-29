#pragma once
#include <Arduino.h>
namespace local_soil {
struct Sample { bool valid=false; int raw=-1; uint32_t receivedMs=0,sequence=0; char boot[9]={}; };
bool begin();
Sample snapshot();
bool notifyFocusComplete(); // One bounded chime; UART worker owns the transport.
}
