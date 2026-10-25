# Crop Knowledge：离线来源与适用性原型

本目录用来源索引和定性证据卡，检查一个作物上下文能参考哪些资料。Python 3.10+，只用标准库，不安装模型、不联网、不读取设备，不输出灌水/施肥剂量，也不执行控制。它不是已校准的作物生长模型或完整养护处方系统。

当前收录 33 条来源索引和 4 张美国州级定性参考示例卡。四张卡均不覆盖中国地区；源码校验通过不代表知识完整或当地处方已审核。

## 命令

在仓库根目录运行：

```bash
python3 integrations/crop-knowledge/knowledge.py validate
python3 integrations/crop-knowledge/knowledge.py validate --context integrations/crop-knowledge/examples/synthetic-tomato.json
python3 integrations/crop-knowledge/knowledge.py sources --topic irrigation
python3 integrations/crop-knowledge/knowledge.py assess --context integrations/crop-knowledge/examples/synthetic-tomato.json --as-of 2026-10-25
python3 integrations/crop-knowledge/knowledge.py assess --context integrations/crop-knowledge/examples/synthetic-unknown.json --as-of 2026-10-25
python3 -m unittest discover -s tests -p test_crop_knowledge.py -v
```

可在子命令前传 `--sources <本地文件> --evidence <本地文件>` 使用另一份经审阅的离线资料；不会获取其中的URL。`sources.json`记录资料与许可证，`evidence.json`记录适用边界。没有证据卡覆盖的操作会列在 `unsupported_operations`。所有程序结果（含错误）固定 `automatic_action:false`、`mode:offline_reference`。

示例全部为 `synthetic:true`，不是用户的地区/品种配置，也不证明卡片适用于真实阳台。未知字段用 `null`，输出 `missing`。地区只检查两位大写国家代码的格式，不校验完整ISO国家名录；行政区、城市和自由文本目标不自动推断。

## 物候与适用性规则

`last_confirmed_stage` 只能来自当前 `plant_id`、声明由grower/agronomist确认、`kind=observed`、时间不晚于截止日期的记录。当前CLI只读取输入声明，**没有验证观察者身份或照片、记录的真伪**；真实服务需要认证、授权和证据审核流程。`--as-of` 包含指定 **UTC日期全天**，不猜用户所在地时区；观察时间必须带明确时区。预测、别的植株、未来观察、未知阶段不推进状态。阶段支持萌发、幼苗、营养生长、开花、果实发育、转熟、采收、衰老、休眠，不使用BBCH数值。

当前只有单阶段摘要，不能表达同时开花和结果；同一最新时刻出现不同阶段时返回未知，**不判定植物存在生物学矛盾**。输出的 `stage_summary_note` 明示这个模型限制。未来应按器官、花序和种植周期记录物候，再生成适当的展示摘要。

种植日期和 `growth_habit` 只作为上下文；不会依据设备运行时间、XP、点击数或累计天数推断开花。当前记录未建多周期模型，重新种植时应使用新的plant_id，以免旧周期的真实观察混入。

证据卡按物种、国家、可选省州、环境和最后确认阶段筛选；`ANY` 仅允许在国家/省州/环境/阶段维度，物种必须明确。卡片有 `admin1` 时按 `US-NY` 等ISO格式代码匹配，未知或不同省州不匹配；没有该字段只表示此维度没有声明限制。`required_fields` 缺失时该卡不可用；匹配卡输出到 `matched_references`，仅供参考阅读，不转成行动。城市与品种的进一步适用集合尚未实现，不能据此发定制处方。

`required_fields` 只允许已定义的叶字段（如 `region.country`、`cycle_anchor.date`、`last_confirmed_stage`）；拒绝 `region`、`cycle_anchor`、`observations` 等容器以及 `observations.stage` 等未定义路径，避免空对象或空列表绕过必填检查。

八类操作为灌溉、施肥、修剪、整形/清理、授粉、嫁接、病虫害管理、采收；来源类型本身不赋予操作能力。只有词表/气象/模型来源而没有适用证据卡时，不自动生成建议。

## 校验与边界

`context.schema.json`描述上下文；Python同时检查时间、唯一ID、封闭字段、来源引用和卡片枚举。来源的HTTPS链接只校验形状，不代表来源内容正确或当前在线；许可证字符串是审阅者记录，不是程序对授权的法律结论。

JSON中的执行器、token、剂量等额外字段被拒绝；证据摘要含数字/常见中文数词+剂量单位时被拒绝。这个定量文本检测只是一道保守门槛，不是完整语言安全解析器。不要向摘要导入可执行指令；程序从不执行自由文本。来源摘要仍应人工审阅，专家本地化验证不能由单元测试代替。

返回码：成功校验/评估为0；格式、引用或输入错误为2。测试使用小型临时来源和证据，不访问公共服务。
