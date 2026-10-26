#include "../../firmware/xiao/include/diagnostic_read_session.h"
#include <cassert>
#include <iostream>
int main() {
  robo::DiagnosticReadSession s;
  const char* key="0123456789abcdef";
  assert(!s.take(key,0));
  assert(!s.start("short",600000,0));
  assert(!s.start("0123456789abcdeG",600000,0));
  assert(!s.start(key,999,0));assert(!s.start(key,600001,0));
  assert(s.start(key,600000,100));
  assert(!s.take("1123456789abcdef",101));
  assert(s.take(key,102));assert(!s.take(key,103));
  assert(s.start(key,1000,0xffffff00));
  assert(s.take(key,0x100));
  assert(s.start(key,1000,0xffffff00));
  assert(!s.take(key,0x2e8)); // Exact expiry, across millis rollover.
  assert(!s.take(key,0x2e9));
  assert(s.start(key,600000,100));s.clear();assert(!s.take(key,101));
  assert(s.start(key,600000,0));
  assert(s.start("fedcba9876543210",600000,1));
  assert(!s.take(key,2));assert(s.take("fedcba9876543210",2));
  std::cout<<"one-use diagnostic read session checks passed\n";
}
