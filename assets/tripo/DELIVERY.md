Peter Pan’s Techland · Cyber Maker Garage 实际制作交付记录

这是使用真实 Tripo GLB 的独立技术预览，尚未完成最终用户验收。13 项均有生成成功的真实原始输出；12 项已配置进场景，07 工具创作区因视觉缺陷保留空位。展示区与工具区分别记录，没有合并或使用替代占位模型。

当前实现版本为 **grounded-v4.2**，本轮构建、桌面场景、手机视口及接地重复执行回归已完成技术检查；移动端整页溢出和两条来源未确定的错误等限制仍明确保留，最终用户验收尚未完成。本文件后方此前各轮构建与浏览器通过记录仍属于历史版本，当前结果见本轮 QA。本轮新增 Tripo 任务 0、积分 0，累计消费仍为 **385 积分**；raw、processed 和网站接入 GLB 均未改写。

工作分支：`codex/cyber-maker-garage-assets`。预览入口：`/maker-garage-preview/`、`/zh-Hans/maker-garage-preview/`。现有首页、文档、博客、中英文及 Challenge 内容仍保留；本交付未自动合并或部署。

完整任务账本、全部 task_id、SHA-256、文件大小、真实费用和坐标处理见 [production-record.json](records/production-record.json)。原素材清单仍作为设计输入，未把其中“未提交”历史说明冒充最新制作状态。

| 资产 | 实际积分 | 当前结果 | 预览与检查 |
|---|---:|---|---|
| `01_garage_shell` | 30 | 车库外壳：已接入；边缘盆栽、交通锥及原地台仍保留。 | [Tripo原始预览](raw/tripo-out/01-garage-shell-de47b250/preview.png) · [QA](records/01_garage_shell.qa.json) |
| `02_roller_shutter` | 20 | 独立卷帘门：26片真实门帘+3固定件，运行时卷起；4个切口轮廓未封。 | [Tripo原始预览](raw/tripo-out/02-roller-shutter-60038920/preview.png) · [QA](records/02_roller_shutter.processed.qa.json) · [处理记录](records/02_roller_shutter.processed.record.json) |
| `03_profile_sign` | 20 | 招牌框：无生成头像，框/灯管仍合并；中心保持空白，未添加或生成头像。 | [Tripo原始预览](raw/tripo-out/03-profile-sign-a4544685/preview.png) · [QA](records/03_profile_sign.qa.json) |
| `04_lucky_cat` | 55 | 蓝色赛博招财猫：真实绑定45骨、1 skin；本地招手clip已独立浏览器播放通过。 | [Tripo原始预览](raw/tripo-out/04-cyber-lucky-cat-blue-v6-source-36e3dca6/preview.png) · [QA](records/04_cyber_lucky_cat.processed.qa.json) · [处理记录](records/04_cyber_lucky_cat.processed.record.json) |
| `05_project_vending` | 30 | 项目贩卖机：已接入；可见主品牌用准确叠加文字，细小伪字与概念小物仍待清理。 | [Tripo原始预览](raw/tripo-out/05-project-vending-54b92a08/preview.png) · [QA](records/05_project_vending.qa.json) |
| `06_showcase_zone` | 20 | 作品展示区：虚构机器人/杂物已从真实网格移除；18个开口轮廓及少量烘焙阴影保留。 | [Tripo原始预览](raw/tripo-out/06-showcase-zone-2c13d6cc/preview.png) · [QA](records/06_showcase_zone.processed.qa.json) · [处理记录](records/06_showcase_zone.processed.record.json) |
| `07_tools_zone` | 30 | 工具创作区：生成成功但视觉拒收，中央工作台缺失；未接入，未用占位替代。 | [Tripo原始预览](raw/tripo-out/07-tools-zone-5cdd8463/preview.png) · [QA](records/07_tools_zone.qa.json) |
| `08_street_lamp` | 30 | 路灯：已接入；单mesh，独立发光部件仍未分离。 | [Tripo原始预览](raw/tripo-out/08-street-lamp-b369cdad/preview.png) · [QA](records/08_street_lamp.qa.json) |
| `09_trash_bin` | 30 | 垃圾桶：已接入技术预览；融合的底片/毛边、细小伪字仍待清理。 | [Tripo原始预览](raw/tripo-out/09-trash-bin-1ae8df17/preview.png) · [QA](records/09_trash_bin.qa.json) |
| `10_utility_cabinet` | 20 | 电箱：已接入；贴纸伪字保留，柜门未独立拆件。 | [Tripo原始预览](raw/tripo-out/10-utility-cabinet-79c20750/preview.png) · [QA](records/10_utility_cabinet.qa.json) |
| `11_tree` | 20 | 小树：移除582个招牌面并保留243个相连叶面；9个接触切边未封。 | [Tripo原始预览](raw/tripo-out/11-tree-f83af78c/preview.png) · [QA](records/11_tree.processed.qa.json) · [处理记录](records/11_tree.processed.record.json) |
| `12_plants_grass` | 20 | 盆栽草地：原整栋kiosk拒收，提取1291个原始植物/盆/草三角后已接入；底缘开放。 | [Tripo原始预览](raw/tripo-out/12-plants-grass-14dc3618/preview.png) · [QA](records/12_plants_grass.processed.qa.json) · [处理记录](records/12_plants_grass.processed.record.json) |
| `13_street_base` | 30 | 街道路沿：已接入并按XYZ拟合；路面/路沿仍在同一mesh。 | [Tripo原始预览](raw/tripo-out/13-street-base-38eb318a/preview.png) · [QA](records/13_street_base.qa.json) |

