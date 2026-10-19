# Cyber Maker Garage v2 — Art-first Redesign Brief

> Status: design specification, not a new production homepage. This replaces the visual approach, NOT the site's live code. Prepared from the user's comparison screenshots and [Jesse's Ramen case study](https://jesse-zhou.medium.com/jesses-ramen-case-study-77bae77ab5f0). We study the workflow, not copy Jesse's unique building, signage or artwork.

## Core decision

The current homepage is a Three.js greybox, not a finished art asset. Don't add more cubes to the existing scene and claim it looks like Jesse's Ramen. The next visual milestone must be a coherent **original 3D maker alley** model created and art-directed in Blender (using Tripo-generated draft assets for characters if available), rendered into approved hero stills, and *then* integrated into Docusaurus.

**Concept:** Peter Pan's Techland — AFTER HOURS: a small, richly detailed cyberpunk maker garage in a futuristic Shenzhen alley, with a lucky-cat shop host, PAN, FlipFate, BMO and other prototypes displayed as tiny collectible figures.

## What the screenshot comparison teaches us

1. Old: large flat purple roof blocks the studio. New: cutaway roof / open diorama with an immediately visible counter, signage and project windows.
2. Old: huge HTML text covers the main artwork. New: the diorama owns ~65% of the screen; small restrained intro, clear skip-to-blog link and physical signs navigate the content.
3. Old: default materials and a few runtime lights. New: Blender UVs, material atlases, baked global illumination, contact shadows and subtle glossy reflections.
4. Old: dozens of equivalent boxes. New: one recognizable building silhouette, one NEKO focal point, and only a few compelling supporting objects.
5. Old: 3D props are abstract machine boxes. New: each project has a recognizable physical silhouette from reference photos and its own interaction.

## World layout and hierarchy

- Camera: 3/4 isometric overview, entire alley shop visible; black negative space around the mini-world rather than a massive environment.
- Main building: compact workshop storefront with awning, utility poles, cables, HVAC, PCB details, partially open workshop window, one backlit brand sign. Shenzhen maker identity (not a ramen shop clone).
- Color ratios: charcoal / black 58%, smoky purple-gray 20%, coral pink 10%, cyan 7%, warm amber 5%.
- Foreground: glossy wet pavement, a restrained puddle, one two-bulb street lamp, small physical signpost (Projects / Blog / Challenge / Guides).
- Display window: PAN retro telephone + robotic hand; FlipFate flipping card + receipt.
- Counter: BMO animated screen companion and tools; side display: Roomba VLM + camera.
- Entrance: NEKO mini cyber maneki-neko, waving with a gentle 3-second looping animation. Visible in opening shot but not larger than the shop.

## Real-project asset contract

| Resident | Must read instantly as | Idle animation | Link |
| --- | --- | --- | --- |
| luckycat | Round ceramic white cat, pink circuit details, gold coin, separate waving paw | gentle wave, 2.5–3.5s loop | /docs/about |
| pan | Retro phone, drink dispensers, small mechanical hand | hand gesture, LED pulse | /docs/hackathons/2026/aix-origin-apex-hand |
| flipfate | Physical flip-card tarot box and receipt slot | card flip | /docs/projects |
| bmo | Small expressive screen-faced companion | blink/idle tilt | /docs/projects |
| roomba | Camera-equipped roaming robot vacuum | camera gimbal movement | /docs/hackathons/2026/roomba-vllm |
| courtside | Basketball analysis console, court graphics | discreet data movement | /docs/hackathons/2026/courtside-iq |

**Tripo constraint:** GLB output is an initial asset. It will likely need Blender cleanup, topology/UV/material revision and explicit rig/animation authoring. Do not claim the current procedural proxies are Tripo assets.

## Jesse case study -> implementation choices

- Baked soft lighting: cycles lightmaps / texture atlas and correct UVs, with limited runtime lighting.
- Selective bloom: only emissive signage/tubes/screens; disable on low-power/mobile.
- Reflections: baked pavement highlights first, optionally low-resolution Reflector on capable desktops. Avoid double-render reflection cost on phones.
- Camera transitions: tween camera and orbit target simultaneously, disable orbit while transitioning, limit zoom and angles.
- World interaction: Raycaster against invisible hitboxes, semantic project/info panel; do not navigate away directly on hover/click.
- Responsive performance: phone quality tier (compressed GLB, KTX2/Basis, mesh simplification, soft visual fallback, prefers-reduced-motion support), test 45 FPS targets rather than assuming.
- Intro loading: lightweight visual preloader and an always available ordinary HTML blog navigation path.

## Hard approval gates

1. **Art direction** — one approved 2K diorama render and phone crop; plus NEKO character turntable. No production changes before this gate.
2. **Asset quality** — mesh, UV, materials, baking, compressed GLB and motion tested with a model viewer. Target roughly 8–15 MB desktop scene and 4–8 MB mobile.
3. **Interaction integration** — map existing model-slots.json into real assets, physical hotspot links and 1–1.5s camera focus transitions.
4. **Device QA** — desktop Chromium, iPhone Safari, Android Chrome, light/dark readability, Chinese/English routes, WebGL/CDN failure fallback.

Existing live model remains a low-fidelity prototype. Our definition of DONE is **art-quality approved screenshot + responsive interactive 3D + working links + measured performance**, not passing npm build alone.
