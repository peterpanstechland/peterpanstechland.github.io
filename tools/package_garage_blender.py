"""Package reviewed assets only; omit raw API replies and signed download URLs."""
import hashlib,json,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'assets/tripo'
report=json.loads((BASE/'GARAGE_BLENDER_REPORT.json').read_text(encoding='utf-8'))
config=json.loads((ROOT/'static/maker-garage-preview/assets.json').read_text(encoding='utf-8'))
models=[a for a in config['assets'] if a.get('file')]
assert len(models)==21
for a in models:
    digest=hashlib.sha256((ROOT/'static/maker-garage-preview'/a['file']).read_bytes()).hexdigest()
    assert digest.startswith(a['modelRevision'])
    for locale in ['', 'zh-Hans']:
        p=ROOT/'build'/locale/'maker-garage-preview'/a['file']
        assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==digest,p
report['build_validation']={'english':True,'simplified_chinese':True,'all_21_output_hashes_match_both_locales':True}
report['placement_validation']=json.loads((BASE/'records/interior-equipment-placement.qa.json').read_text())
report['browser_validation']=json.loads((BASE/'blender-garage/browser-validation.json').read_text())
(BASE/'GARAGE_BLENDER_REPORT.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
delivery='''Cyber Maker Garage — Blender optimization, 2026-10-23

21 current unique GLBs and 21 editable Blender projects.
12 garage/character/street assets plus 9 earlier interior tools/furniture.
Two monitor instances share one GLB. No additional Tripo credits.

Open blender-review.html in a browser for before/after and rear views.
The comparison page's scene link requires the local site preview on port 4173.
The GLBs can be opened in any glTF viewer. All Blender textures are packed.
Website assets preserve their established coordinate conventions; use the site's
assets.json placement settings when assembling the original scene.

Original downloads remain in the project; before/ snapshots in this bundle are
the exact prior website GLBs. LOCAL_ objects identify locally rebuilt geometry.
The cat preserves its rig and Techland_Beckon clip; shutter retains 26 slat pivots.
The street is a closed manifold foundation with baked original color/detail.

Historical rejected PC tower attempts and replaced old tools-zone output are
archived, not presented as accepted models. Fine lettering/controls/cables remain
display-grade. These are not manufacturer CAD or manufacturing-certified solids.

Code is in the existing codex/garage-interior-equipment working branch.
This batch has not been committed, pushed, merged or deployed.
'''
(BASE/'BLENDER_DELIVERY.txt').write_text(delivery,encoding='utf-8')
paths=[BASE/'blender-review.html',BASE/'GARAGE_BLENDER_REPORT.json',BASE/'BLENDER_DELIVERY.txt']
for folder in ['blender-garage','blender-repair']:
    for sub in ['models','blend','before','renders','reports']:
        paths.extend(p for p in (BASE/folder/sub).rglob('*') if p.is_file() and p.suffix in ['.glb','.blend','.png','.json'])
    paths.extend(p for p in (BASE/folder).glob('*validation.json'))
zip_path=BASE/'whole-garage-blender-delivery.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=3) as z:
    for p in sorted(set(paths)):z.write(p,p.relative_to(BASE))
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    assert len([n for n in z.namelist() if '/models/' in n and n.endswith('.glb')])==21
    assert len([n for n in z.namelist() if n.endswith('.blend')])==21
print(json.dumps({'zip':str(zip_path),'MiB':round(zip_path.stat().st_size/1024**2,1),'models':21,'Blender_projects':21,'crc_passed':True}))