上表当前 13 项费用合计 355 积分，另有旧版白色招财猫 30 积分，真实总消费为 **385 积分**。新版蓝猫 55 = 生成 30 + 绑定 25；其余 12 项合计 300。17 个唯一任务包括 14 次生成、1 次绑定、2 次免费检查，计费任务 15 个。没有购买积分，原生批次每项仅尝试 1 次。批次后记录余额 **345**，冻结 **0**，见 [余额记录](records/balance-after-batch.json)。这是该次查询快照，不是持续查询的账户余额。

旧猫真实生成任务为 `240c22e7-eac0-42ec-9486-7969d68caf64`，原始文件保留在 `raw/tripo-out/04-lucky-cat-240c22e7/model.glb`；它因风格被新版取代，未绑定、未接入。旧猫的免费检查成功不等于完成骨骼绑定。新版生成任务为 `36e3dca6-efcb-428b-a335-ef2058d6786f`，实际绑定任务为 `9c588a0c-d933-4d60-908a-b8ad5a5c1b72`。

真实 GLB 位置如下；相对路径从本文件所在 `assets/tripo/` 目录开始。原始输出保留在 `raw/`，本地几何处理仅写入 `processed/`。部分静态资产在网站运行时归一化，因此原始 GLB 本身仍保留供应商尺度与中心 pivot。

| 资产 | 当前采用的真实 GLB | 尺寸、坐标与 pivot |
|---|---|---|
| `01_garage_shell` | `raw/tripo-out/01-garage-shell-de47b250/model.glb` | 运行时按 XYZ 拟合 4.5 × 3.2 × 3.5 m；底中心，v4.2 的 mount Y=-0.22 m |
| `02_roller_shutter` | `processed/02_roller_shutter.glb` | processed 仍为 3.8 × 2.55 × 0.16 m；+Z前、Y-up、底中心；v4.2 仅运行时 root=[0.30,-0.02,1.13]、scale=[1,0.71,1] |
| `03_profile_sign` | `raw/tripo-out/03-profile-sign-a4544685/model.glb` | 运行时等比高度 0.8 m；Y转 -90°、底中心，宽深保持源比例；v4.2 root=[-1.65,2.33,1.25]，另有本地实体连接件 |
| `04_lucky_cat` | `processed/04_cyber_lucky_cat.glb` | processed：0.7104 × 0.8 × 0.6 m；+Z前，Y-up，底中心 |
| `05_project_vending` | `raw/tripo-out/05-project-vending-54b92a08/model.glb` | 运行时等比高度 1.8 m；Y转 -90°、底中心，宽深保持源比例 |
| `06_showcase_zone` | `processed/06_showcase_zone.glb` | processed：2.2 × 2.35 × 0.6 m；+Z前，Y-up，底中心 |
| `07_tools_zone` | `raw/tripo-out/07-tools-zone-5cdd8463/model.glb` | 未接入，未归一化 |
| `08_street_lamp` | `raw/tripo-out/08-street-lamp-b369cdad/model.glb` | 运行时等比高度 2.8 m；Y转 -90°、底中心，宽深保持源比例 |
| `09_trash_bin` | `raw/tripo-out/09-trash-bin-1ae8df17/model.glb` | 运行时等比高度 0.95 m；Y转 -90°、底中心，宽深保持源比例 |
| `10_utility_cabinet` | `raw/tripo-out/10-utility-cabinet-79c20750/model.glb` | 运行时等比高度 1.65 m；Y转 -90°、底中心，宽深保持源比例 |
| `11_tree` | `processed/11_tree.glb` | processed：1.956 × 2.2 × 1.659 m；+Z前，Y-up，底中心 |
| `12_plants_grass` | `processed/12_plants_grass.glb` | processed：0.8814 × 0.8 × 0.7581 m；+Z前，Y-up，底中心 |
| `13_street_base` | `raw/tripo-out/13-street-base-38eb318a/model.glb` | v4.2 运行时按 XYZ 拟合 8.5 × 0.3 × 6.6 m；底中心、root=[0,-0.3,0.6]；原先 6.2 × 0.3 × 4.7 m 为历史预览设置 |

