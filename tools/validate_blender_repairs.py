"""Check repaired real GLBs, source preservation, texture decoding and envelopes."""
import hashlib
import json
from pathlib import Path
from inspect_tripo_glb import Inspector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/tripo/blender-repair'
manifest=ROOT/'assets/tripo/INTERIOR_EQUIPMENT_PLAN.json'
items=json.loads((ROOT/'assets/tripo/INTERIOR_EQUIPMENT.json').read_text(encoding='utf-8'))['items']
results=[]
for item in items:
    if not item.get('website_glb'):
        continue
    path=OUT/'models'/f"{item['id']}.glb"
    report=Inspector(path,item['id'],manifest).run()
    (OUT/'reports'/f"{item['id']}.qa.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    assert report['ready_for_visual_review'],report['errors']
    assert report['summary']['degenerate_triangles']==0,item['id']
    assert report['summary']['images_fully_decoded']==3,item['id']
    assert report['pivot_and_scale']['ground_centered_within_1mm'],item['id']
    assert all(abs(a-b)<.003 for a,b in zip(report['world_bounds']['size_xyz'],item['display_size_m_xyz'])),item['id']
    assert hashlib.sha256((ROOT/item['raw_glb']).read_bytes()).hexdigest()==item['raw_sha256']
    results.append({'asset_id':item['id'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'triangles':report['summary']['triangle_count_sum_primitives'],'embedded_images_decoded':3,
        'degenerate_triangles':0,'size_m_xyz':report['world_bounds']['size_xyz'],
        'bottom_centered_within_1mm':True,'raw_preserved':True})
summary={'tool':'Blender 5.2.3 LTS','repaired_models':len(results),'credits_spent':0,'items':results,
    'scope':'Nine current interior tools/furniture. Outer garage and rejected PC generations are unchanged.',
    'limitations':['Visual display meshes, not manufacturer CAD or certified watertight solids.',
        'Fine generated lettering and some small cable/control details remain approximate.'],
    'validation':'Geometry/accessors/textures/envelopes passed. Visual and browser acceptance recorded separately.'}
(OUT/'validation.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({'models':len(results),'all_checks_passed':True,'credits_spent':0}))
