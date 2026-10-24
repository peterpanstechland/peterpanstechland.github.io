from pathlib import Path
import subprocess,json,io,hashlib
import av,soundfile as sf,numpy as np
from PIL import Image
R=Path(__file__).resolve().parent;repo=R.parent;O=R/'ad-v4-renders';D=repo/'deliverables/techland-ad-v4';ff=str(next((repo/'assets/tripo/promo-video/deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe')))
audio,sr=sf.read(O/'music-complete.wav',dtype='float32');assert abs(len(audio)/sr-220.5)<.1
blocks=[float(np.sqrt(np.mean(audio[int(t*sr):int((t+1)*sr)]**2))) for t in range(1,218)];assert min(blocks)>0.00001
reports=[]
for lang in ['zh','en']:
 p=D/f'Techland-Cyber-Eternal-Studio-{lang.upper()}-1080p.mp4';c=av.open(str(p));streams={s.type:float(s.duration*s.time_base) for s in c.streams};assert abs(streams['video']-220.5)<.04 and abs(streams['audio']-220.5)<.04;c.close()
 r=subprocess.run([ff,'-hide_banner','-i',str(p),'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True);loud=json.loads(r.stderr[r.stderr.rfind('{'):r.stderr.rfind('}')+1]);assert -17<float(loud['input_i'])<-15 and float(loud['input_tp'])<-.5
 for t in [194,217.5]:
  b=subprocess.run([ff,'-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-f','image2pipe','-vcodec','png','-'],capture_output=True,check=True).stdout
  Image.open(io.BytesIO(b)).save(D/f'entry-{lang}-{t}.png')
 report={'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'streamDurations':streams,'newRunwayTasks':['29a41b0c-381c-4c9f-89f7-88d0c965bd65','b8bbf398-16f5-4bcd-9812-ad602cb2bb1e'],'scoreDurationSeconds':len(audio)/sr,'scoreHasSignalThroughFilm':True,'minimumOneSecondScoreRMSBeforeFade':min(blocks),'website':'https://peterpanstechland.github.io/','websiteCaptionWindows':[[188,201.5],[215.5,220.5]],'brandPronunciationText':'Pu laude','fullDecodePassed':(O/f'decode-{lang}.log').read_text(encoding='utf-8')=='','LUFS':float(loud['input_i']),'truePeakDBTP':float(loud['input_tp'])};reports.append(report);print(json.dumps(report),flush=True)
(D/'validation.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
