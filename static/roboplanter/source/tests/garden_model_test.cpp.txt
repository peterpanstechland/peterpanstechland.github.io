#include "garden_model.h"
#include "garden_store.h"
#include <Preferences.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

static unsigned checks = 0;
#define CHECK(x) do { ++checks; if (!(x)) { std::fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #x); std::exit(1); } } while (0)
using namespace garden;

static void modelChecks() {
  Model game; game.begin(123);
  CHECK(game.selected() == Species::Mint);
  CHECK(game.stage() == Stage::Seed && game.progressPercent() == 0);
  CHECK(game.current().health == 80 && game.current().weeds == 0);
  CHECK(game.care(Care::Fertilize) == Result::NotReady);
  CHECK(game.current().xp == 0 && game.current().nutrition == 55);
  CHECK(game.care(Care::Weed) == Result::NotNeeded);
  CHECK(game.care(Care::Water) == Result::Applied);
  CHECK(game.current().xp == 8 && game.current().moisture == 90);
  CHECK(game.care(Care::Water) == Result::CoolingDown);
  CHECK(game.remainingSeconds(Care::Water) == 90);
  CHECK(game.stage() == Stage::Seed); // XP alone cannot skip the seed.
  game.tick(30123);
  CHECK(game.remainingSeconds(Care::Water) == 60 && game.progressPercent() == 10);
  CHECK(game.nextStageSeconds() == 270 && game.nextStageXp() == 0);
  game.tick(30123);
  CHECK(game.current().activeSeconds == 30);
  CHECK(game.select(Species::Basil));
  CHECK(game.current().xp == 0 && game.stage() == Stage::Seed);
  game.tick(60123);
  CHECK(game.current().activeSeconds == 30);
  CHECK(game.plant(Species::Mint).activeSeconds == 30);
  CHECK(game.select(Species::Mint));
  CHECK(game.current().xp == 8 && game.remainingSeconds(Care::Water) == 60);
  game.tick(330123);
  CHECK(game.stage() == Stage::Sprout);
  CHECK(game.current().activeSeconds == 300 && game.progressPercent() == 0);
  CHECK(game.nextStageSeconds() == 1500 && game.nextStageXp() == 22);
  CHECK(game.care(Care::Weed) == Result::NotNeeded);
  game.tick(630123);
  CHECK(game.care(Care::Weed) == Result::Applied);
  CHECK(game.care(Care::Weed) == Result::CoolingDown);
  CHECK(game.care(Care::Fertilize) == Result::Applied);
  CHECK(game.care(Care::Fertilize) == Result::CoolingDown);
  CHECK(game.care(static_cast<Care>(9)) == Result::Invalid);
  CHECK(!game.select(Species::Count));
  CHECK(!game.setAtmosphere(static_cast<Atmosphere>(9)));
  CHECK(game.setAtmosphere(Atmosphere::Tired) && game.atmosphere() == Atmosphere::Tired);

  Model fresh; fresh.begin(0); fresh.tick(10800000);
  CHECK(fresh.stage() == Stage::Seed && fresh.progressPercent() == 0); // Time alone is insufficient.
  CHECK(fresh.current().health >= 20);
  CHECK(fresh.rewardFocus() == Result::Applied);
  CHECK(fresh.rewardFocus() == Result::CoolingDown);
  fresh.tick(12300000);
  CHECK(fresh.rewardFocus() == Result::Applied);
  Model early; early.begin(0);
  CHECK(early.rewardFocus() == Result::NotReady);
  early.tick(1499999);
  CHECK(early.rewardFocus() == Result::NotReady);
  early.tick(1500000);
  CHECK(early.rewardFocus() == Result::Applied);
  CHECK(early.current().xp == 20);
  CHECK(early.select(Species::Rose));
  CHECK(early.rewardFocus() == Result::CoolingDown); // Switching cannot duplicate a focus reward.
  auto save = early.snapshot();
  Model reboot; CHECK(reboot.restore(save, 3500000000UL));
  reboot.tick(3500000000UL);
  CHECK(reboot.snapshot().totalActiveSeconds == 1500 && reboot.rewardFocus() == Result::CoolingDown);
  CHECK(reboot.current().activeSeconds == 0); // No offline growth or other-species time.

  for (uint8_t species = 0; species < 4; ++species) {
    for (uint8_t stage = 0; stage < 5; ++stage) {
      Snapshot s;
      s.selected = static_cast<Species>(species);
      s.plants[species].activeSeconds = kStageMinutes[stage] * 60;
      s.plants[species].xp = kStageXp[stage];
      CHECK(reboot.restore(s, 0));
      CHECK(reboot.stage() == static_cast<Stage>(stage));
      CHECK(reboot.progressPercent() == (stage == 4 ? 100 : 0));
      if (stage) {
        --s.plants[species].activeSeconds;
        CHECK(reboot.restore(s, 0));
        CHECK(reboot.stage() == static_cast<Stage>(stage - 1));
        ++s.plants[species].activeSeconds;
        --s.plants[species].xp;
        CHECK(reboot.restore(s, 0));
        CHECK(reboot.stage() == static_cast<Stage>(stage - 1));
      }
    }
  }
  Snapshot partial;
  partial.plants[0].activeSeconds = 150; partial.plants[0].xp = 4;
  CHECK(reboot.restore(partial, 0) && reboot.progressPercent() == 50);
  partial.plants[0].xp = 2;
  CHECK(reboot.restore(partial, 0) && reboot.progressPercent() == 25);
  partial.plants[0].activeSeconds = 300; partial.plants[0].xp = 4;
  CHECK(reboot.restore(partial, 0) && reboot.progressPercent() == 50);

  Model wrap; wrap.begin(UINT32_MAX - 499); wrap.tick(500);
  CHECK(wrap.current().activeSeconds == 1 && wrap.current().partialMs == 0);
  wrap.tick(1001); CHECK(wrap.current().partialMs == 501);
  Model resumed; CHECK(resumed.restore(wrap.snapshot(), 0));
  resumed.tick(499); CHECK(resumed.current().activeSeconds == 2 && resumed.current().partialMs == 0);
  Model dry; dry.begin(0); dry.tick(4000000000UL);
  CHECK(dry.current().health == 20 && dry.current().moisture == 0 && dry.current().weeds == 100);
  CHECK(dry.care(Care::Water) == Result::Applied && dry.current().health > 20);
  CHECK(dry.stage() == Stage::Sprout); // A dry plant can always recover and continue.
  Model succulent; succulent.begin(0); succulent.select(Species::Succulent); succulent.tick(180000);
  Model mint; mint.begin(0); mint.tick(180000);
  CHECK(succulent.current().moisture == 59 && mint.current().moisture == 54);
  const uint32_t revision = mint.revision(); mint.tick(181000);
  CHECK(mint.revision() == revision); // Time does not trigger a 2-second save on every tick.

  Snapshot invalid;
  invalid.plants[1].health = 19; CHECK(!reboot.restore(invalid, 0));
  invalid = Snapshot(); invalid.plants[0].careReadySeconds[0] = 91; CHECK(!Model::valid(invalid));
  invalid = Snapshot(); invalid.plants[0].partialMs = 1000; CHECK(!Model::valid(invalid));
  invalid = Snapshot(); invalid.focusRewarded = true; CHECK(!Model::valid(invalid));
  invalid = Snapshot(); invalid.totalActiveSeconds = kMaxActiveSeconds + 1; CHECK(!Model::valid(invalid));
  invalid = Snapshot(); invalid.selected = Species::Count; CHECK(!Model::valid(invalid));
}

