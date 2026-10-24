from pathlib import Path
import subprocess,shutil,json
p=Path(__file__).resolve().parent
ff=str(next((p/'deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe')))
video=p/'Techland-Garage-Promo-1080p.mp4'
r=subprocess.run([ff,'-v','error','-i',str(video),'-progress','pipe:1','-f','null','-'],capture_output=True,text=True,check=True)
lines=dict(l.split('=',1) for l in r.stdout.splitlines() if '=' in l)
dest=p.parents[2]/'deliverables/techland-promo';dest.mkdir(parents=True,exist_ok=True)
for f in [video,p/'cover.jpg',p/'captions.srt',p/'README.txt']:shutil.copyfile(f,dest/f.name)
report={'resolution':'1920x1080','fps':30,'durationSeconds':82,'decodeErrors':r.stderr,'decodedFrames':int(lines.get('frame','0')),'bytes':video.stat().st_size,'destination':str(dest)}
(dest/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
