---
id: maker-garage-3d
title: Cyber Maker Garage · 3D Scene Blueprint
sidebar_position: 4
description: Layout, character placement, model slots, interactions and the production pipeline for the Peter Pan's Techland 3D homepage.
keywords: [3D, Tripo, Three.js, GLB, maker garage, homepage, scene design]
---

# Cyber Maker Garage — Scene Blueprint v1

**One workshop, one story, six hero assets.** Rather than scattering shiny objects all over a webpage, the homepage becomes one miniature workshop in Shenzhen: the house is the world, NEKO is the host, and each project is a small interactive resident.

![Top-down spatial plan for the Cyber Maker Garage](/maker-house/scene-layout.svg)

## 01 / Art direction

**Maker garage × miniature diorama × cyberpunk graffiti.** Charcoal-black architecture, dusky purple structures, magenta neon, small cyan display accents and warm workbench lighting. Rounded collectible characters keep the workshop friendly. The silhouette must remain readable at mobile size. Motion is subtle: breathing lights, small nods, a waving paw, a moving camera eye.

**Visual hierarchy:** (1) garage and entrance, (2) NEKO near the front door, (3) PAN and FlipFate as signature projects, (4) BMO and Roomba as supporting personalities, (5) optional Courtside IQ on the back bench. No giant floating labels or dozens of separately spinning objects.

## 02 / Scene layout

Coordinates below follow the existing Three.js scene. **X = left/right; Y = up; +Z = toward visitors/front.**

| Asset | Approximate root (X, Y, Z) | Where it belongs | Key interaction |
| --- | --- | --- | --- |
| **Maker Garage** | (0, 0, 0) | Center-stage building; about 17 × 11.6 units | Enter / reveal the interior |
| **NEKO** | (5.55, 0.85, 6.43) | Front-right welcome podium | Paw wave, welcome/about |
| **PΛN** | (−5.8, 0.78, −2.25) | Left rear workbench | Open cocktail robot project |
| **FlipFate** | (−2.5, 0.77, −2.2) | Center-left rear workbench | Flip the card, open project overview |
| **BMO** | (4.5, 0.80, −2.2) | Right rear workbench | Screen expression, project overview |
| **Roomba** | (3.55, 0.15, 2.35) | Front interior walking area | Camera tracking animation, project story |
| **Courtside IQ** | (1.0, 0.8, −2.2) | Small optional background display | NBA analysis build log |

The rear wall has just four category signs: **Projects, Blog, Challenge, Guides**. The **Challenge** hotspot leads to the existing [Makers Challenge](/challenge) initiative, including the exhibitor material-sourcing concept and sponsor campaign.

## 03 / Camera and movement

- **Arrival:** three-quarter view from the front, with the text block at the left and garage seen center/right. Show the shop sign and NEKO; avoid putting a model under the copy.
- **Enter:** camera glides closer; the procedural roof fades away, exposing the workbench residents. Imported roofs do the same when their nodes are named `ROOF_...` or `CEILING_...`.
- **Explore:** drag to orbit, mouse wheel to zoom on desktop, one-finger orbit on mobile. Clicking a character focuses the camera and opens a short HTML project card with a proper link.
- **Scroll:** narrative cards below the 3D hero are plain HTML, not WebGL-only. Visitors can still navigate if 3D is unavailable.
- **Accessibility:** reduced-motion visitors get a static scene with no decorative animations. Hover tooltips are supplemental; keyboard users can use the navigation and project links.

## 04 / Scene integration and asset slots

The live site uses **Docusaurus + a Three.js scene inside a local iframe**:

| Path | Purpose |
| --- | --- |
| `src/pages/index.tsx` | Entrance overlay, bilingual copy, project cards and category navigation |
| `static/maker-house/scene.html` | WebGL stage, camera, hotspots, procedural fallbacks and GLTF loader |
| `static/maker-house/model-slots.json` | Configure imported `.glb` paths and their per-model transforms |
| `static/maker-house/scene-layout.svg` | Editable top-down planning diagram |
| `static/maker-house/TRIPO_MODELS.md` | Tripo prompts and integration details |

All asset slots default to an **empty file path**. The homepage therefore works even without Tripo exports. To replace one resident, export a GLB into `static/maker-house/models/`, then set the corresponding path in `model-slots.json`. You can replace only one character at a time.

**Garage GLB export contract:** floor-centered origin, front facing **+Z**, approximate world footprint 17 × 11.6, roof near Y=8, and no baked-in copies of PAN / NEKO / other residents. Name separately modeled roof or ceiling meshes with `ROOF` or `CEILING` so that the Enter transition can fade them. Otherwise deliver the garage as an already-open cutaway model.

### Tripo export checklist

1. **Garage first:** export `maker-garage.glb` without a background, sky dome or pre-attached robots.
2. **NEKO second:** export `neko-luckycat.glb` with a paw-waving clip.
3. **PΛN and FlipFate third:** clean silhouettes and only a few moving parts; prioritize fidelity to real projects over complexity.
4. **BMO and Roomba last:** original-looking companion and roaming camera rover.
5. Before integrating: correct pivot and orientation in Blender, reduce tiny floating meshes, compress textures, limit materials and verify the animation mixer.
6. **Target ~1–2 MB per character** where possible; the environment budget can be larger if tested. Check FPS on mobile and avoid heavy transparent layers.

## 05 / Interaction map

| Trigger | Visual response | Destination |
| --- | --- | --- |
| Enter the Garage | Move camera in; reveal roof cutaway | Stay on homepage |
| NEKO | Wave and show project information | About / introduction |
| PΛN | Mechanical hand gesture and focus | [PΛN development story](/docs/hackathons/2026/aix-origin-apex-hand) |
| FlipFate | Card turns and focus | [Projects](/docs/projects) |
| BMO | Subtle idle / screen expression | [Projects](/docs/projects) |
| Roomba | Camera follows; moving rover | [Roomba-VLLM story](/docs/hackathons/2026/roomba-vllm) |
| Rear CHALLENGE sign | Highlight the challenge | [Makers Challenge](/challenge) |
| Blog / Projects / Guides signs | Preview category | Relevant site section |

## 06 / What is and isn't built

**Deployed v1:** six source-controlled, reproducibly generated GLB assets (the generator is in `tools/generate_3d_models.py`), imported characters and architectural shell, animated named nodes, interactive camera, category signs, bilingual copy, links, fallback geometry and a roof cutaway. Binary assets are generated during the GitHub Pages build and served at `/maker-house/models/*.glb`. They are original procedural models, not Tripo-generated assets.

**Future upgrade:** higher-fidelity Tripo/Blender meshes, optional authored animation clips, device-level mobile profiling and final art-direction QA. The programmatic v1 is a complete functional asset pass, not a claim of AI-generated 3D art.

This document describes the [Peter Pan's Techland homepage](/) project. The separate **[Makers Challenge](/challenge)** proposal is linked from the scene but is not an official Maker Faire program.