网站中的 `static/maker-garage-preview/models/` 是接入副本，哈希也记录在生产账本。蓝猫含 1 个本地制作的 `Techland_Beckon` 动画，2 秒循环、0→12→0→12→0°，作用于已真实绑定的前爪骨骼 node 18；不能将该动画称为 Tripo 付费重定向结果。猫模型的皮肤关节、权重、逆绑定矩阵、CPU姿态及浏览器播放均有检查。通用检查器未实现蒙皮变形边界时报告 unsupported，相关专项验证已补充，不能误读为绑定失败。

卷帘门的 processed 文件采用原模型三角形线性裁切，保留原UV与贴图；开关动作是26片独立门片沿轨道卷起，不是把整片门帘压扁来冒充开门。模型局部元数据仍为 `top=2.58`、`radius=0.38`、`travel=2.58`、`slatCount=26`；固定导轨与顶壳不随动画移动。此前测得完整卷起最高表面约 3.013 m、中间采样约 3.018 m、最低门片表面约 2.142 m，均为未乘场景 root 缩放的局部坐标结果。**grounded-v4.2 为适配真实门洞，另外在运行时把整个门组件 Y 缩放为 0.71，并放到 [0.30,-0.02,1.13]；processed GLB 和局部门片动画元数据不变。** 当前世界坐标中的开合净空须以本轮 QA 为准。

06 清理后可在 [正面截图](records/06_showcase_zone.processed.front.jpg)、[斜侧截图](records/06_showcase_zone.processed.oblique.jpg) 检查；11 小树的清理结果见 [真实浏览器截图](records/11_tree.processed-preview.jpg)。12 盆栽已在真实浏览器前后左右及3/4视角检查，所有新增开边都限制在原地台接触带，适合放在地面上的技术预览；这些模型都不宣称是水密制造模型。

运行完整网站预览：使用 Node.js 20 或更高版本，在仓库根目录执行下列命令。已安装依赖时可跳过 `npm ci`。

```powershell
npm ci
npm start -- --host 127.0.0.1 --port 3000
```

打开 `http://127.0.0.1:3000/maker-garage-preview/`。中文开发预览使用 `npm run start:zh -- --host 127.0.0.1 --port 3001`，打开 `http://127.0.0.1:3001/zh-Hans/maker-garage-preview/`。页面保留非3D栏目入口，场景逐件加载真实GLB，支持失败重试、移动端贴图档位、减少动态效果偏好、独立门片开合和招财猫招手。

构建与静态预览命令：

```powershell
npm run typecheck
npm run build
npm run serve -- --host 127.0.0.1 --port 4173
```

