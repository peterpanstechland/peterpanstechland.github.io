from pathlib import Path
import sys,subprocess,math
import numpy as np
import cv2
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'ad-renders';OUT.mkdir(exist_ok=True)
FF=str(next((ROOT.parent/'assets/tripo/promo-video/deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe')))
W,H,FPS=1920,1080,30;SCROLL=38;DURATION=44
language=sys.argv[1];engine=sys.argv[2] if len(sys.argv)>2 else 'LOCAL A/B / 待试听确认'
zh=language=='zh';font='C:/Windows/Fonts/msyhbd.ttc';regular='C:/Windows/Fonts/msyh.ttc'
rows=[('TECHLAND',82),('幕后 / MAKING THE WORLD' if zh else 'THE TOOLS BEHIND THE WORLD',55),('',40),
      ('工具出镜 · 非赞助' if zh else 'TOOLS FEATURED · NOT SPONSORED',48),('Tripo AI',76),('Bambu Lab X1C',76),('Makeblock Laserbox',76),('',35),
      ('背景音乐' if zh else 'BACKGROUND MUSIC',48),('Runway',78),('',35),
      ('声音克隆工具' if zh else 'VOICE CLONING ENGINE',48),(engine,58),('',35),
      ('拟硬件赞助 · 合作待确认' if zh else 'PROPOSED HARDWARE SPONSOR',48),('PLAUD NotePin S',76),('品牌确认用样片' if zh else 'PARTNERSHIP REVIEW DRAFT',40),('',35),
      ('TOKEN / Codex',70),('',35),('特别感谢' if zh else 'SPECIAL THANKS',48),('Tibo',88),
      ('感谢慷慨提供 reset' if zh else 'For the generous reset',55),('',35),
      ('下一件，我们一起造。' if zh else "LET'S BUILD THE NEXT THING.",62)]
texture=Image.new('RGB',(1400,3200),(0,0,0));draw=ImageDraw.Draw(texture);y=100
for text,size in rows:
 if not text:y+=size;continue
 f=ImageFont.truetype(font,size)
 while draw.textlength(text,font=f)>1300:size-=1;f=ImageFont.truetype(font,size)
 draw.text((700,y),text,font=f,fill='#ffe268',anchor='mt');y+=size+52
texture=np.asarray(texture.crop((0,0,1400,y+180)))
# True perspective mapping of a text plane tilted backwards by 60 degrees.
# Inverse projection gives one plane Y/depth per output row; source Y scrolls.
screen_y=np.arange(H,dtype=np.float32);focal=H*1.1;center_y=H
q=(center_y-screen_y)/focal;den=.5735764-.819152*q
plane_y=np.where(den>.012,5*q/np.maximum(den,.012),999)
units=5.2/1400;depth=5+.819152*plane_y
map_x=np.ascontiguousarray(((np.arange(W,dtype=np.float32)-W/2)[None,:]*depth[:,None]/(focal*units)+700).astype(np.float32))
map_y=np.empty((H,W),np.float32)
fade=np.clip((screen_y-H*.23)/(H*.19),0,1)[:,None,None].astype(np.float32)
rng=np.random.default_rng(7331);stars=Image.new('RGB',(W,H),'#03030a');sd=ImageDraw.Draw(stars)
for i in range(330):
 x,y0=int(rng.integers(0,W)),int(rng.integers(0,H));r=int(rng.choice([1,1,1,2]));b=int(rng.integers(45,190));sd.ellipse((x,y0,x+r,y0+r),fill=(b,b,min(255,b+20)))
stars=np.asarray(stars).copy();target=OUT/f'outro-{language}.mp4'
log=(OUT/f'outro-{language}.log').open('w')
proc=subprocess.Popen([FF,'-y','-v','warning','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-threads','6','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],stdin=subprocess.PIPE,stderr=log)
for frame in range(DURATION*FPS):
 t=frame/FPS;bg=stars.copy()
 if t<SCROLL:
  offset=1.1+(t/SCROLL)*(texture.shape[0]*units+8.2)
  map_y[:]=(offset-plane_y[:,None])/units
  credits=cv2.remap(texture,map_x,map_y,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
  credits=(credits.astype(np.float32)*fade).astype(np.uint8)
  glow=cv2.GaussianBlur(credits,(0,0),2)
  bg=cv2.add(bg,cv2.addWeighted(credits,1,glow,.21,0))
  if t<1:bg=(bg.astype(np.float32)*t).astype(np.uint8)
 else:
  a=min(1,(t-SCROLL)/.8,max(0,(DURATION-t)/.65));im=Image.fromarray(bg);d=ImageDraw.Draw(im)
  d.line((W*.24,410,W*.76,410),fill='#f42b73',width=3)
  d.text((W/2,490),'彼得潘的科技谷',font=ImageFont.truetype(font,86),fill='#fcfaf3',anchor='mm')
  d.text((W/2,595),"PETER PAN'S TECHLAND",font=ImageFont.truetype(font,61),fill='#ffe268',anchor='mm')
  d.text((W/2,700),'peterpanstechland.github.io',font=ImageFont.truetype(regular,33),fill='#7bf4eb',anchor='mm')
  d.text((W/2,775),'参观 · 留念 · 合作' if zh else 'EXPLORE · LEAVE A TRACE · BUILD TOGETHER',font=ImageFont.truetype(regular,28),fill='#b8afc9',anchor='mm')
  bg=(np.asarray(im).astype(np.float32)*a).astype(np.uint8)
 if frame in [15*FPS,28*FPS,40*FPS]:Image.fromarray(bg).save(OUT/f'outro-{language}-{int(t)}.jpg',quality=94)
 proc.stdin.write(bg.tobytes())
proc.stdin.close();code=proc.wait();log.close()
if code:raise RuntimeError('Outros encode failed')
print(target,flush=True)
