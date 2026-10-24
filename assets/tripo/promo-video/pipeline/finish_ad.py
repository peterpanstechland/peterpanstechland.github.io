from pathlib import Path
import json,subprocess,re,sys,math,shutil,difflib,unicodedata
import numpy as np,soundfile as sf
from scipy.signal import butter,sosfilt
R=Path(__file__).resolve().parent;repo=R.parent;O=R/'ad-renders';D=repo/'deliverables/techland-ad-v2';D.mkdir(exist_ok=True)
ff=str(next((repo/'assets/tripo/promo-video/deps/imageio_ffmpeg/binaries').glob('ffmpeg*.exe')))
SR=48000;LENGTH=190
def run(args,name):
 p=subprocess.run([ff,'-y','-hide_banner',*args],capture_output=True,text=True,encoding='utf-8',errors='replace')
 (O/name).write_text(p.stderr,encoding='utf-8')
 if p.returncode:raise RuntimeError(p.stderr[-6000:])
 return p.stderr
def stamp(t,ass=False):
 if ass:
  q=round(t*100);return f'{q//360000}:{q//6000%60:02d}:{q//100%60:02d}.{q%100:02d}'
 q=round(t*1000);return f'{q//3600000:02d}:{q//60000%60:02d}:{q//1000%60:02d},{q%1000:03d}'
def chars(s):return ''.join(c.lower() for c in unicodedata.normalize('NFKC',s) if c.isalnum())
def chunks(s,lang):
 if lang=='en':
  tokens=s.split();out=[];current=''
  for w in tokens:
   if len(current)+len(w)>62 and current:out.append(current);current=''
   current=(current+' '+w).strip()
   if re.search(r'[.!?]$',w) and len(current)>18:out.append(current);current=''
  if current:out.append(current)
  return out
 pieces=re.findall(r'[^，。！？；]+[，。！？；]?',s);out=[];cur=''
 for p in pieces:
  if len(cur)+len(p)>27 and cur:out.append(cur);cur=''
  if len(p)>31:
   for k in range(0,len(p),25):
    if cur:out.append(cur);cur=''
    out.append(p[k:k+25])
  else:cur+=p
 if cur:out.append(cur)
 return out
def captions(j,tempo):
 suffix=Path(j['source']).stem[2:]
 a=json.loads((R/f'narration-qwen/alignment/{j["language"]}-{j["index"]:02d}{suffix}.json').read_text(encoding='utf-8'))
 recognized='';times=[]
 for w in a['words']:
  norm=chars(w['word']);recognized+=norm
  for i in range(len(norm)):times.append(w['start']+(w['end']-w['start'])*(i+.5)/max(1,len(norm)))
 intended=chars(j['text']);mapping={}
 for block in difflib.SequenceMatcher(None,intended,recognized,autojunk=False).get_matching_blocks():
  for k in range(block.size):mapping[block.a+k]=times[block.b+k]
 keys=sorted(mapping)
 if len(keys)>1:
  coords=np.interp(np.arange(len(intended)),keys,[mapping[k] for k in keys]);coords=np.maximum.accumulate(coords)
 else:coords=np.linspace(0,j['duration'],len(intended))
 cues=[];offset=0;last=0
 for text in chunks(j['text'],j['language']):
  count=len(chars(text));begin=max(last,float(coords[min(offset,len(coords)-1)])-.08);end=min(j['duration'],float(coords[min(offset+count-1,len(coords)-1)])+.15)
  end=max(begin+.4,end);last=end+.025;offset+=count
  cues.append({'start':j['start']+begin/tempo,'end':min(j['start']+j['duration']/tempo,j['start']+end/tempo),'text':text})
 return cues
def make_voice(lang):
 manifest=json.loads((R/'narration-qwen/manifest.json').read_text(encoding='utf-8'))
 track=np.zeros(SR*LENGTH,dtype=np.float32);cues=[];report=[]
 for j in manifest['segments']:
  if j['language']!=lang:continue
  tempo=max(1,j['tempoNeeded']);target=O/f'voice-{lang}-{j["index"]:02d}.wav'
  if tempo>1.12:raise RuntimeError(f'Retake overlong phrase: {lang}/{j["index"]} {tempo}')
  chain=f'highpass=f=60,afade=t=in:d=0.008,afade=t=out:st={max(0,j["duration"]-.018)}:d=0.018'
  if tempo>1.001:chain+=f',atempo={tempo}'
  chain+=',loudnorm=I=-18:TP=-2:LRA=9,aresample=48000'
  run(['-v','warning','-i',j['source'],'-af',chain,'-ac','1','-c:a','pcm_s24le',str(target)],f'voice-{lang}-{j["index"]:02d}.log')
  audio,sr=sf.read(target,dtype='float32');start=round(j['start']*SR);track[start:start+len(audio)]+=audio
  cues.extend(captions(j,tempo));report.append({'chapter':j['index'],'text':j['text'],'start':j['start'],'duration':len(audio)/SR,'tempo':tempo})
 sf.write(O/f'narration-{lang}.wav',track,SR,subtype='PCM_24')
 srt='\n\n'.join(f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}' for i,c in enumerate(cues))+'\n'
 (D/f'Techland-{lang}.srt').write_text(srt,encoding='utf-8')
 header='[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Main,Microsoft YaHei,34,&H00F3FAFC,&H000000FF,&H001C0B10,&H001C0B10,0,0,0,0,100,100,0,0,1,1.5,0,2,130,130,12,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
 events='\n'.join(f'Dialogue: 0,{stamp(c["start"],True)},{stamp(c["end"],True)},Main,,0,0,0,,{c["text"]}' for c in cues)
 (O/f'subtitles-{lang}.ass').write_text(header+events,encoding='utf-8-sig')
 (O/f'narration-{lang}-review.json').write_text(json.dumps({'engine':'Qwen3-TTS','segments':report,'captions':cues,'captionReview':'ASR word timing aligned against intended script; brand names and pricing corrected in text'},ensure_ascii=False,indent=2),encoding='utf-8')
 print('Voice and subtitles ready',lang,len(cues),flush=True)