**历史验证（grounded-v4.2 之前）：TypeScript 检查及 en / zh-Hans 生产构建通过。** 构建后的真实浏览器已验证 12/13 模型加载、26片门完全开关、蓝猫招手/特效、中文页面和场景，以及缺失GLB恢复后直接重试。390×844视口下主内容宽度与scrollWidth均382px，手机贴图上限512px；未在实体手机或系统减少动态偏好下实测。详见 [最终QA](records/site-final-qa.json) 与 [构建日志](records/site-build.log)。最终仅调整了展示柜摆放数据，已将同一 assets.json 同步到两个语言构建目录并核对SHA256。

仍需验收的重点：07 完整工具区尚未交付；车库外壳附带杂物、垃圾桶底部碎片、细小生成文字和部分合并子部件仍需精修。贩卖机中的概念小物并非用户真实项目模型，不能据此宣称 PAN、FlipFate、BMO 成品已入柜。准确品牌文字由后期叠加实现，原贴图未被伪称为已彻底清洗。新增付费生成需另行明确费用，不能因本次缺陷自动重试。



可验收的本地构建预览：http://127.0.0.1:4173/zh-Hans/maker-garage-preview/ 。实际截图：[蓝猫骨骼动画](records/04_cyber_lucky_cat.browser.jpg) · [车库正面](records/garage-final-front.jpg) · [手机版页面](records/garage-mobile-page.jpg)。

2026-10-20 美术表现第二轮：已对照两张原始样例调整近距离低机位、雨夜冷暖光、双行品牌字、深圳竖牌、真实地面反射及首屏排版。城市场景远景、灯带和图形均为本地制作的表现层；植物重复摆放使用已有真实 GLB，共增加3处实例，未冒充新增 Tripo 成品。原始输出与接入模型未改动，本轮新增任务0、积分0，项目累计仍为385。

本轮 TypeScript 检查及 en / zh-Hans 完整生产构建通过，12/13加载、卷帘门完全开关、招手/特效开关及中文模型链接均已实测。390×844浏览器视口主内容无横向溢出，最大贴图512px，关闭Bloom、反射目标256px；估算贴图51.6MiB，不包含渲染目标。移动测试出现2条来源未确定的MutationObserver错误，未阻止加载；不宣称手机控制台零错误或实体手机已验收。完整证据见 [本轮QA](records/art-direction-v2.qa.json)、[构建日志](records/site-polish-build.log)。

第二轮历史页面截图：[桌面版](records/garage-polish-v2.jpg) · [手机版](records/garage-polish-v2-mobile.jpg)。此前截图和QA保留作历史对照。工作台缺失、部分网格与贴图细节仍是与样例的主要差距；本轮未新增付费生成，未合并或部署。

2026-10-21 招牌第三轮：主品牌改为逐字手绘轮廓的 PETER PAN’S / TECHLAND，加入交错字形、粗黑描边、青蓝外缘、紫黑挤出、喷点、滴漆和箭头底线。主牌3.1×0.80m、底边2.56m，透明贴图上限仍为1024/512；深圳牌与原始GLB保留。本轮新增Tripo任务0、积分0。

内嵌场景入口更新为 `maker-garage-preview/scene/`，保留语言与版本参数，解决本地serve将旧`.html`重定向后丢参数、iframe继续缓存旧图形的问题。旧HTML入口保留跳转。TypeScript、中英文构建及桌面/390×844场景实际加载检查通过。见 [本轮QA](records/graffiti-v3.qa.json)、[实际场景](records/graffiti-v3-scene.jpg)、[实际整页](records/graffiti-v3-page.jpg)。未部署。

2026-10-21 接地与安装修正 grounded-v4.2（技术检查完成，待用户验收）：

