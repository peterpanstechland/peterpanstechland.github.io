# Cyber Maker Garage — Tripo model pipeline

The homepage includes **animated procedural placeholder characters** and real links to Peter Pan’s published projects. It does **not** yet contain Tripo-generated assets; those can be substituted without changing the interactive routing.

## Replace a resident with a Tripo GLB

1. Generate a consistent 2.5D/low-poly character in Tripo, export a **GLB** with embedded materials/textures.
2. Put it in this repository under \`static/maker-house/models/\`, e.g. \`lucky-cat.glb\`.
3. Edit \`static/maker-house/model-slots.json\` and change \`models.luckycat.file\` from \`""\` to \`"/maker-house/models/lucky-cat.glb"\`.
4. Adjust the scale, position and rotation using the optional JSON fields. All six residents are independently replaceable.
5. If the GLB includes animation clips, the scene automatically plays them through Three.js AnimationMixer. Motion stops for visitors who prefer reduced motion.
6. If no file is configured, its existing procedural 3D resident remains visible and animated. If the load fails, the procedural fallback remains visible.

## Style guide

Use **one shared art direction** for all models: adorable hand-built cyberpunk toys; readable silhouettes; 2.5D low-poly construction; dark charcoal and desaturated purple shell; vivid coral-pink, cyan and warm amber accents; restrained bloom baked into texture, not huge transparent glowing surfaces; no large permanent labels or floating text on models.

Consider GLB binary and texture budgets: aim for about **1–2 MB per model**, keep materials/meshes few, use compressed textures where practical, and animate at a modest frame rate. Check mobile GPU load before publishing.

## Prompts / briefs for Tripo

**招财猫 / NEKO:** "A cute miniature Japanese maneki-neko maker mascot, white ceramic-like body, one raised paw in a waving pose, tiny magenta circuit patterns, warm gold maker coin, playful round face, stylized 2.5D low-poly collectible toy, cyberpunk pink and cyan accents, full character, isolated, no stand, no words. Single continuous looping raised-paw waving animation."

**PΛN:** "A cute small bartending robot inspired by a retro telephone and an interactive drink machine, little mixing cups, mechanical dispenser, tiny expressive robotic hand, coral and purple cyberpunk workshop toy, friendly collectible scale, polished low-poly 2.5D 3D model, no text or background. Slow robotic hand wave animation."

**FlipFate:** "A miniature whimsical interactive tarot card vending machine with visible flip-card mechanism, a small thermal receipt slot, soft purple and warm pink glowing windows, friendly hand-made cyberpunk toy, stylized low-poly 3D miniature, no letters. Looping card flip animation."

**BMO:** "A small adorable retro screen-faced AI companion robot, rounded mint green housing, expressive minimal face, small arms and feet, original friendly maker gadget character, 2.5D stylized collectible low-poly model, no text. Gentle idle sway."

**Roomba-VLLM:** "A cute autonomous cameraman rover built from a robot vacuum base, a single expressive camera eye on top, maker robotics prototype, charcoal with coral and cyan accents, detailed but low-poly miniature collectible toy, no writing. Slow wheel turn / camera look animation."

**Courtside IQ:** "Miniature sci-fi AI basketball analyst desk with video analysis monitors, player tracking overlay, basketball radar-style hologram, playful low-poly cyberpunk maker gadget, no writing. Subtle screen illumination animation."

These are inspiration prompts; producing an actual Tripo export requires generating and exporting a model in Tripo. The website currently contains only procedural 3D stand-ins.

## Interaction design

- Click the four physical category signs to open Projects / Blog / Challenge / Guides.
- Click Neko, PAN, FlipFate, Roomba, BMO, Courtside IQ for a project info panel and a real destination.
- Desktop: orbit by dragging; wheel to zoom. Mobile: finger drag.
- Intro overlay has **Enter the Garage** and **Just Read the Blog**.
- Navigation links remain ordinary HTML, so visitors are not locked out if WebGL or the external Three.js CDN is unavailable.
