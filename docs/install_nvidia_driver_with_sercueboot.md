Step 1: Download the nvidia driver

Step 2: create keys 

```
openssl req -new -x509 -newkey rsa:2048 -keyout PATH_TO_PRIVATE_KEY -outform DER -out PATH_TO_PUBLIC_KEY -nodes -days 36500 -subj "/CN=Graphics Drivers"
```

eg. ```PATH_TO_PRIVATE_KEY``` = ```/home/xxx/nvidia.key```, ```PATH_TO_PUBLIC_KEY``` = ```/home/xxx/nvidia.der```


Step 3: Enroll the public key (nvidia.der) to MOK (Machine Owner Key)

```
sudo mokutil --import /home/xxx//nvidia.der
```

Step 4: disable the Nouveau kernel driver 

```
echo options nouveau modeset=0 | sudo tee -a /etc/modprobe.d/nouveau-kms.conf; sudo update-initramfs -u
```

Step 5: reboot

```
sudo reboot
```

Step 6: Install the driver 

```
sudo sh ./XXXXXX.run -s --module-signing-secret-key=PATH_TO_PRIVATE_KEY --module-signing-public-key=PATH_TO_PUBLIC_KEY
```

eg. ```PATH_TO_PRIVATE_KEY``` = ```/home/xxx/nvidia.key```, ```PATH_TO_PUBLIC_KEY``` = ```/home/xxx/nvidia.der```

