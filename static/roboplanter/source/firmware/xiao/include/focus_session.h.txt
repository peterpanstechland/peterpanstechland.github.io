#pragma once
#include <cstdint>
#include <string>
namespace robo {
// Authoritative timer: runs without the phone or display, monotonic within a boot.
class FocusSession {
 public:
  enum Phase { Ready=0, Running=1, Paused=2, Completed=3 };
  bool apply(const std::string& action, uint32_t duration, uint32_t now) {
    tick(now);
    if(action=="focus_start") {
      if(phase_==Running || phase_==Paused || duration<60000 || duration>7200000)return false;
      duration_=remaining_=duration;started_=now;phase_=Running;
    } else if(action=="focus_pause") {
      if(phase_!=Running)return false;remaining_=remaining(now);phase_=Paused;
    } else if(action=="focus_resume") {
      if(phase_!=Paused)return false;started_=now;phase_=Running;
    } else if(action=="focus_reset") {remaining_=duration_;phase_=Ready;}
    else return false;
    ++revision_;return true;
  }
  void tick(uint32_t now) {if(phase_==Running && !remaining(now)){remaining_=0;phase_=Completed;++revision_;}}
  uint32_t remaining(uint32_t now) const {if(phase_!=Running)return remaining_;uint32_t elapsed=now-started_;return elapsed>=remaining_?0:remaining_-elapsed;}
  Phase phase() const{return phase_;}
  uint32_t revision() const{return revision_;}
  uint32_t duration() const{return duration_;}
 private:
  Phase phase_=Ready;uint32_t duration_=1500000,remaining_=1500000,started_=0,revision_=0;
};
inline bool focusAction(const std::string& action) {
  return action=="focus_start" || action=="focus_pause" || action=="focus_resume" || action=="focus_reset";
}
}
