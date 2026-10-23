# Garage loading optimization

Runtime downloads use pre-sized GLBs from `models/optimized/desktop` (1024px) or `models/optimized/mobile` (512px), selected through `optimized-assets.json`. The former runtime already reduced textures to these sizes after downloading the original 2048px images. The original source models are preserved.

Model transfer totals: original 64,328,804 bytes; desktop 25,221,484 bytes (-60.79%); mobile 12,628,536 bytes (-80.37%). Seven priority exterior models require 10,779,356 bytes desktop or 5,966,132 bytes mobile. All geometry, UV, skin and animation buffers are byte-identical. Opaque color maps use JPEG q88 4:4:4; normal/material maps remain PNG with at most 2/255 channel rounding error. No extra glTF decoder is required.

The street, shell, shutter, portrait, cat, vending machine and lamp load first. Once grounded and drawn, they become interactive while exterior details and workshop equipment continue loading. Sponsor API requests and the profile image are independent of model startup. Three model decode slots limit transient memory, and phase completion no longer repeatedly resets the visitor's camera.

Background download progression is independent of requestAnimationFrame: hidden tabs continue loading subsequent phases, and the parent reveals the exterior only after a real render. The parent loading watchdog resets when model counts make progress, so a slow but advancing connection does not trigger an incorrect failure after 45 seconds.

Controlled browser benchmark, cold resources, locally shaped shared download bandwidth of 10 Mbps, same desktop/browser: previous release completed decoration at 53,028 ms; optimized desktop exterior became ready at 9,860 ms and all models completed at 23,040 ms. At a 390px viewport the optimized mobile exterior became ready at 5,915 ms and completed at 12,372 ms. Times start at scene-module evaluation; they exclude the blog document and initial JavaScript module download. The baseline and new scene both loaded the same 21 delivered models. These are controlled measurements, not a guarantee for every visitor's network/device.

Checks: all 42 generated GLBs validated against originals; phase membership/concurrency/path fallback tests; English and Simplified Chinese builds; TypeScript check; desktop and mobile visual checks. Existing rejected PC asset remains excluded.

Reproduce: `python tools/optimize_preview_downloads.py --verify-only`, `node tools/check_garage_loading.mjs`. The generator requires Pillow; original assets remain the fallback if the optimized manifest is unavailable.