- 真实资产按已求值的低位脚点与承载面的真实三角形做向下射线接触；采用最高接触约束并留 2 mm 座入量。街边道具落到原街道，展示柜落到车库原生室内地面；部分支撑、跨高度边缘会记录警告。车库本体单独按原地台/室内地面偏移下移 0.22 m，不能把此人工复核偏移称为全部底点已自动验收。
- 街道运行时尺寸改为 8.5 × 0.3 × 6.6 m。底侧支撑沿原街道真实三角边界生成至 Y=-0.36 m，只补本地底面/裙边，不以新平面替换真实路面，不宣称水密修复。
- 门组件运行时 root=[0.30,-0.02,1.13]、scale=[1,0.71,1]；头像框 root=[-1.65,2.33,1.25]。这些参数由 ground-contact.js 在 assets.json 初始位置之后应用；assets.json 的旧门/头像框初始位置不等于当前最终场景位置。其余道具最终 Y 由接触计算得出，不能将配置里的 Y=0 当成接地结果。
- 主涂鸦加 3.1 × 0.8 × 0.055 m 金属背板、四个实面射线锚点、撑柱/后竖轨和螺钉。03 原生头像框以底杆套箍及两处真实门柱锚点连接，无新头像。两者保持原 GLB 不动。
- 深圳牌改为 0.64 × 1.00 × 0.16 m 双面实体金属套牌，位于车库本地 [-1.625,1.88,0.505]（Y 另加车库底部偏移），朝−X；覆盖已定位的 01 原生乱码侧牌。两面独立准确排写“深圳 / SHENZHEN”，含边框、螺栓、连接片，未另放悬浮卡片。
- 金属招牌、固定件、街道底侧支撑均标明 locallyAuthored / supportHardware，印刷面另标 graphicOnly；没有冒充新增 Tripo 模型。原始、processed 与接入 GLB 共32个去重文件已对账本 SHA-256，32个一致；这是文件完整性检查，不是本轮视觉验收。

本轮记录依据 [ground-contact.js](../../static/maker-garage-preview/ground-contact.js)、[assets.json](../../static/maker-garage-preview/assets.json)、[art-direction.js](../../static/maker-garage-preview/art-direction.js)。本轮新增付费调用0、积分0，累计仍385；未自动重生成、充值、合并或部署。本轮验证证据见 [grounded-v4 QA](records/grounded-v4.qa.json)；此前轮次的截图与通过状态保持原样作为历史。

grounded-v4.2 最终技术验证：

- TypeScript 检查、en / zh-Hans 完整构建及4个 JavaScript 模块的 node 语法检查通过。scene.js、ground-contact.js、art-direction.js、night-environment.js、assets.json、scene/index.html 共6个源码文件与两个语言构建副本的 SHA-256 全部一致。日志：[TypeScript](records/grounded-v4-typecheck.log) · [生产构建](records/grounded-v4-build.log)。
- 桌面真实加载12/13资产；正面、左侧深圳牌、背面均已检查。26片卷帘门完成关闭/打开（progress=0/1），蓝猫招手与局部特效开关均实测。新开的独立桌面场景捕获到的 warning/error 均为空，此结论不扩展到其他页面或手机控制台。
- 390×844浏览器视口同样加载12/13资产，44张材质贴图、最长边512px、估算53.2 MiB（不含渲染目标、几何和CPU内存）。main 的 clientWidth/scrollWidth 为382/382px；全 document scrollWidth 为419px，来自既有页脚 AWS Builder Community 长链接，因此不宣称整页零溢出。另捕获2条来源未确定的 MutationObserver 错误，无模型或着色器错误；不宣称移动控制台零错误或实体手机已验收。
- [重复接地回归](records/grounded-v4-idempotence.json)通过：真实蒙皮猫连续两次计算未累积位移，边界稳定，40/40脚点有真实街道支撑，原始几何属性/索引及GLB未改动。街道源网格仍有9条模糊上表面边，不宣称水密修复；07工具区仍为生成成功但视觉拒收。

当前证据：[整体/正面](records/grounded-v4-overview.png) · [深圳侧牌](records/grounded-v4-shenzhen.png) · [背面](records/grounded-v4-back.png) · [门完全关闭](records/grounded-v4-door-closed.png) · [整页](records/grounded-v4-page.png) · [手机视口](records/grounded-v4-mobile.png)。本轮新增Tripo任务0、积分0，总消费385；最终用户验收仍为false，未合并或部署。

2026-10-21：按用户要求同步到个人博客，已通过 PR #37 合并并完成 GitHub Pages 发布。正式地址：https://peterpanstechland.github.io/zh-Hans/maker-garage-preview/ 。导航新增创客车库入口，原首页、博客、文档与 Challenge 保留。线上实测12/13真实模型加载、26片门完全开关、招手与特效通过；工具区仍明确未通过验收。本次发布未新增 Tripo 积分。详情见 [发布记录](records/blog-sync-release.json) 与 [线上截图](records/blog-sync-live.png)。
