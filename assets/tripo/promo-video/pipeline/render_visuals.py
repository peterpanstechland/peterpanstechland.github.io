from pathlib import Path
import subprocess,sys,json
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent;repo=R.parent;O=R/'ad-renders';O.mkdir(exist_ok=True)
ff=str(next((repo/'assets/tripo/promo-video/deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe')))
zh=sys.argv[1]=='zh';lang='zh' if zh else 'en';font='C:/Windows/Fonts/msyhbd.ttc'
def run(args,log):
 with (O/log).open('w') as f:
  p=subprocess.run([ff,'-y','-hide_banner','-v','warning',*args],stdout=f,stderr=f)
 if p.returncode:raise RuntimeError((O/log).read_text(encoding='utf-8',errors='replace')[-6000:])
# Overlay sits on user-supplied footage; no counterfeit manufacturer UI.
overlay=Image.new('RGBA',(1920,1080));d=ImageDraw.Draw(overlay)
d.rectangle((42,40,1878,1040),outline='#ffffff55',width=1)
d.rectangle((42,40,142,44),fill='#f42b73');d.rectangle((1778,1036,1878,1040),fill='#7bf4eb')
d.text((72,62),'TECHLAND  /  REAL WORKSHOP',font=ImageFont.truetype(font,20),fill='#fcfaf3')
d.rectangle((104,168,690,244),fill='#f42b73');d.rectangle((92,156,678,232),fill='#ffe64b')
d.text((112,176),'PLAUD / 真实使用画面' if zh else 'PLAUD / REAL WORKSHOP FOOTAGE',font=ImageFont.truetype(font,25),fill='#100b1c')
for y in range(825,1080):d.line((0,y,1920,y),fill=(16,11,28,int(225*(y-825)/255)))
d.text((76,916),'NotePin S · 日常记录 / 佩戴演示' if zh else 'NotePin S / EVERYDAY CAPTURE',font=ImageFont.truetype(font,35),fill='#fcfaf3')
d.text((78,980),'合作提案样片 / 深度测评计划' if zh else 'PARTNERSHIP REVIEW DRAFT / HANDS-ON REVIEW PLANNED',font=ImageFont.truetype(font,24),fill='#7bf4eb')
png=O/f'footage-overlay-{lang}.png';overlay.save(png)
sources=json.loads((R/'plaud-footage/manifest.json').read_text(encoding='utf-8'))
takes=[(1,1.2,3),(2,3.4,2.5),(5,.2,2),(3,.3,2.5)]
clips=[]
for i,(number,start,duration) in enumerate(takes):
 target=O/f'footage-{lang}-{i}.mp4';clips.append(target)
 if not target.exists():
  src=next(s['source'] for s in sources if s['index']==number)
  run(['-ss',str(start),'-i',src,'-loop','1','-i',str(png),'-filter_complex','[0:v]fps=30,scale=1920:1080:flags=lanczos,eq=brightness=0.025:contrast=1.08:saturation=1.04,setsar=1[v];[v][1:v]overlay=0:0:shortest=1[out]','-map','[out]','-an','-t',str(duration),'-c:v','libx264','-threads','6','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(target)],f'footage-{lang}-{i}.log')
concat=O/f'footage-{lang}.txt';concat.write_text(''.join("file '"+p.as_posix()+"'\n" for p in clips),encoding='utf-8')
montage=O/f'footage-{lang}.mp4'
run(['-f','concat','-safe','0','-i',str(concat),'-c','copy',str(montage)],f'montage-{lang}.log')
raw=repo/f'assets/tripo/promo-video/ad-recording-{lang}.webm'
visual=O/f'visual-{lang}.mp4'
flt='[0:v]fps=30,setsar=1,split=2[a][b];[a]trim=start=0:end=105,setpts=PTS-STARTPTS[a0];[1:v]setpts=PTS-STARTPTS,setsar=1[mid];[b]trim=start=115:end=146,setpts=PTS-STARTPTS[b0];[2:v]setpts=PTS-STARTPTS,setsar=1[end];[a0][mid][b0][end]concat=n=4:v=1:a=0,fps=30,format=yuv420p[v]'
run(['-i',str(raw),'-i',str(montage),'-i',str(O/f'outro-{lang}.mp4'),'-filter_complex',flt,'-map','[v]','-an','-c:v','libx264','-threads','6','-preset','fast','-crf','18','-t','190','-movflags','+faststart',str(visual)],f'visual-{lang}.log')
print(visual,flush=True)
