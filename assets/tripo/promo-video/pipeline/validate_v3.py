from pathlib import Path
import json,subprocess,hashlib,io
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent;repo=R.parent;D=repo/'deliverables/techland-ad-v3';O=R/'ad-v3-renders';m=json.loads((R/'narration-story-v3/manifest.json').read_text(encoding='utf-8'));length=m['totalSeconds']
ff=str(next((repo/'assets/tripo/promo-video/deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe')))
reports=[];times=[2.8]+[c['start']+c['duration']*.5 for c in m['timeline']]+[length-16,length-3]
for lang in ['zh','en']:
 src=D/f'Techland-Cyber-Eternal-Studio-{lang.upper()}-1080p.mp4';p=subprocess.run([ff,'-hide_banner','-i',str(src),'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
 loud=json.loads(p.stderr[p.stderr.rfind('{'):p.stderr.rfind('}')+1]);assert -17<float(loud['input_i'])<-15 and float(loud['input_tp'])<-.8
 sheet=Image.new('RGB',(1440,6*295),'#100b1c');d=ImageDraw.Draw(sheet);font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',18)
 for i,t in enumerate(times):
  b=subprocess.run([ff,'-v','error','-ss',str(t),'-i',str(src),'-frames:v','1','-f','image2pipe','-vcodec','mjpeg','-'],capture_output=True,check=True).stdout;im=Image.open(io.BytesIO(b));im.save(O/f'final-{lang}-{i}.jpg',quality=94)
  if i==0:im.save(D/f'cover-{lang}.jpg',quality=95)
  im.thumbnail((480,270));x=i%3*480;y=i//3*295;sheet.paste(im,(x,y));d.text((x+10,y+272),f'{lang.upper()} / {t:05.1f}s',font=font,fill='#ffe64b')
 sheet.save(D/f'contact-{lang}.jpg',quality=94)
 report={'file':src.name,'bytes':src.stat().st_size,'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'durationSeconds':length,'width':1920,'height':1080,'fps':30,'fullDecodePassed':(O/f'decode-{lang}.log').read_text(encoding='utf-8')=='','integratedLUFS':float(loud['input_i']),'truePeakDBTP':float(loud['input_tp']),'outroSeconds':19,'wideOrbitSeconds':12,'narration':'Qwen3-TTS, speaker embedding only; no reference transcript continuation','music':'Runway, continuous edit through final frame','transitionSFX':'Removed','status':'PLAUD partnership review draft; personal workflow detailed review to follow'};reports.append(report);print(json.dumps(report),flush=True)
(D/'validation.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
