"""Integrate the nine visually reviewed Blender repairs, retaining originals."""
import hashlib
import json
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/tripo/blender-repair'
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
validation=read(OUT/'validation.json')
equipment=read(ROOT/'assets/tripo/INTERIOR_EQUIPMENT.json')
config=read(ROOT/'static/maker-garage-preview/assets.json')
published=read(ROOT/'assets/tripo/PUBLISHED_ASSETS.json')
notes={
 '14_bambu_x1c':'Blender 修复：打印平台补制为平整打印板、加热底板和支架，保留原机舱与打印头。',
 '15_makeblock_laserbox':'Blender 修复：替换破碎观察窗，校正侧板，保留原外壳。',
 '16_openpnp_machine':'Blender 修复：校正底座与龙门支架表面，保留吸嘴、送料区和 PCB。',
 '17_soldering_station':'Blender 修复：校平控制器顶面与侧壁，修正异常反光。',
 '18_hot_air_station':'Blender 修复：校平底座台面与控制器侧壁，保留热风枪与软管。',
 '19_oscilloscope':'Blender 修复：校平机壳顶面并修正着色，保留面板和接口。',
 '21_monitor':'Blender 修复：校平屏幕与底部接触面，保留支架与后壳。',
 '22_office_desk':'Blender 修复：保留木桌面和抽屉，补制规整方管桌架、横撑和脚垫。',
 '23_workbench':'Blender 修复：保留原贴图上围边，重建桌架、实体钢台面和下层搁板。',
}
for result in validation['items']:
    asset=result['asset_id'];record=read(OUT/'reports'/f'{asset}.json')
    source=OUT/'models'/f'{asset}.glb'
    assert hashlib.sha256(source.read_bytes()).hexdigest()==result['sha256']==record['output_sha256']
    item=next(i for i in equipment['items'] if i['id']==asset)
    shutil.copy2(source,ROOT/item['website_glb'])
    record['visual_acceptance']='accepted_with_notes'
    record['visual_review']='Front and rear neutral-light Blender renders inspected; source textures retained, local replacement parts explicitly named.'
    write(OUT/'reports'/f'{asset}.json',record)
    item['website_sha256']=result['sha256']
    item['blender_repair']={'report':f'assets/tripo/blender-repair/reports/{asset}.json',
        'blend':f'assets/tripo/blender-repair/blend/{asset}.blend',
        'input_sha256':record['input_sha256'],'output_sha256':result['sha256'],'credits':0}
    item['notes']=[n for n in item['notes'] if not n.startswith('Blender repair:')]
    item['notes'].append('Blender repair: '+' '.join(record['changes']['notes']))
    display=next(i for i in config['assets'] if i['id']==asset)
    display['modelRevision']=result['sha256'][:12]
    display['postprocess']='blender-repair-v1'
    display['description']={'zh':notes[asset]+' 原始 Tripo 输出保留；这是场景展示模型，品牌与屏幕文字后期制作。',
        'en':'Blender repair of the real Tripo source. '+record['changes']['notes'][0]+' Original download preserved; display model, not manufacturer CAD.'}
    pub=next(i for i in published['assets'] if i['id']==asset)
    pub['sha256']=result['sha256'];pub['postprocess']='blender-repair-v1'
equipment['revision']='interior-blender-repair-v1'
equipment['blender_repair_summary']={'models':9,'credits':0,'report':'assets/tripo/blender-repair/validation.json','publication':'local_preview_only'}
published['revision']='interior-blender-repair-v1'
published['notes']=[n for n in published['notes'] if not n.startswith('Blender repair:')]
published['notes'].append('Blender repair: nine interior assets locally repaired; see blender-repair/validation.json. No additional Tripo credits spent.')
write(ROOT/'assets/tripo/INTERIOR_EQUIPMENT.json',equipment)
write(ROOT/'static/maker-garage-preview/assets.json',config)
write(ROOT/'assets/tripo/PUBLISHED_ASSETS.json',published)
print('Integrated 9 verified repair GLBs; original downloads unchanged.')
