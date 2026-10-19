---
id: maker-garage-3d
title: 赛博创客车库 · 3D 场景布局方案
sidebar_position: 4
description: 彼得潘的科技谷网站首页 3D 创客车库的模型布局、摄像机、交互和 Tripo GLB 接入方案。
keywords: [3D, Tripo, Three.js, GLB, 创客车库, 首页, 场景设计]
---

# 赛博创客车库｜首页 3D 场景布局 v1

**一个车库、一条故事线、六个主要资产。** 不是把所有项目乱堆在首页，而是做一个可交互的「深圳赛博创客车库」：Maker Garage 是世界，NEKO 是迎宾店长，PΛN、FlipFate、BMO 和 Roomba 则住在里面。

![赛博创客车库俯视布局图](/maker-house/scene-layout.svg)

## 01 / 统一视觉语言

**Maker Garage × 微缩模型 × Cyberpunk 涂鸦。** 深灰黑建筑主体、暗紫色框架、洋红霓虹、少量青蓝屏幕和温暖工作台光。角色采用有手作温度的 2.5D 设计师玩具比例，远看轮廓要清楚，近看才发现 Maker 的细节。

**视觉优先级：**① 车库建筑和入口 ② 门口 NEKO ③ PΛN 与 FlipFate 代表作 ④ BMO 和 Roomba 陪伴角色 ⑤ 后排可选的 Courtside IQ。限制大型悬浮文字、炫光数量和同时旋转的元素，不要让首页再次变乱。

## 02 / 各资产摆位

沿用网站现有 Three.js 坐标系：**X 左右、Y 向上、+Z 表示朝向观众的正门。**

| 资产 | 场景根节点 (X,Y,Z) | 位置 | 交互 |
| --- | --- | --- | --- |
| **Maker Garage** | (0,0,0) | 中心建筑，约 17 × 11.6 场景单位 | 点击进入 / 屋顶淡出 |
| **NEKO 招财猫** | (5.55,0.85,6.43) | 正门右侧迎宾台 | 招手、介绍网站 |
| **PΛN 调酒机器人** | (−5.8,0.78,−2.25) | 后排左侧工作台 | 机械手动作、查看 PΛN |
| **FlipFate** | (−2.5,0.77,−2.2) | 后排中左工作台 | 翻牌、打开项目 |
| **BMO** | (4.5,0.8,−2.2) | 后排右侧工作台 | 表情、陪伴 |
| **Roomba 摄影机器人** | (3.55,0.15,2.35) | 店内前侧自由移动区域 | 相机转头、巡逻 |
| **Courtside IQ** | (1.0,0.8,−2.2) | 后排小展台，可选第七资产 | NBA 分析项目 |

后墙上只有四块导航牌：**PROJECTS / BLOG / CHALLENGE / GUIDES**。其中 CHALLENGE 直接关联已经上线的 [Makers Challenge 企划](/challenge)，不要再另造一套专题首页。

## 03 / 摄像机与访客动线

- **进站 / Arrival：** 45° 左右的正面三分之四构图。左边保留标题「MADE OF IDEAS. BUILT BY HAND.」，中右侧主视觉呈现整个车库和招财猫；让文字有呼吸空间。
- **点击 Enter：** 摄像机缓慢推近，屋顶淡出，可以直接看到后排项目。Tripo 车库模型需把屋顶网格命名为 `ROOF_...` 或 `CEILING_...`，才能跟随自动淡出。
- **自由探索：** 鼠标拖动、滚轮缩放；手机单指拖动。点击 NEKO、PΛN、FlipFate 等，镜头聚焦并出现一张简洁项目卡，仍以网站已有页面为目的地。
- **滚动页面：** WebGL 只是开场。下方项目、Challenge 和文章导航必须保留普通 HTML，保证加载失败也能访问。
- **减弱动画：** 遵守设备 reduced-motion 设置，关闭装饰性动态。

## 04 / 网站文件与模型接入

当前采用 **Docusaurus + iframe 内的 Three.js**，无需把整个个人博客改造成新框架。

| 文件 | 职责 |
| --- | --- |
| `src/pages/index.tsx` | 中英双语入口文案、项目卡片与快捷导航 |
| `static/maker-house/scene.html` | 摄像机、灯光、可点击区域、程序化替身、GLB 导入 |
| `static/maker-house/model-slots.json` | 每个 GLB 的文件路径、位移、缩放和旋转 |
| `static/maker-house/scene-layout.svg` | 可以编辑的俯视布局图 |
| `static/maker-house/TRIPO_MODELS.md` | Tripo 建模提示词和替换说明 |

**目前是程序化占位模型，不是假装完成的 Tripo 成品。** 当你导出模型后，把 `.glb` 放在 `static/maker-house/models/`，再修改 `model-slots.json` 对应的 `file`。不需要重新开发导航、摄像机和交互，也可以逐个替换。

**Maker Garage 结构要求：** 原点位于地面中心，正面朝 +Z，宽约 17、深约 11.6、高约 8 单位；不要烘焙角色、地面背景或贴图天空。屋顶单独分 Mesh 或 Parent，名字包含 `ROOF` 或 `CEILING`，就能在进入时透明淡出。否则直接采用开放式剖面车库。

## 05 / 推荐制作顺序

1. **主店铺：** `maker-garage.glb`，先解决外轮廓、门头、灯光与内部展位，不追求海量装饰。
2. **NEKO：** `neko-luckycat.glb`，招手动画和清晰可爱轮廓最优先。
3. **PΛN：** `pan-cocktail-robot.glb`；**FlipFate：** `flipfate-machine.glb`，保持与真实项目相符的关键机械特征。
4. **BMO：** `bmo-companion.glb`；**Roomba：** `roomba-camera-bot.glb`，安排轻量循环动画。
5. **Blender 后处理：** 对齐朝向和 Pivot，清理悬浮网格，检查材质与动作，压缩贴图。
6. **性能与验收：** 单角色尽量控制在 1–2 MB（作为优化目标而非硬性限制），优先检查手机加载速度、点击热区以及低动态模式。

## 06 / 交互路径

| 点击 | 预期反馈 | 跳转 |
| --- | --- | --- |
| ENTER THE GARAGE | 镜头推入、屋顶淡出 | 留在首页 |
| NEKO | 招手与欢迎项目卡 | [About](/docs/about) |
| PΛN | 机械手轻摆、镜头聚焦 | [PΛN 项目文章](/docs/hackathons/2026/aix-origin-apex-hand) |
| FlipFate | 卡牌翻转、镜头聚焦 | [Projects](/docs/projects) |
| BMO | 轻微摆动、表情 | [Projects](/docs/projects) |
| Roomba | 摄像头转向、底盘移动 | [Roomba-VLLM](/docs/hackathons/2026/roomba-vllm) |
| CHALLENGE 招牌 | 选中栏目提示 | [Makers Challenge](/challenge) |

## 07 / 实际完成情况

**代码已经具备：**首页真实 Three.js 场景、建筑与角色占位体、摄像机动画、点击入口、双语文字、普通网页导航、加载失败回退图、模型替换配置。

**后续仍需要：**正式 Tripo / Blender GLB 文件、动画片段、实际设备上的性能测试与最终视觉验收。现有程序化物体不能冒充实际生成的 3D 模型。

相关页面：[返回首页](/) · [Makers Challenge](/challenge) · [赞助展位产品与设备征集](/docs/challenges/sponsors)