def common_audio():
 music=R/'Techland-Build-Beyond-the-Screen-Runway.mp3';edited=O/'music-190.wav'
 if not edited.exists():
  flt='[0:a]asplit=3[a][b][c];[a]atrim=0:112,asetpts=PTS-STARTPTS[a0];[b]atrim=55:95,asetpts=PTS-STARTPTS[b0];[c]atrim=112,asetpts=PTS-STARTPTS[c0];[a0][b0]acrossfade=d=1.08:c1=tri:c2=tri[ab];[ab][c0]acrossfade=d=1.08:c1=tri:c2=tri,apad,atrim=0:190,loudnorm=I=-22:TP=-3:LRA=9,afade=t=in:d=0.7,afade=t=out:st=186.5:d=3.5,aresample=48000[m]'
  run(['-i',str(music),'-filter_complex',flt,'-map','[m]','-ac','2','-c:a','pcm_s24le',str(edited)],'music-edit.log')
 sfx=O/'sound-design.wav'
 if not sfx.exists():
  out=np.zeros(SR*LENGTH,dtype=np.float32);rng=np.random.default_rng(2026)
  def add(a,t):
   i=int(t*SR);out[i:i+len(a)]+=a
  for sec in [8,16,26,36,48,58,68,78,88,100,105,108,110.5,112.5,115,126,136,146]:
   t=np.arange(int(.35*SR))/SR;env=np.sin(np.pi*t/.35)**2*np.exp(-t*3)
   noise=sosfilt(butter(2,[650,6500],fs=SR,btype='bandpass',output='sos'),rng.normal(size=len(t)))
   add((noise*.035+np.sin(2*np.pi*(320*t+1400*t*t))*.012)*env,max(0,sec-.12))
  for sec,freq in [(.15,850),(.65,1275),(184.3,660),(184.55,990),(184.8,1320)]:
   t=np.arange(int(.3*SR))/SR;add(.025*np.sin(2*np.pi*freq*t)*np.exp(-t*18),sec)
  sf.write(sfx,out,SR,subtype='PCM_24')
def mix(lang):
 raw=O/f'mixed-{lang}-raw.wav'
 flt='[0:a]aformat=channel_layouts=stereo,asplit=2[voice][sc];[1:a][sc]sidechaincompress=threshold=0.028:ratio=5:attack=12:release=320[duck];[voice][duck][2:a]amix=inputs=3:normalize=0,alimiter=limit=0.84:level=false:latency=true,atrim=0:190[m]'
 run(['-i',str(O/f'narration-{lang}.wav'),'-i',str(O/'music-190.wav'),'-i',str(O/'sound-design.wav'),'-filter_complex',flt,'-map','[m]','-ar','48000','-ac','2','-c:a','pcm_s24le',str(raw)],f'mix-{lang}.log')
 log=run(['-i',str(raw),'-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'],f'loudness-{lang}-analysis.log')
 stats=json.loads(log[log.rfind('{'):log.rfind('}')+1])
 norm=f'loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={stats["input_i"]}:measured_TP={stats["input_tp"]}:measured_LRA={stats["input_lra"]}:measured_thresh={stats["input_thresh"]}:offset={stats["target_offset"]}:linear=true:print_format=json'
 run(['-i',str(raw),'-af',norm,'-ar','48000','-c:a','pcm_s24le',str(O/f'mixed-{lang}.wav')],f'loudness-{lang}-master.log')
 print('Audio mix ready',lang,flush=True)
def export(lang):
 # A dedicated subtitle band preserves all scene labels and pricing footnotes.
 ass=(O/f'subtitles-{lang}.ass').resolve().as_posix().replace(':',r'\:')
 visual=O/f'visual-{lang}.mp4';out=D/f'Techland-Cyber-Eternal-Studio-{lang.upper()}-1080p.mp4'
 flt=f"scale=1760:990:flags=lanczos,pad=1920:1080:80:0:color=0x100b1c,ass=filename='{ass}'"
 run(['-i',str(visual),'-i',str(O/f'mixed-{lang}.wav'),'-vf',flt,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-threads','6','-preset','fast','-crf','19','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','256k','-ar','48000','-t','190','-metadata','title=Cyber Eternal Studio / Peter Pan\'s Techland','-metadata',f'language={lang}','-movflags','+faststart',str(out)],f'export-{lang}.log')
 run(['-v','error','-i',str(out),'-f','null','-'],f'decode-{lang}.log')
 print('EXPORTED',out,out.stat().st_size,flush=True)
if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='audio':
  common_audio()
  for lang in ['zh','en']:make_voice(lang);mix(lang)
 elif mode=='export':
  for lang in ['zh','en']:export(lang)
