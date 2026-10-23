# Garage ambient motion

The source GLBs are unchanged. `tools/prepare_vending_motion.py` measures the original vending mesh and produces `static/maker-garage-preview/vending-motion.json`, with an exclusive triangle partition for 11 products. Runtime objects preserve their original UVs, seal cut boundaries, and rotate above inset shelf decks. Spin envelopes are limited by both cavity depth and neighbouring products; the cyan rings remain fixed to the decks.

`ambient-motion.js` supplies independent rotation/bobbing, three authored neon circuits and the street-lamp circuit. Voltage events have two brief dips, followed by a stable interval of 14–33 seconds. Neon socket sparks last 0.65 seconds. Lamp illumination and the mounted diffuser use the same voltage envelope. The existing authored `Techland_Beckon` clip starts automatically at 0.72 speed.

The environment and cat controls can be paused independently. Reduced-motion preferences disable these effects; hidden tabs stop rendering. No additional model generation, remote textures or physics dependencies are required.

Validation: `node tools/check_ambient_motion.mjs` checks triangle ownership, 72 seconds of full rotation, disjoint neighbour envelopes, shelf/cavity clearances, pause stability and voltage restoration. Type checking and English/Chinese production builds pass. Browser checks cover default-on controls, pause/resume, scene appearance and no runtime console errors. This change is available in the local preview; no GitHub Pages publication was performed.
