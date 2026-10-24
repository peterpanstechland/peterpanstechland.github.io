from pathlib import Path
r=Path(__file__).resolve().parent
s=(r/'render_outro.py').read_text(encoding='utf-8').replace("OUT=ROOT/'ad-renders'","OUT=ROOT/'ad-v3-renders'").replace('SCROLL=38;DURATION=44','SCROLL=14;DURATION=19').replace('+8.2)', '+3.5)')
(r/'render_outro_v3.py').write_text(s,encoding='utf-8')
s=(r/'align_narration.py').read_text(encoding='utf-8').replace('narration-qwen','narration-story-v3')
(r/'align_v3.py').write_text(s,encoding='utf-8')
s=(r/'finish_ad.py').read_text(encoding='utf-8').replace('narration-qwen','narration-story-v3').replace('ad-renders','ad-v3-renders').replace('techland-ad-v2','techland-ad-v3').replace('LENGTH=190','LENGTH=177').replace('music-190','music-177').replace('0:112','0:137').replace('55:95','93:120').replace('atrim=112','atrim=137').replace('0:190','0:177').replace('st=186.5','st=173.5').replace("'-t','190'","'-t','177'").replace('I=-22:TP=-3','I=-20:TP=-3').replace('for sec in [8,16,26,36,48,58,68,78,88,100,105,108,110.5,112.5,115,126,136,146]:','for sec in []:').replace('[(.15,850),(.65,1275),(184.3,660),(184.55,990),(184.8,1320)]','[]').replace('afade=t=in:d=0.008','afade=t=in:d=0.025')
(r/'finish_v3.py').write_text(s,encoding='utf-8');(r/'ad-v3-renders').mkdir(exist_ok=True)
