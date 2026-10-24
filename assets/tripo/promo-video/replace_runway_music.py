"""Download a generated Runway score and replace only the promo's audio track."""
from pathlib import Path
import json
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'deliverables' / 'techland-promo'
FF = str(next((Path(__file__).parent / 'deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe')))
SOURCE = OUT / 'Techland-Garage-Promo-1080p.mp4'
SCORE = OUT / 'Techland-Neon-Little-Workshop-Runway.mp3'
MIX = OUT / 'Techland-Garage-Promo-Runway-1080p.mp4'

def run(args):
    result = subprocess.run([FF, '-hide_banner', *args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-4000:])
    return result.stderr

manifest = json.loads((OUT / 'runway-generation.json').read_text(encoding='utf-8'))
with urllib.request.urlopen(manifest['url'], timeout=90) as response, SCORE.open('wb') as target:
    while block := response.read(1024 * 1024):
        target.write(block)

source_info = run(['-i', str(SOURCE), '-f', 'null', '-'])
match = re.search(r'Duration: (\d+):(\d+):([\d.]+)', source_info)
duration = int(match[1])*3600 + int(match[2])*60 + float(match[3])
score_info = run(['-i', str(SCORE), '-af', 'volumedetect', '-f', 'null', '-'])
match = re.search(r'Duration: (\d+):(\d+):([\d.]+)', score_info)
score_duration = int(match[1])*3600 + int(match[2])*60 + float(match[3])
if score_duration < duration * 0.9:
    raise RuntimeError(f'Generated score too short: {score_duration}s for {duration}s film')
tempo = min(1, score_duration / duration)

# A short entrance and a long tail keep the score comfortable at the closing URL.
filters = (f'atempo={tempo},apad,atrim=duration={duration},asetpts=PTS-STARTPTS,'
           f'loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:d=0.45,'
           f'afade=t=out:st={duration-3.4}:d=3.4')
run(['-y', '-i', str(SOURCE), '-i', str(SCORE), '-map', '0:v:0', '-map', '1:a:0',
     '-c:v', 'copy', '-af', filters, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
     '-t', str(duration), '-movflags', '+faststart', str(MIX)])
decode = run(['-v', 'error', '-i', str(MIX), '-f', 'null', '-'])
if decode.strip():
    raise RuntimeError(decode)
video_hashes = []
for file in (SOURCE, MIX):
    result = subprocess.run([FF, '-v', 'error', '-i', str(file), '-map', '0:v:0',
                             '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-'],
                            capture_output=True, text=True, check=True)
    video_hashes.append(result.stdout.strip())
if video_hashes[0] != video_hashes[1]:
    raise RuntimeError('Video payload changed')
report = {'file': MIX.name, 'music': SCORE.name, 'durationSeconds': duration,
          'sourceMusicDurationSeconds': score_duration, 'videoUnchanged': True,
          'fullDecodePassed': True, 'bytes': MIX.stat().st_size,
          'audioTreatment': 'AAC 192k, -16 LUFS target, entrance and closing fades',
          'pitchPreservingTempoRatio': tempo,
          'runwayTaskId': manifest['taskId']}
(OUT / 'runway-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
(OUT / 'README-Runway.txt').write_text(
    'Techland 宣传片 — Runway 配乐版\n\n'
    '视频：Techland-Garage-Promo-Runway-1080p.mp4\n'
    '独立配乐：Techland-Neon-Little-Workshop-Runway.mp3\n'
    '画面与字幕沿用原片，视频轨道无损复制；替换为 Runway 生成的纯音乐。\n'
    '风格：轻快赛博电子、可爱机械节奏、拨弦合成器与温暖氛围。\n'
    '成片配乐进行了响度处理与首尾淡入淡出；完整生成音乐也一并保留。\n'
    '原版视频保留。封面、独立字幕仍适用于此版本。\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
