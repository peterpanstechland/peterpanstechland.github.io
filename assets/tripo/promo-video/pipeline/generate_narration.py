from pathlib import Path
import os,json,time,sys,hashlib
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parent
os.environ['HF_HOME']=str(ROOT/'hf-cache')
import torch,soundfile as sf
from qwen_tts import Qwen3TTSModel
chapters=json.loads((REPO/'assets/tripo/promo-video/ad-chapters-bilingual.json').read_text(encoding='utf-8'))
en=[
"Welcome to my Cyber Eternal Studio. A home for wild ideas, built to be explored.",
"The lucky cat waves. Projects levitate in a vending machine. Every object opens a story.",
"With Tripo AI, start from a clear reference image or a text prompt, and generate a 3D asset.",
"Upload. Choose detail or topology. Generate, inspect every angle, then export a GLB for the web.",
"Start free with two hundred monthly credits. Pro is twenty US dollars per month. API credits and extra processing are billed separately.",
"Arrange scale and placement in Blender. Add lights and interaction with Three.js. Turn assets into a workshop.",
"Robots, dexterous hands, hackathons. New projects and tool guides will keep this workshop growing.",
"Walk around the back. Leave a photo, a message, or a wish. Reviewed visits become shared memories.",
"Put your brand on this neon billboard. We are looking for core, hardware, and community sponsors.",
"Three pages: ten, eight, and five seconds. From fifty renminbi monthly. Logos link to your website. Confirmed campaigns appear on schedule.",
"Give your product a cyber booth. PLAUD NotePin S connects a 3D showcase with future hands-on reviews.",
"Capture hackathon meetings and scattered ideas. Let AI distill requirements and a development spec. Then bring it into WorkBuddy, Cursor, or Codex. A workflow I plan to test.",
"Have an event to share? Workshops, launches, booths, swag. Our independent Makers Challenge proposal is also seeking partners.",
"Click the billboard to apply. Submit your logo, website and dates. I review each collaboration. Payment is handled manually.",
"From one image to a studio. From one person's imagination to a shared creation. Let's build the next thing together."
]
chapters[9]['voice']='三页轮播，十秒、八秒、五秒。五十元每月起。标志可以跳转官网，合作确认后按档期展示。'
chapters[11]['voice']='我想用它记录黑客松会议和发散灵感，再由 AI 整理需求与开发规格，交给 WorkBuddy、Cursor 或 Codex。这是接下来要实测的工作流。'
out=ROOT/'narration-qwen';out.mkdir(exist_ok=True)
reference=json.loads((ROOT/'voice-comparison/reference.json').read_text(encoding='utf-8'))
device=sys.argv[1] if len(sys.argv)>1 else 'cuda:1'
torch.manual_seed(2026)
model=Qwen3TTSModel.from_pretrained(str(ROOT/'models/qwen'),device_map=device,dtype=torch.bfloat16,attn_implementation='sdpa')
audio,sr=sf.read(ROOT/'voice-comparison/reference-14s.wav')
prompt=model.create_voice_clone_prompt(ref_audio=(audio,sr),ref_text=reference['transcript'],x_vector_only_mode=False)
jobs=[]
for language in ['zh','en']:
 (out/language).mkdir(exist_ok=True)
 for c in chapters:
  text=c['voice'] if language=='zh' else en[c['index']]
  jobs.append({'language':language,'index':c['index'],'start':c['start']+.45,'end':c['end']-.25,'text':text,'source':str(out/language/(str(c['index']).zfill(2)+'.wav'))})
records=[]
for i in range(0,len(jobs),2):
 batch=jobs[i:i+2];missing=[j for j in batch if not Path(j['source']).exists()]
 if missing:
  began=time.time()
  waves,sample_rate=model.generate_voice_clone(text=[j['text'] for j in missing],language=['Chinese' if j['language']=='zh' else 'English' for j in missing],voice_clone_prompt=prompt,max_new_tokens=2048)
  for j,wav in zip(missing,waves):sf.write(j['source'],wav,sample_rate,subtype='PCM_16')
  print('Generated batch',i//2+1,'in',round(time.time()-began,1),'seconds',flush=True)
 for j in batch:
  info=sf.info(j['source']);j['duration']=info.duration;j['sampleRate']=info.samplerate;j['sha256']=hashlib.sha256(Path(j['source']).read_bytes()).hexdigest();j['tempoNeeded']=max(1,info.duration/(j['end']-j['start']));records.append(j)
 (out/'manifest.json').write_text(json.dumps({'engine':'Qwen3-TTS 1.7B Base','speaker':'Peter / authorized own voice sample','referenceHash':reference['referenceSha256'],'selection':'User selected Qwen3-TTS for both languages after local A/B comparison','segments':records},ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps([{k:j[k] for k in ['language','index','duration','tempoNeeded']} for j in batch]),flush=True)
print('ALL NARRATION READY',flush=True)
