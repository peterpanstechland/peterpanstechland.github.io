#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace robo {

struct BleTicket {
  uint64_t generation;
  uint16_t connectionId;
  BleTicket(uint64_t value = 0, uint16_t connection = 0)
      : generation(value), connectionId(connection) {}
  bool valid() const { return generation != 0; }
};

inline bool sameBleTicket(const BleTicket& a, const BleTicket& b) {
  return a.valid() && a.generation == b.generation && a.connectionId == b.connectionId;
}

// Caller holds one mutex across admission, command execution, notification and
// connection changes. A reused ESP-IDF connection ID is not the same session.
class BleSession {
 public:
  bool connect(uint16_t connectionId) {
    if (connected_) return false;
    ++generation_;
    if (generation_ == 0) ++generation_;
    connectionId_ = connectionId;
    connected_ = true;
    notifications_ = false;
    return true;
  }
  bool disconnect(uint16_t connectionId) {
    if (!connected_ || connectionId != connectionId_) return false;
    connected_ = notifications_ = false;
    return true;
  }
  BleTicket ticketFor(uint16_t connectionId) const {
    return connected_ && connectionId == connectionId_
        ? BleTicket{generation_, connectionId_} : BleTicket{};
  }
  bool matches(const BleTicket& ticket) const {
    return connected_ && sameBleTicket(ticket, ticketFor(connectionId_));
  }
  void setNotifications(uint16_t connectionId, bool enabled) {
    if (ticketFor(connectionId).valid()) notifications_ = enabled;
  }
  bool mayReply(const BleTicket& ticket) const { return matches(ticket) && notifications_; }

 private:
  uint64_t generation_ = 0;
  uint16_t connectionId_ = 0;
  bool connected_ = false;
  bool notifications_ = false;
};

// Existing ATT prepare/execute writes only; this is not an application framing
// protocol. The Arduino BLE library's accumulation is shared across clients and
// survives disconnect, so business commands use this bounded session-owned copy.
template <size_t Capacity>
class BlePreparedWrite {
 public:
  void reset() {
    ticket_ = {};
    used_ = 0;
    invalid_ = false;
    bytes_.fill(0);
  }
  bool append(const BleTicket& ticket, size_t offset, const uint8_t* data, size_t size) {
    if (invalid_) return false;
    if (!ticket.valid() || !data || size == 0 || offset != used_ || size > Capacity - used_ ||
        (used_ != 0 && !sameBleTicket(ticket_, ticket))) {
      invalid_ = true;
      return false;
    }
    if (used_ == 0) ticket_ = ticket;
    std::memcpy(bytes_.data() + used_, data, size);
    used_ += size;
    return true;
  }
  bool finish(const BleTicket& ticket, char (&output)[Capacity + 1]) {
    const bool valid = !invalid_ && used_ != 0 && sameBleTicket(ticket_, ticket) &&
                       std::memchr(bytes_.data(), '\0', used_) == nullptr;
    if (valid) {
      std::memcpy(output, bytes_.data(), used_);
      output[used_] = '\0';
    }
    reset();
    return valid;
  }

 private:
  std::array<char, Capacity> bytes_{};
  BleTicket ticket_{};
  size_t used_ = 0;
  bool invalid_ = false;
};

}  // namespace robo