static void codecChecks() {
  Model game; game.begin(0); game.care(Care::Water); game.tick(500);
  game.select(Species::Rose);
  Snapshot fixture = game.snapshot(); fixture.plants[2].activeSeconds = 300; fixture.plants[2].xp = 8;
  CHECK(game.restore(fixture, 500));
  CHECK(game.care(Care::Fertilize) == Result::Applied);
  game.setAtmosphere(Atmosphere::Happy);
  struct GuardedBlob {
    uint8_t before[16]; uint8_t bytes[garden_store::codec::kBlobSize]; uint8_t after[16];
  } guarded;
  std::memset(&guarded, 0xa5, sizeof(guarded));
  auto &bytes = guarded.bytes;
  CHECK(garden_store::codec::encode(game.snapshot(), bytes));
  for (size_t i = 0; i < 16; ++i) CHECK(guarded.before[i] == 0xa5 && guarded.after[i] == 0xa5);
  Snapshot decoded; CHECK(garden_store::codec::decode(bytes, sizeof(bytes), decoded));
  Model restored; CHECK(restored.restore(decoded, 4000000));
  CHECK(restored.selected() == Species::Rose && restored.atmosphere() == Atmosphere::Happy);
  CHECK(restored.plant(Species::Mint).xp == 8 && restored.plant(Species::Mint).partialMs == 500);
  CHECK(restored.remainingSeconds(Care::Fertilize) == 180);
  restored.select(Species::Mint); CHECK(restored.remainingSeconds(Care::Water) == 90);
  for (size_t i = 0; i < sizeof(bytes); ++i) {
    bytes[i] ^= 1;
    CHECK(!garden_store::codec::decode(bytes, sizeof(bytes), decoded));
    bytes[i] ^= 1;
  }
  CHECK(!garden_store::codec::decode(bytes, sizeof(bytes) - 1, decoded));
  CHECK(!garden_store::codec::decode(nullptr, sizeof(bytes), decoded));
  // Valid checksums do not make unsupported versions or invalid state valid.
  const auto rejectWithValidChecksum = [&](size_t offset, uint8_t value) {
    uint8_t candidate[garden_store::codec::kBlobSize];
    std::memcpy(candidate, bytes, sizeof(candidate)); candidate[offset] = value;
    uint32_t hash = 2166136261UL;
    for (size_t i = 0; i < sizeof(candidate) - 4; ++i) hash = (hash ^ candidate[i]) * 16777619UL;
    for (uint8_t i = 0; i < 4; ++i) candidate[sizeof(candidate) - 4 + i] = static_cast<uint8_t>(hash >> (8 * i));
    const Species original = decoded.selected;
    CHECK(!garden_store::codec::decode(candidate, sizeof(candidate), decoded));
    CHECK(decoded.selected == original);
  };
  rejectWithValidChecksum(4, 2); // Unknown version.
  rejectWithValidChecksum(6, 155); // Incorrect declared length.
  rejectWithValidChecksum(8, 4); // Invalid species.
  rejectWithValidChecksum(9, 4); // Invalid atmosphere.
  rejectWithValidChecksum(10, 2); // Non-canonical boolean.
  rejectWithValidChecksum(11, 1); // Reserved header byte.
  rejectWithValidChecksum(22, 1); // Reserved alignment bytes.
  rejectWithValidChecksum(24, 19); // Health cannot go below the recovery floor.
  rejectWithValidChecksum(25, 101); // Moisture bounds.
  rejectWithValidChecksum(26, 101); // Nutrition bounds.
  rejectWithValidChecksum(27, 101); // Weed bounds.
  rejectWithValidChecksum(28, 101); // Mood bounds.
  rejectWithValidChecksum(29, 1); // Reserved plant byte.
  rejectWithValidChecksum(31, 4); // Millisecond remainder exceeds 999.
  rejectWithValidChecksum(35, 1); // XP exceeds its cap.
  rejectWithValidChecksum(43, 1); // Cooldown cannot extend arbitrarily into the future.
  auto invalid = game.snapshot(); invalid.plants[0].moisture = 101;
  CHECK(!garden_store::codec::encode(invalid, bytes));
}

