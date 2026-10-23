"""Integrate reviewed older assets; originals and generation records are retained."""
import hashlib,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/tripo/blender-garage'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,x):p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
config=read(ROOT/'static/maker-garage-preview/assets.json');published=read(ROOT/'assets/tripo/PUBLISHED_ASSETS.json')
validation=read(OUT/'validation.json')
notes={
'01_garage_shell':'校平屋顶并分件；清除室内悬空破面，补制完整天花板和地板，保留外围结构与做旧细节。',
'02_roller_shutter':'逐片清理门片与着色，保留 26 片独立轴心、涂鸦和开关参数。',
'03_profile_sign':'清理圆形招牌框接缝与异常反光，保留霓虹分段。',
'04_lucky_cat':'改善猫身着色，保留原骨骼、权重与招手动作。',
'05_project_vending':'校平柜顶、改善硬表面着色，保留展示窗与出货口。',
'06_showcase_zone':'把破损搁板补为三层实体钢搁板，保留分隔与下柜。',
'08_street_lamp':'修正杆体着色，为悬空控制盒补上两根钢支架。',
'09_trash_bin':'清理底部尖刺与后部破片，补制平整底座和后板。',
'10_utility_cabinet':'校平顶盖并修正机柜着色，保留通风口、铰链与把手。',
'11_tree':'清理冗余几何与底部接触面，保留树叶轮廓。',
'12_plants_grass':'清理几何、稳定盆底接触面，保留植物与草地分离。',
'13_street_base':'把薄片街道重建为闭合实体底座，烘焙保留原路面颜色与表面细节。'}
for result in validation['items']:
    aid=result['asset_id'];record=read(OUT/'reports'/f'{aid}.json')
    model=ROOT/record['output_glb'];assert hashlib.sha256(model.read_bytes()).hexdigest()==result['sha256']
    item=next(a for a in config['assets'] if a['id']==aid)
    target=ROOT/'static/maker-garage-preview'/item['file']
    temp=target.with_suffix('.glb.tmp')
    shutil.copy2(model,temp);temp.replace(target)
    item.update(modelRevision=result['sha256'][:12],postprocess='blender-garage-v1')
    item['description']={'zh':'Blender 优化：'+notes[aid]+' 原始 Tripo 输出保留。','en':'Blender repair: '+record['changes']['notes'][0]+' Original source retained.'}
    if aid=='13_street_base':item['solidFoundation']=True
    record.update(visual_acceptance='accepted_with_notes',visual_review='Front and back neutral-light renders inspected. Generated fine details remain approximate; local replacement parts are named LOCAL_.')
    if aid in ['02_roller_shutter','04_lucky_cat']:record['animation_compatibility']='passed; see animation-validation.json'
    write(OUT/'reports'/f'{aid}.json',record)
    pub=next(a for a in published['assets'] if a['id']==aid);pub.update(sha256=result['sha256'],postprocess='blender-garage-v1')
published['revision']='whole-garage-blender-v1'
published['notes']=[n for n in published['notes'] if not n.startswith('Whole garage Blender:')]
published['notes'].append('Whole garage Blender: 12 exterior/character assets plus 9 interior assets locally repaired. Original downloads retained. No additional Tripo credits. Rejected historical tools zone and PC generations remain excluded.')
write(ROOT/'static/maker-garage-preview/assets.json',config);write(ROOT/'assets/tripo/PUBLISHED_ASSETS.json',published)
for p in [ROOT/'static/maker-garage-preview/scene/index.html',ROOT/'src/pages/maker-garage-preview.tsx']:
    p.write_text(p.read_text(encoding='utf-8').replace('blender-repair-v1','blender-garage-v1'),encoding='utf-8')
p=ROOT/'static/maker-garage-preview/scene.js'
p.write_text(p.read_text(encoding='utf-8').replace("./ground-contact.js?v=interior-v1","./ground-contact.js?v=blender-garage-v1"),encoding='utf-8')
write(ROOT/'assets/tripo/GARAGE_BLENDER_REPORT.json',{'date':'2026-10-23','tool':'Blender 5.2.3 LTS','total_current_models':21,'this_batch_models':12,'earlier_interior_models':9,'additional_tripo_credits':0,'publication':'local preview only','originals_preserved':True,'scope_exclusions':['Rejected old tools-zone output, replaced by separate equipment','Two rejected PC tower attempts','Superseded mascot references and historical intermediates'], 'details':validation['items'],'animation':read(OUT/'animation-validation.json'),'limitations':['Scene display assets, not manufacturer CAD.','Fine generated lettering, small controls and some weathering remain approximate.','Only the rebuilt street foundation is checked as a closed manifold; not a watertight certification of all meshes.']})
print('Integrated 12 older assets; 21 active models now use Blender repairs.')
