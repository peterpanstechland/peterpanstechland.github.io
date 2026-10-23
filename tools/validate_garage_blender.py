"""Validate the 12 older asset repairs; animation is checked separately in Three."""
import hashlib
import json
from pathlib import Path
from inspect_tripo_glb import Inspector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/tripo/blender-garage'
animation=json.loads((OUT/'animation-validation.json').read_text())
results=[]
for path in sorted((OUT/'models').glob('*.glb')):
    asset='04_lucky_cat' if path.stem.startswith('04') else path.stem
    report=Inspector(path,asset,ROOT/'PeterPansTechland_Tripo_Generation_Pack/manifest.json').run()
    if asset=='04_lucky_cat':
        assert report['skinning_data_validation']['status']=='passed'
        assert animation['cat']['skinMotionPreserved']
        assert all('skinning; deformed bounds' in s for s in report['unsupported'])
        report['supplemental_animation_check']='animation-validation.json: actual CPU-skinned poses compared against original at six times'
    else:
        assert report['ready_for_visual_review'],report['errors']
    assert not report['errors'] and report['summary']['degenerate_triangles']==0,asset
    assert report['summary']['images_fully_decoded']==report['summary']['image_count']>0,asset
    record=json.loads((OUT/'reports'/f'{asset}.json').read_text(encoding='utf-8'))
    assert hashlib.sha256((OUT/'before'/path.name).read_bytes()).hexdigest()==record['original_sha256']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==record['output_sha256']
    (OUT/'reports'/f'{asset}.qa.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    results.append({'asset_id':asset,'sha256':record['output_sha256'],'geometry_textures_passed':True,'original_preserved':True,'summary':report['summary']})
(OUT/'validation.json').write_text(json.dumps({'models':len(results),'credits':0,'items':results},indent=2)+'\n')
assert len(results)==12
print('Validated 12 GLBs: geometry, embedded images, source preservation; supplemental cat animation passed.')
