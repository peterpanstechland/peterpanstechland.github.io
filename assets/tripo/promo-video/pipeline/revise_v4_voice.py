from pathlib import Path
import os,json,hashlib,shutil
R=Path(__file__).resolve().parent;os.environ['HF_HOME']=str(R/'hf-cache')
import torch,soundfile as sf
from qwen_tts import Qwen3TTSModel
out=R/'narration-v4';out.mkdir(exist_ok=True);shutil.copytree(R/'narration-story-v3/alignment',out/'alignment',dirs_exist_ok=True)
file=out/'manifest.json';data=json.loads((R/'narration-story-v3/manifest.json').read_text(encoding='utf-8'))
m=Qwen3TTSModel.from_pretrained(str(R/'models/qwen'),device_map='cuda:1',dtype=torch.bfloat16,attn_implementation='sdpa');a,sr=sf.read(R/'voice-comparison/reference-14s.wav');p=m.create_voice_clone_prompt(ref_audio=(a,sr),x_vector_only_mode=True)
for j in data['segments']:
 lang,index=j['language'],j['index']
 if (lang,index) not in [('zh',10),('zh',11),('zh',14),('en',14)]:continue
 text=j['text'].replace('普劳德','Pu laude')
 if index==14:text='想亲自逛逛这个世界？作品就在我的博客首页。打开屏幕上的网址，点走进车库。下一件，我们一起造！' if lang=='zh' else 'Explore it at peterpanstechland dot github dot io. Choose Enter the Garage, and come build the next thing with us!'
 target=out/f'{lang}-{index:02d}-v4.wav'
 if not target.exists():
  waves,sr=m.generate_voice_clone(text=text,language='Chinese' if lang=='zh' else 'English',voice_clone_prompt=p,max_new_tokens=3000);sf.write(target,waves[0],sr,subtype='PCM_16')
 # Preserve the two-digit basename contract used by the caption assembler.
 named=out/lang/f'{index:02d}-v4.wav';named.parent.mkdir(exist_ok=True);shutil.copyfile(target,named)
 j.update(source=str(named),text=text,duration=sf.info(named).duration,sha256=hashlib.sha256(named.read_bytes()).hexdigest());j['tempoNeeded']=max(1,j['duration']/(j['end']-j['start']))
 file.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');print(lang,index,j['duration'],j['tempoNeeded'],flush=True)
