from pathlib import Path
import json,urllib.request,shutil
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent;repo=R.parent;O=R/'ad-v4-renders';O.mkdir(exist_ok=True);D=repo/'deliverables/techland-ad-v4';D.mkdir(exist_ok=True)
music=json.loads((R/'runway-v4-results.json').read_text(encoding='utf-8'))
for i,m in enumerate(music):
 target=O/f'Runway-new-act-{i+1}.mp3'
 if not target.exists():
  with urllib.request.urlopen(m['url'],timeout=90) as res,target.open('wb') as f:shutil.copyfileobj(res,f)
 print('Downloaded NEW Runway music',i+1,target.stat().st_size,flush=True)
(D/'music-provenance.json').write_text(json.dumps({'provider':'Runway','newlyGeneratedForThisRevision':True,'acts':[{k:x[k] for k in ['taskId','prompt','meta']} for x in music],'oldMusicUsed':False,'noLooping':True,'filmDurationSeconds':220.5},ensure_ascii=False,indent=2),encoding='utf-8')
for lang in ['zh','en']:
 im=Image.new('RGBA',(1920,1080));d=ImageDraw.Draw(im);font='C:/Windows/Fonts/msyhbd.ttc';mono='C:/Windows/Fonts/consolab.ttf'
 def text(pos,s,size,color='#fcfaf3',center=False):d.text(pos,s,font=ImageFont.truetype(mono if 'github' in s else font,size),fill=color,anchor='mm' if center else None)
 d.rectangle((140,808,1780,978),fill='#100b1cf2');d.rectangle((150,765,920,826),fill='#f42b73');d.rectangle((138,753,908,814),fill='#ffe64b')
 text((160,766),'亲自来逛 / 项目入口' if lang=='zh' else 'COME EXPLORE / PROJECT LINK',28,'#100b1c')
 text((960,870),'peterpanstechland.github.io',70,'#7bf4eb',True)
 text((960,944),'打开博客首页 → 点击「走进车库」' if lang=='zh' else 'OPEN THE HOMEPAGE → ENTER THE GARAGE',29,center=True)
 im.save(O/f'entry-{lang}.png')
 im=Image.new('RGBA',(1920,1080));d=ImageDraw.Draw(im);d.rectangle((100,594,1820,766),fill='#03030af5')
 text((960,650),'peterpanstechland.github.io',76,'#7bf4eb',True);text((960,728),'首页 · 走进车库 · 自由探索' if lang=='zh' else 'HOMEPAGE · ENTER THE GARAGE · EXPLORE',29,center=True)
 im.save(O/f'entry-end-{lang}.png')
s=(R/'finish_v3.py').read_text(encoding='utf-8').replace('ad-v3-renders','ad-v4-renders').replace('techland-ad-v3','techland-ad-v4').replace('narration-story-v3','narration-v4')
(R/'finish_v4.py').write_text(s,encoding='utf-8')
s=(R/'align_v3.py').read_text(encoding='utf-8').replace('narration-story-v3','narration-v4');(R/'align_v4.py').write_text(s,encoding='utf-8')
print('V4 workspace ready',flush=True)
