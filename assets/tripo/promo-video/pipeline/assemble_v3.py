from pathlib import Path
import json,math,subprocess,sys,io
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent;repo=R.parent;O=R/'ad-v3-renders';D=repo/'deliverables/techland-ad-v3';D.mkdir(exist_ok=True)
ff=str(next((repo/'assets/tripo/promo-video/deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe')))
def run(args,name):
 with (O/name).open('w') as f:p=subprocess.run([ff,'-y','-v','warning',*args],stdout=f,stderr=f)
 if p.returncode:raise RuntimeError((O/name).read_text(encoding='utf-8',errors='replace')[-4000:])
def prepare():
 p=R/'narration-story-v3/manifest.json';m=json.loads(p.read_text(encoding='utf-8'));base=json.loads((repo/'assets/tripo/promo-video/ad-chapters.json').read_text(encoding='utf-8'));timeline=[];t=0
 for c in base:
  i=c['index'];dur=max(c['end']-c['start'],max(j['duration'] for j in m['segments'] if j['index']==i)+.9)
  if i==14:dur=max(12,dur)
  dur=math.ceil(dur*2)/2
  timeline.append({'index':i,'start':t,'duration':dur,'sourceStart':c['start'],'sourceEnd':c['end']});t+=dur
  for j in m['segments']:
   if j['index']==i:j.update(start=t-dur+.35,end=t-.25,tempoNeeded=1)
 m['timeline']=timeline;m['totalSeconds']=t+19;p.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
 s=(R/'finish_v3.py').read_text(encoding='utf-8').replace('LENGTH=177',f'LENGTH={t+19}').replace('music-177','music-complete').replace('0:177',f'0:{t+19}').replace('93:120',f'60:{t+19-90}').replace('st=173.5',f'st={t+15.5}').replace("'-t','177'",f"'-t','{t+19}'")
 # For bilingual subtitles retain the written brand name; speech says 普劳德.
 s=s.replace("count=len(chars(text));begin=", "count=len(chars(text));begin=")
 (R/'finish_v3.py').write_text(s,encoding='utf-8');print('Timeline',t+19,timeline,flush=True)
def visual(lang):
 m=json.loads((R/'narration-story-v3/manifest.json').read_text(encoding='utf-8'));clips=[]
 for c in m['timeline']:
  i=c['index'];out=O/f'chapter-{lang}-{i:02d}.mp4';clips.append(out)
  if out.exists():continue
  if i==0:
   original=R/f'ad-renders/visual-{lang}.mp4';orbit=repo/'assets/tripo/promo-video/orbit.webm';rest=c['duration']-5.4
   flt=f'[0:v]split[a][b];[a]trim=0:1.4,setpts=PTS-STARTPTS,fps=30[a0];[1:v]trim=0:4,setpts=PTS-STARTPTS,fps=30[o];[b]trim=2:8,setpts={rest/6}*(PTS-STARTPTS),fps=30[b0];[a0][o][b0]concat=n=3:v=1:a=0,setsar=1[v]'
   run(['-i',str(original),'-i',str(orbit),'-filter_complex',flt,'-map','[v]','-an','-c:v','libx264','-threads','6','-preset','fast','-crf','18','-pix_fmt','yuv420p','-t',str(c['duration']),str(out)],f'chapter-{lang}-0.log')
  elif i==11:
   # Real phone capture beside authored workflow graphics; never presented as a recorded PRD export.
   bg=Image.new('RGB',(1920,1080),'#100b1c');d=ImageDraw.Draw(bg);font='C:/Windows/Fonts/msyhbd.ttc'
   def text(x,y,s,size=36,color='#fcfaf3'):d.text((x,y),s,font=ImageFont.truetype(font,size),fill=color)
   d.rectangle((90,120,1100,199),fill='#f42b73');d.rectangle((78,108,1088,187),fill='#ffe64b');text(100,125,'PLAUD / AI NATIVE STUDIO',32,'#100b1c')
   lines=['先接住脑洞，','再把它做出来。'] if lang=='zh' else ['CATCH THE IDEA.','THEN MAKE IT REAL.']
   for n,s in enumerate(lines):text(80,270+n*85,s,55,'#7bf4eb' if n else '#fcfaf3')
   rows=['黑客松现场，把讨论留下','让 AI 把灵感收拢成需求','WorkBuddy / Cursor / Codex','从开发 Spec，到真正的作品'] if lang=='zh' else ['Keep the hackathon conversation','Give scattered ideas a clear brief','WorkBuddy / Cursor / Codex','From a development spec to a real build']
   for n,s in enumerate(rows):
    d.rectangle((85,500+n*95,1190,578+n*95),fill='#1c2933');text(106,518+n*95,f'0{n+1}  {s}',31)
   text(88,930,'后续详细测评 / 一键交接工作流待实测' if lang=='zh' else 'DETAILED REVIEW NEXT / ONE-CLICK HANDOFF TO TEST',25,'#ffe64b')
   text(1275,1007,'真实录屏：行程摘要示例' if lang=='zh' else 'REAL APP / ITINERARY SUMMARY',21,'#7bf4eb')
   img=O/f'workflow-{lang}.png';bg.save(img)
   phone='C:/Users/peter/Documents/xwechat_files/DjSTon3_3b8b/msg/video/2026-10/5d49f35149c9340f40176625348e07b2.mp4'
   run(['-loop','1','-i',str(img),'-stream_loop','-1','-i',phone,'-filter_complex','[1:v]scale=414:920,setsar=1[p];[0:v][p]overlay=1370:65:shortest=1,fps=30[v]','-map','[v]','-an','-t',str(c['duration']),'-c:v','libx264','-threads','6','-preset','fast','-crf','19','-pix_fmt','yuv420p',str(out)],f'chapter-{lang}-{i}.log')
  else:
   src=repo/'assets/tripo/promo-video/orbit.webm' if i==14 else R/f'ad-renders/visual-{lang}.mp4'
   start=0 if i==14 else c['sourceStart'];length=12 if i==14 else c['sourceEnd']-c['sourceStart'];factor=c['duration']/length
   run(['-ss',str(start),'-t',str(length),'-i',str(src),'-vf',f'setpts={factor}*(PTS-STARTPTS),fps=30,setsar=1','-an','-c:v','libx264','-threads','6','-preset','fast','-crf','18','-t',str(c['duration']),'-pix_fmt','yuv420p',str(out)],f'chapter-{lang}-{i}.log')
 clips.append(O/f'outro-{lang}.mp4');lst=O/f'concat-{lang}.txt';lst.write_text(''.join("file '"+p.as_posix()+"'\n" for p in clips),encoding='utf-8')
 run(['-f','concat','-safe','0','-i',str(lst),'-c','copy','-movflags','+faststart',str(O/f'visual-{lang}.mp4')],f'concat-{lang}.log');print('Visual ready',lang,flush=True)
if __name__=='__main__':
 if sys.argv[1]=='prepare':prepare()
 else:visual(sys.argv[1])
