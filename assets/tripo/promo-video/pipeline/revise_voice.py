from pathlib import Path
import os,json,hashlib,time
R=Path(__file__).resolve().parent;os.environ['HF_HOME']=str(R/'hf-cache')
import torch,soundfile as sf
from qwen_tts import Qwen3TTSModel
old=json.loads((R/'narration-qwen/manifest.json').read_text(encoding='utf-8'))
out=R/'narration-story-v3';out.mkdir(exist_ok=True)
torch.manual_seed(2027)
m=Qwen3TTSModel.from_pretrained(str(R/'models/qwen'),device_map='cuda:1',dtype=torch.bfloat16,attn_implementation='sdpa')
a,sr=sf.read(R/'voice-comparison/reference-14s.wav')
# Speaker embedding only prevents the truncated reference sentence continuing into new takes.
p=m.create_voice_clone_prompt(ref_audio=(a,sr),x_vector_only_mode=True)
jobs=old['segments'];story=json.loads((R/'narrative-v3.json').read_text(encoding='utf-8'))
for j in jobs:
 j['text']=story[j['language']][j['index']]
 target=out/j['language']/f'{j["index"]:02d}.wav';target.parent.mkdir(exist_ok=True);j['source']=str(target)
for i in range(0,len(jobs),2):
 batch=jobs[i:i+2];missing=[j for j in batch if not Path(j['source']).exists()]
 if missing:
  waves,sr=m.generate_voice_clone(text=[j['text'] for j in missing],language=['Chinese' if j['language']=='zh' else 'English' for j in missing],voice_clone_prompt=p,max_new_tokens=1800)
  for j,w in zip(missing,waves):sf.write(j['source'],w,sr,subtype='PCM_16')
 for j in batch:
  j['duration']=sf.info(j['source']).duration;j['tempoNeeded']=max(1,j['duration']/(j['end']-j['start']));j['sha256']=hashlib.sha256(Path(j['source']).read_bytes()).hexdigest()
 old['conditioning']='Qwen3-TTS speaker embedding only; no unfinished reference transcript continuation'
 (out/'manifest.json').write_text(json.dumps(old,ensure_ascii=False,indent=2),encoding='utf-8')
 print([(j['language'],j['index'],j['duration'],round(j['tempoNeeded'],3)) for j in batch],flush=True)
