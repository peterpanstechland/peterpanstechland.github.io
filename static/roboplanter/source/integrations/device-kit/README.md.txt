# Device Kit：用户自带硬件的离线接入工具

这个目录让不同硬件使用统一的能力清单、设备登记和遥测检查方式。智能体入口固定为 **YOYO**。它不启动服务器、不扫描 BLE、不连接设备、不读取环境中的令牌，也不发送动作。

完整架构、当前限制和扩展步骤见 [设备平台手册](../../docs/handbook/device-platform.md)。需要 Python 3.10+，只有标准库依赖；现有 MCP 运行环境仍有独立的 Python/SDK 要求。

```bash
# 验证三个硬件 profile：支持的现有契约、实验模板、未来设计。
python3 integrations/device-kit/device_kit.py validate integrations/device-kit/profiles/*.json

# 登记只写本地清单，不执行绑定、激活或连接。
python3 integrations/device-kit/device_kit.py register \
  --registry /tmp/roboplanter-devices.json \
  --profile integrations/device-kit/profiles/xiao-roboplanter-v1.json \
  --device-id desk-planter-01 --label '工位绿植' --transport local-http

# 样例明确是离线数据。记录其哈希和检查时间，不证明硬件在线。
python3 integrations/device-kit/device_kit.py mock-check \
  --profile integrations/device-kit/profiles/xiao-roboplanter-v1.json \
  --fixture integrations/device-kit/fixtures/xiao-state.json \
  --registry /tmp/roboplanter-devices.json --device-id desk-planter-01

python3 integrations/device-kit/device_kit.py list --registry /tmp/roboplanter-devices.json
python3 -m unittest discover -s tests -p test_device_kit.py -v
```

`profile.schema.json` 是封闭字段的 JSON Schema；CLI 还检查跨字段约束。`credential_ref` 只允许 `env:变量名` 或 `provisioning:引用名`，不接受秘密值。示例中的 `<credential-ref>` 是文档符号，永远不会被该工具替换或执行。

`supported` 表示仓库中存在对应本地协议实现；`experimental` 表示模板或链路仍待验证；`planned` 表示没有设备驱动实现。三者都不会打开 YOYO 的硬件调用。登记状态只能是 `registered_offline`、`offline_checked`、`retired`，没有声称设备在线或激活的状态。
