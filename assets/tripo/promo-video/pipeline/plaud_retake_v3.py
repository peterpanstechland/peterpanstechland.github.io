from pathlib import Path
import os,json,hashlib
R=Path(__file__).resolve().parent;os.environ['HF_HOME']=str(R/'hf-cache')
import torch,soundfile as sf
from qwen_tts import Qwen3TTSModel
m=Qwen3TTSModel.from_pretrained(str(R/'models/qwen'),device_map='cuda:1',dtype=torch.bfloat16,attn_implementation='sdpa');a,sr=sf.read(R/'voice-comparison/reference-14s.wav');p=m.create_voice_clone_prompt(ref_audio=(a,sr),x_vector_only_mode=True)
scripts={('zh',10):'广告位之外，硬件也能成为创作伙伴。也是因为有了普劳德，这间赛博工作室的想法才能更快落地。',('en',10):'Hardware can be a creative partner too. My NotePin S helped me turn this cyber studio from an idea into something real.',('zh',11):'之后我会详细测评，普劳德 NotePin S 怎样帮助我这种 AI native 独立工作室。比如去打黑客松，把会议记录提纯成产品需求，再尝试打通 WorkBuddy、Cursor、Codex 的一键导入。作为 ADHD 创作者，我的想法总是天马行空。普劳德帮我把灵感收拢，再借助 AI 整理成需求文档和开发 Spec，让从脑洞到实际作品的过程更快。',('en',11):'In a detailed review, I will explore what NotePin S brings to my A I native independent studio. At a hackathon, that means turning meeting recordings into product requirements, and testing a one-click handoff to WorkBuddy, Cursor, or Codex. As a creator with A D H D, my ideas can go in every direction. NotePin S helps me capture and organize them. Then A I can turn them into requirements and a development spec, shortening the journey from imagination to something real.'}
file=R/'narration-story-v3/manifest.json';data=json.loads(file.read_text(encoding='utf-8'))
for (lang,index),text in scripts.items():
 target=R/f'narration-story-v3/{lang}/{index:02d}-plaud.wav'
 if not target.exists():
  waves,sr=m.generate_voice_clone(text=text,language='Chinese' if lang=='zh' else 'English',voice_clone_prompt=p,max_new_tokens=3500);sf.write(target,waves[0],sr,subtype='PCM_16')
 j=next(j for j in data['segments'] if j['language']==lang and j['index']==index);j.update(text=text,source=str(target),duration=sf.info(target).duration,tempoNeeded=1,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
 file.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');print(lang,index,j['duration'],flush=True)
