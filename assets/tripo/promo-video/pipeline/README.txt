Techland bilingual film production source snapshot (2026-10-24)

These are the actual v2-v4 narration, subtitle alignment, visual assembly,
Runway score assembly, outro and validation scripts used for the film.
They are archived source scripts, not a one-command installer.

To reuse their existing workspace-relative paths, copy these files into
the repository's ignored .local-media/ directory. Python scripts expect
their parent directory to be that local workspace and its parent to be
the repository. v4 builds on v3 visual renders and narration manifests.

Provide your own licensed source footage, authorized voice reference,
Qwen3-TTS model installation, narration manifests and alignment outputs.
Original private voice references, model weights, isolated Python runtimes,
credentials and machine caches are deliberately not distributed.
FFmpeg was supplied by imageio-ffmpeg; its dependency binaries are not vendored.
Some scripts use Windows fonts and CUDA device settings; adjust locally.

Main stages: setup_v3.py / setup_v4.py; render_visuals.py and render_outro_v3.py;
finish_v4.py; finalize_v4.py (music, audio, zh, en); check_v4.py.
The finished, validated 220.5-second ZH and EN MP4s are release assets.

Runway is used for background music only. Qwen3-TTS provides the authorized
local cloned narration. PLAUD cooperation is a proposal/review draft;
it is not an announcement of confirmed sponsorship.
