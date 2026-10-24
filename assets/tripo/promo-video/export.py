from pathlib import Path
import sys,subprocess,wave,json
import numpy as np
out=Path(__file__).resolve().parent
sys.path.insert(0,str(out/'deps'))
ff=str(next((out/'deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe')))
sr=44100;duration=82;n=sr*duration
music=np.zeros(n,dtype=np.float32);beat=60/104
def add(y,start):
 i=int(start*sr);end=min(n,i+len(y))
 if i<n:music[i:end]+=y[:end-i]
notes=[57,64,69,72,55,62,67,71,53,60,65,69,55,62,67,71]
for j,start in enumerate(np.arange(0,duration,beat/2)):
 t=np.arange(int(sr*.43))/sr;freq=440*2**((notes[j%16]-69)/12)
 add((np.sin(2*np.pi*freq*t)+.2*np.sin(4*np.pi*freq*t))*np.exp(-t*10)*.038,start)
for j,start in enumerate(np.arange(0,duration,beat)):
 t=np.arange(int(sr*.2))/sr
 add(np.sin(2*np.pi*(48*t+36*.04*(1-np.exp(-t/.04))))*np.exp(-t*22)*.12,start)
 rng=np.random.default_rng(j);t=np.arange(int(sr*.045))/sr
 add(rng.normal(0,1,len(t))*np.exp(-t*100)*.009,start+beat/2)
music*=np.minimum(1,np.arange(n)/(sr*2))*np.minimum(1,np.arange(n)[::-1]/(sr*3))
with wave.open(str(out/'original-synth-bed.wav'),'wb') as f:
 f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes((np.clip(music,-1,1)*32767).astype('<i2').tobytes())
cmd=[ff,'-y','-i',str(out/'garage-recording.webm'),'-i',str(out/'original-synth-bed.wav'),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','160k','-t','82','-movflags','+faststart',str(out/'Techland-Garage-Promo-1080p.mp4')]
subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=open(out/'encode.log','w'))
subprocess.run([ff,'-y','-ss','15','-i',str(out/'Techland-Garage-Promo-1080p.mp4'),'-frames:v','1',str(out/'cover.jpg')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
for sec in [15,27,39,49,59,69,78]:
 subprocess.run([ff,'-y','-ss',str(sec),'-i',str(out/'Techland-Garage-Promo-1080p.mp4'),'-frames:v','1',str(out/f'check-{sec}.jpg')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(json.dumps({'file':str(out/'Techland-Garage-Promo-1080p.mp4'),'bytes':(out/'Techland-Garage-Promo-1080p.mp4').stat().st_size}))
