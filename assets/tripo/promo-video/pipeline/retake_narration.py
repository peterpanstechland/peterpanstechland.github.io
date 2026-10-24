from pathlib import Path
import os,json,time,hashlib
R=Path(__file__).resolve().parent;os.environ['HF_HOME']=str(R/'hf-cache')
import torch,soundfile as sf
from qwen_tts import Qwen3TTSModel
script={2:'With Tripo A I, start from a clear image or a text prompt. Then generate a three-dimensional model.',6:'Robots. Dexterous hands. Build challenges. I will keep adding new projects and helpful guides as this workshop grows.',7:'Go around the back. Add a photo, a message, or a wish. I review each submission before it joins the wall.',9:'Three pages. Ten, eight, and five seconds. From fifty Chinese yuan a month. Clickable logos. Approved ads follow your schedule.',10:'Give your product a digital booth. Here, a NotePin S showcase links to a product page and a future hands-on review.'}
torch.manual_seed(2026)
m=Qwen3TTSModel.from_pretrained(str(R/'models/qwen'),device_map='cuda:1',dtype=torch.bfloat16,attn_implementation='sdpa')
ref=json.loads((R/'voice-comparison/reference.json').read_text(encoding='utf-8'));a,sr=sf.read(R/'voice-comparison/reference-14s.wav')
p=m.create_voice_clone_prompt(ref_audio=(a,sr),ref_text=ref['transcript'],x_vector_only_mode=False)
manifest=json.loads((R/'narration-qwen/manifest.json').read_text(encoding='utf-8'))
for index,text in script.items():
 target=R/f'narration-qwen/en/{index:02d}-v3.wav'
 if not target.exists():
  waves,sr=m.generate_voice_clone(text=text,language='English',voice_clone_prompt=p,max_new_tokens=1536);sf.write(target,waves[0],sr,subtype='PCM_16')
 j=next(j for j in manifest['segments'] if j['language']=='en' and j['index']==index)
 j.update(text=text,source=str(target),duration=sf.info(target).duration,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
 j['tempoNeeded']=max(1,j['duration']/(j['end']-j['start']))
 (R/'narration-qwen/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 print(index,j['duration'],j['tempoNeeded'],flush=True)
