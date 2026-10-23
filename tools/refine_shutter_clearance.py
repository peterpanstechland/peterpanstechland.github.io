"""Move the shell's native doorway planter inward, preserving faces and UVs."""
import bpy, hashlib, json, shutil, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from optimize_garage_blender import display_fit
OUT=ROOT/'assets/tripo/shutter-clearance'
OUT.mkdir(exist_ok=True)
config_path=ROOT/'static/maker-garage-preview/assets.json'
config=json.loads(config_path.read_text(encoding='utf-8'))
item=next(a for a in config['assets'] if a['id']=='01_garage_shell')
active=ROOT/'static/maker-garage-preview'/item['file']
source=OUT/'01_garage_shell-before.glb'
if not source.exists():shutil.copy2(active,source)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
fit=display_fit(item,meshes)
report={'method':'Translate native planter and adjacent small stem 0.28 m into the garage. No faces or UVs replaced.','sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'meshes':[]}
for o in meshes:
    matrix=fit@o.matrix_world;inverse=matrix.inverted()
    faces=[tuple(p.vertices) for p in o.data.polygons]
    uv=[[tuple(v.uv) for v in layer.data] for layer in o.data.uv_layers]
    moved=[]
    for v in o.data.vertices:
        p=matrix@v.co
        # Measured native planter/stray stem bounds. Adjacent jamb, cone,
        # exterior plants and the complete garage envelope stay untouched.
        if -1.35<p.x<-.65 and -1.32<p.y<-.70 and .16<p.z<.95:
            before=tuple(p);p.y+=.28;v.co=inverse@p
            moved.append({'index':v.index,'before':before,'after':tuple(p)})
    o.data.update()
    assert faces==[tuple(p.vertices) for p in o.data.polygons]
    assert uv==[[tuple(v.uv) for v in layer.data] for layer in o.data.uv_layers]
    report['meshes'].append({'name':o.name,'movedVertices':moved,'UVUnchanged':True,'topologyUnchanged':True})
    o['doorway_clearance_repair']='Native planter shifted inward 0.28 m; original topology and UVs retained'
assert sum(len(m['movedVertices']) for m in report['meshes'])>20
output=OUT/'01_garage_shell.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_extras=True,export_animations=False)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'01_garage_shell.blend'))
digest=hashlib.sha256(output.read_bytes()).hexdigest();report['outputSHA256']=digest
(OUT/'repair.json').write_text(json.dumps(report,indent=2)+'\n')
active=active.with_name('01_garage_shell-clearance.glb')
shutil.copy2(output,active)
item['file']='models/'+active.name
item['modelRevision']=digest[:12]
item['postprocess']='blender-surface-refinement-and-shutter-clearance-v1'
item['description']['zh']='保留原网格、UV、贴图与局部校平；门口原生花盆及小枝条向车库内移动 0.28 米，避开卷帘门。'
item['description']['en']='Original mesh, UVs, textures and conservative surface refinement retained. Native doorway planter and small stem moved 0.28 m inward to clear the shutter.'
config_path.write_text(json.dumps(config,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('CLEARANCE_REPAIRED',sum(len(m['movedVertices']) for m in report['meshes']),digest)
