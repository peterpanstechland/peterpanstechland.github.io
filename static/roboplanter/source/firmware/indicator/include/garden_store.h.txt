#pragma once
#include "garden_model.h"

// Call only from the UI task. A separate namespace and single versioned blob
// keep the virtual garden independent of Wi-Fi settings and real actuators.
namespace garden_store {
bool begin(uint32_t now);
garden::Model &model();
void service(uint32_t now); // Tick, coalesce explicit changes (2 s), checkpoint (60 s).
bool available();

namespace codec {
constexpr size_t kBlobSize = 24 + garden::kSpeciesCount * 32 + 4;
bool encode(const garden::Snapshot &state, uint8_t (&bytes)[kBlobSize]);
bool decode(const uint8_t *bytes, size_t length, garden::Snapshot &state);
} // namespace codec
} // namespace garden_store
