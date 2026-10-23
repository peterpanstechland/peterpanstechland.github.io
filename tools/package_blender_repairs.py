"""Package checked GLBs, standalone Blender projects and review evidence."""
import hashlib
import json
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/tripo/blender-repair'
read=lambda path:json.loads(path.read_text(encoding='utf-8'))
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
summary=read(OUT/'validation.json')
native=read(OUT/'native-project-validation.json')
placement=read(ROOT/'assets/tripo/INTERIOR_PLACEMENT_QA.json')
assert len(native)==9 and all(i['opens'] for i in native)
assert placement['allSupported'] and placement['missingWorkbenchHidesAllDevices'] and placement['workbenchRecoveryRestoresDevices']
for item in summary['items']:
    asset=item['asset_id']
    for base in ['static','build','build/zh-Hans']:
        assert hashlib.sha256((ROOT/base/'maker-garage-preview/models'/f'{asset}.glb').read_bytes()).hexdigest()==item['sha256']
    assert read(OUT/'reports'/f'{asset}.json')['visual_acceptance']=='accepted_with_notes'
for base in ['build','build/zh-Hans']:
    assert (ROOT/base/'maker-garage-preview/assets.json').read_bytes()==(ROOT/'static/maker-garage-preview/assets.json').read_bytes()
summary.update({'publication':'local_preview_only','branch':'codex/garage-interior-equipment',
    'checks':{'typecheck':'passed','english_chinese_build':'passed','native_blend_reopen':'9 passed, all images packed',
        'real_mesh_contact':'10 instances supported','placement_idempotent':True,
        'missing_table_fallback_and_recovery':'passed','built_glbs_match_sources_in_both_locales':True,
        'browser_desktop':'21/22 loaded; rejected PC remains absent; no warning/error logs',
        'browser_mobile':'390x640 CSS-pixel iframe reviewed',
        'comparison_page':'asset selection and GLB/Blender links verified',
        'visual_review':'Front and rear renders inspected; accepted with documented small-detail limitations'},
    'x1c_print_bed':read(OUT/'reports/14_bambu_x1c.json')['changes']['print_bed_contact_check'],
    'build_warnings':['Existing vscode-languageserver-types dynamic require warning','Webpack persistent cache snapshot warning','Docusaurus update-check configuration access warning'],
    'review_page':'assets/tripo/blender-repair/review.html',
    'screenshot':'assets/tripo/blender-repair/renders/garage-desktop.png'})
write(ROOT/'assets/tripo/BLENDER_REPAIR_REPORT.json',summary)
equipment=read(ROOT/'assets/tripo/INTERIOR_EQUIPMENT.json')
equipment['blender_repair_summary']['report']='assets/tripo/BLENDER_REPAIR_REPORT.json'
equipment['screenshots']['blender_desktop']='assets/tripo/blender-repair/renders/garage-desktop.png'
equipment['validation']['blender_repairs']=summary['checks']
write(ROOT/'assets/tripo/INTERIOR_EQUIPMENT.json',equipment)
destination=ROOT/'assets/tripo/blender-repair-delivery.zip'
with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for folder in ['models','blend','renders','reports']:
        for path in sorted((OUT/folder).glob('*')):
            if path.is_file():archive.write(path,'blender-repair/'+path.relative_to(OUT).as_posix())
    for name in ['review.html','DELIVERY.txt','validation.json','native-project-validation.json']:
        archive.write(OUT/name,'blender-repair/'+name)
    archive.write(ROOT/'assets/tripo/BLENDER_REPAIR_REPORT.json','blender-repair/BLENDER_REPAIR_REPORT.json')
with zipfile.ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert len([n for n in archive.namelist() if n.endswith('.blend')])==9
    assert len([n for n in archive.namelist() if n.endswith('.glb')])==9
print(json.dumps({'zip':str(destination),'size_mib':round(destination.stat().st_size/1024**2,1),'crc':'passed','models':9,'blend_projects':9}))
