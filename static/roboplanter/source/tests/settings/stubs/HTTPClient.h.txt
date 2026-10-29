#pragma once
#include "Arduino.h"
#include <functional>
#include <map>
#include <vector>
class WiFiClient {};
constexpr int HTTPC_DISABLE_FOLLOW_REDIRECTS = 0;
struct SettingsTestPost { String url, body; };
inline unsigned settingsTestHttpBegins = 0;
inline std::vector<SettingsTestPost> settingsTestPosts;
inline String settingsTestStateBody, settingsTestPostBody;
inline int settingsTestPostCode = 200;
inline int settingsTestGetCode = 200;
inline std::function<void(const String &)> settingsTestPostHook;
class HTTPClient {
  String url, response;
 public:
  void setConnectTimeout(unsigned) {}
  void setTimeout(unsigned) {}
  void setReuse(bool) {}
  void setFollowRedirects(int) {}
  bool begin(WiFiClient &, const String &target) { ++settingsTestHttpBegins; url = target; return true; }
  void addHeader(const char *, const char *) {} // Never retain/log device tokens.
  int GET() { response = settingsTestStateBody; return settingsTestGetCode; }
  int POST(const String &body) {
    settingsTestPosts.push_back({url, body});
    if (settingsTestPostHook) settingsTestPostHook(body);
    response = settingsTestPostBody; return settingsTestPostCode;
  }
  int getSize() const { return static_cast<int>(response.size()); }
  String getString() const { return response; }
  void end() {}
};
