#pragma once
#include <map>
#include <string>
#include <vector>
#include <cstring>
class Preferences {
 public:
  inline static std::map<std::string, std::vector<uint8_t>> values;
  inline static unsigned writes = 0;
  inline static bool available = true;
  bool begin(const char *, bool) { return available; }
  bool isKey(const char *key) { return values.count(key) != 0; }
  bool remove(const char *key) { ++writes; values.erase(key); return available; }
  size_t putUChar(const char *key, uint8_t value) { return putBytes(key, &value, 1); }
  uint8_t getUChar(const char *key, uint8_t fallback) { return values.count(key) && values[key].size() == 1 ? values[key][0] : fallback; }
  size_t putBytes(const char *key, const void *bytes, size_t length) {
    ++writes; if (!available) return 0;
    const auto *p = static_cast<const uint8_t *>(bytes); values[key] = std::vector<uint8_t>(p, p + length); return length;
  }
  size_t getBytesLength(const char *key) { return values.count(key) ? values[key].size() : 0; }
  size_t getBytes(const char *key, void *out, size_t capacity) {
    if (!values.count(key) || values[key].size() > capacity) return 0;
    std::memcpy(out, values[key].data(), values[key].size()); return values[key].size();
  }
};
