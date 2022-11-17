# How to dev with Rockchip

## Usefull tools

* [upgrade_tool](https://gitlab.com/TeeFirefly/RK3328-Nougat/blob/roc-rk3328-cc/RKTools/linux/Linux_Upgrade_Tool/Linux_Upgrade_Tool_v1.24.zip)
* [rkdeveloptool](https://github.com/rockchip-linux/rkdeveloptool)

### Install upgrade_tool

After download the upgrade_tool you probably need to do the follow setup:
```
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install libudev1:i386
sudo apt-get install lib32stdc++6

```

### Install rkdeveloptool

```
sudo apt-get install pkg-config libusb-1.0 libudev-dev libusb-1.0-0-dev dh-autoreconf
```
# clone source and make
```
git clone https://github.com/rockchip-linux/rkdeveloptool
cd rkdeveloptool
autoreconf -i
./configure
make
sudo make install
```

fix:

```
mcedit main.cpp

+//static inline uint32_t convertChipType(const char* chip) {
+//     char buffer[5];
+//     memset(buffer, 0, sizeof(buffer));
+//     snprintf(buffer, sizeof(buffer), "%s", chip);
+//     return buffer[0] << 24 | buffer[1] << 16 | buffer[2] << 8 | buffer[3];
+//}
+
+ static inline uint32_t convertChipType(const char* chip) {
+        char buffer[5];
+        int ret = 0;
+
+        memset(buffer, 0, sizeof(buffer));
+//       snprintf(buffer, sizeof(buffer), "%s", chip);
+        if ((ret = snprintf(buffer, sizeof(buffer), "%s", chip))) {
+             perror("snprintf");
+         }
+        return buffer[0] << 24 | buffer[1] << 16 | buffer[2] << 8 | buffer[3];
+ }
```
