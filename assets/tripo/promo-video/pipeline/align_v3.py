from pathlib import Path
import json,numpy as np,soundfile as sf
from scipy.signal import resample_poly
from faster_whisper import WhisperModel
R=Path(__file__).resolve().parent
manifest=json.loads((R/'narration-story-v3/manifest.json').read_text(encoding='utf-8'))
model_path=next((R/'asr-models/models--Systran--faster-whisper-small/snapshots').iterdir())
m=WhisperModel(str(model_path),device='cpu',compute_type='int8',cpu_threads=6,local_files_only=True)
out=R/'narration-story-v3/alignment';out.mkdir(exist_ok=True)
all_rows=[]
for j in manifest['segments']:
 suffix=Path(j['source']).stem[2:]
 file=out/(j['language']+'-'+str(j['index']).zfill(2)+suffix+'.json')
 if file.exists():data=json.loads(file.read_text(encoding='utf-8'))
 else:
  a,sr=sf.read(j['source']);a=resample_poly(a,16000,sr).astype(np.float32)
  segs,info=m.transcribe(a,language=j['language'],beam_size=5,word_timestamps=True,vad_filter=False,initial_prompt='Tripo AI. PLAUD NotePin S. Blender. Three.js. WorkBuddy. Cursor. Codex. Spec.')
  segs=list(segs)
  data={'language':j['language'],'index':j['index'],'intended':j['text'],'recognized':' '.join(s.text for s in segs),'duration':j['duration'],'words':[{'start':w.start,'end':w.end,'word':w.word,'probability':w.probability} for s in segs for w in (s.words or [])]}
  file.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({k:data[k] for k in ['language','index','recognized','duration']},ensure_ascii=False),flush=True);all_rows.append(data)
(out/'review.json').write_text(json.dumps(all_rows,ensure_ascii=False,indent=2),encoding='utf-8')
