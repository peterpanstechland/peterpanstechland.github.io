import sys,subprocess,json
from pathlib import Path
R=Path(__file__).resolve().parent;repo=R.parent;O=R/'ad-v3-renders';ff=str(next((repo/'assets/tripo/promo-video/deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe')))
lang=sys.argv[1];p=O/f'chapter-{lang}-11.mp4';backup=O/f'phone-sequence-{lang}.mp4'
if not backup.exists():p.replace(backup)
author='C:/Users/peter/Documents/xwechat_files/DjSTon3_3b8b/msg/video/2026-10/af6cd669c46a8a8be7a7a55a0233a514.mp4'
flt='[0:v]trim=start=0.3:end=9.3,setpts=PTS-STARTPTS,scale=1920:1080,eq=brightness=0.025:contrast=1.08:saturation=1.04,fps=30,setsar=1[a];[1:v]trim=8:16,setpts=2*(PTS-STARTPTS),fps=30,setsar=1[b];[2:v]trim=0:8.5,setpts=PTS-STARTPTS,fps=30,setsar=1[c];[a][b][c]concat=n=3:v=1:a=0,tpad=stop_mode=clone:stop_duration=1[v]'
with (O/f'personal-story-{lang}.log').open('w') as log:
 subprocess.run([ff,'-y','-v','warning','-i',author,'-i',str(backup),'-i',str(repo/'assets/tripo/promo-video/orbit.webm'),'-filter_complex',flt,'-map','[v]','-an','-c:v','libx264','-threads','6','-preset','fast','-crf','19','-pix_fmt','yuv420p','-t','33.5',str(p)],check=True,stderr=log)
with (O/f'concat-{lang}.log').open('w') as log:
 subprocess.run([ff,'-y','-v','warning','-f','concat','-safe','0','-i',str(O/f'concat-{lang}.txt'),'-c','copy','-movflags','+faststart',str(O/f'visual-{lang}.mp4')],check=True,stderr=log)
print('Personal story montage ready',lang,flush=True)