static void storageChecks(const char *mode) {
  const bool corrupt = std::strcmp(mode, "corrupt") == 0;
  const bool unavailable = std::strcmp(mode, "unavailable") == 0;
  const bool loaded = std::strcmp(mode, "loaded") == 0;
  if (corrupt) Preferences::values["save"] = std::vector<uint8_t>(garden_store::codec::kBlobSize, 0xff);
  if (loaded) {
    Model previous; previous.begin(0); previous.care(Care::Water); previous.tick(30500);
    uint8_t bytes[garden_store::codec::kBlobSize];
    CHECK(garden_store::codec::encode(previous.snapshot(), bytes));
    Preferences::values["save"] = std::vector<uint8_t>(bytes, bytes + sizeof(bytes));
  }
  Preferences::available = !unavailable;
  CHECK(garden_store::begin(100) == !unavailable);
  CHECK(garden_store::available() == !unavailable);
  CHECK(garden_store::model().stage() == Stage::Seed);
  if (loaded) {
    CHECK(garden_store::model().current().xp == 8);
    CHECK(garden_store::model().remainingSeconds(Care::Water) == 60);
    garden_store::service(2100); CHECK(Preferences::writes == 0);
    garden_store::service(60100); CHECK(Preferences::writes == 1);
    return;
  }
  CHECK(garden_store::model().current().xp == 0);
  garden_store::service(2099); CHECK(Preferences::writes == 0);
  garden_store::service(2100); CHECK(Preferences::writes == (unavailable ? 0u : 1u));
  if (unavailable) {
    Preferences::available = true;
    garden_store::service(30099); CHECK(Preferences::writes == 0);
    garden_store::service(30100); CHECK(Preferences::writes == 1 && garden_store::available());
    return;
  }
  const unsigned writes = Preferences::writes;
  garden_store::model().care(Care::Water); garden_store::service(2200);
  garden_store::service(4199); CHECK(Preferences::writes == writes);
  garden_store::model().setAtmosphere(Atmosphere::Busy); garden_store::service(4200);
  garden_store::service(6199); CHECK(Preferences::writes == writes);
  garden_store::service(6200); CHECK(Preferences::writes == writes + 1);
  Snapshot saved;
  const auto &blob = Preferences::values["save"];
  CHECK(garden_store::codec::decode(blob.data(), blob.size(), saved));
  CHECK(saved.atmosphere == Atmosphere::Busy && saved.plants[0].xp == 8);
  garden_store::service(66199); CHECK(Preferences::writes == writes + 1);
  garden_store::service(66200); CHECK(Preferences::writes == writes + 2);
  Preferences::available = false;
  garden_store::model().setAtmosphere(Atmosphere::Happy); garden_store::service(67000);
  garden_store::service(69000); CHECK(!garden_store::available());
  const unsigned failed = Preferences::writes;
  garden_store::service(70000); CHECK(Preferences::writes == failed);
  Preferences::available = true;
  garden_store::service(98999); CHECK(Preferences::writes == failed);
  garden_store::service(99000); CHECK(Preferences::writes == failed + 1 && garden_store::available());
}
int main(int argc, char **argv) {
  const char *mode = argc > 1 ? argv[1] : "normal";
  modelChecks(); codecChecks(); storageChecks(mode);
  std::printf("Garden %s: %u checks passed.\n", mode, checks);
}
