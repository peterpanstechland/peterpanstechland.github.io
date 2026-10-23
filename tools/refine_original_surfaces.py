"""Conservative Blender vertex edits; retain original faces, UVs and textures."""
import bpy, hashlib, json, statistics, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from optimize_garage_blender import display_fit, bounds
from repair_workshop_blender import activate, studio, camera, render
OUT=ROOT/'assets/tripo/surface-refinement'
for folder in ['models','blend','renders','reports']:(OUT/folder).mkdir(parents=True,exist_ok=True)
CONFIG=json.loads((ROOT/'static/maker-garage-preview/assets.json').read_text(encoding='utf-8'))
def uv_digest(mesh):
    return hashlib.sha256(str([[tuple(d.uv) for d in layer.data] for layer in mesh.uv_layers]).encode()).hexdigest()
for asset in ['01_garage_shell','05_project_vending']:
    item=next(a for a in CONFIG['assets'] if a['id']==asset)
    source=ROOT/'assets/tripo/blender-garage/before'/Path(item['file']).name
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    fit=display_fit(item,meshes)
    for o in list(bpy.context.scene.objects):
        if o.parent is None:o.matrix_world=fit@o.matrix_world
    bpy.context.view_layer.update()
    for o in meshes:
        m=o.matrix_world.copy();o.parent=None;o.matrix_world=m
        activate(o);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
    low,high=bounds(meshes);s=high-low;size=[s.x,s.z,s.y]
    report={'asset_id':asset,'source_task_id':item['taskId'],'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'method':'Original vertex positions only; no covering boards, no replacement faces, no UV or texture edits','meshes':[],'credits_spent':0}
    for o in meshes:
        mesh=o.data;original=[v.co.copy() for v in mesh.vertices];uv=uv_digest(mesh)
        faces=[tuple(f.vertices) for f in mesh.polygons]
        edits=[]
        def plane(label,axis,target,mask,limit,blend=1):
            count=0;maximum=0
            for v in mesh.vertices:
                if not mask(v):continue
                delta=max(-limit,min(limit,(target-v.co[axis])*blend))
                if abs(delta)<1e-7:continue
                v.co[axis]+=delta;count+=1;maximum=max(maximum,abs(delta))
            edits.append({'region':label,'vertices':count,'maximumShiftMeters':maximum})
        if asset=='01_garage_shell':
            plane('original central roof',2,2.85,lambda v:2.76<v.co.z<2.96 and abs(v.co.x)<1.80 and abs(v.co.y)<1.30 and v.normal.z>.6,.055,.9)
            plane('original interior floor',2,.225,lambda v:.12<v.co.z<.34 and abs(v.co.x)<1.78 and -1.04<v.co.y<1.30 and v.normal.z>.6,.035,.85)
            for sign in [-1,1]:
                mask=lambda v:1.93<sign*v.co.x<2.16 and .42<v.co.z<2.50 and abs(v.co.y)<1.30 and abs(v.normal.x)>.82
                values=[v.co.x for v in mesh.vertices if mask(v)]
                if values:plane('original side wall '+str(sign),0,statistics.median(values),mask,.015,.65)
        else:
            plane('original cabinet roof',2,size[1]-.025,lambda v:size[1]-.065<v.co.z<size[1]-.008 and abs(v.co.x)<size[0]*.43 and abs(v.co.y)<size[2]*.43 and v.normal.z>.65,.018,.85)
            for sign in [-1,1]:
                mask=lambda v:sign*v.co.x>size[0]*.43 and .14<v.co.z<size[1]-.14 and abs(v.co.y)<size[2]*.38 and abs(v.normal.x)>.8
                values=[v.co.x for v in mesh.vertices if mask(v)]
                if values:plane('original cabinet side '+str(sign),0,statistics.median(values),mask,.012,.75)
        mesh.update()
        assert uv_digest(mesh)==uv
        assert faces==[tuple(f.vertices) for f in mesh.polygons]
        moved=[(v.co-original[i]).length for i,v in enumerate(mesh.vertices)]
        report['meshes'].append({'name':o.name,'vertices':len(mesh.vertices),'faces':len(mesh.polygons),'UV_unchanged':True,'face_indices_unchanged':True,'moved_vertices':sum(d>1e-7 for d in moved),'maximum_displacement_m':max(moved),'edits':edits})
        o['source_task_id']=item['taskId'];o['repair_tool']='Blender '+bpy.app.version_string
        o['repair_method']='Conservative original-vertex flattening; original UVs, faces and textures retained'
    bpy.ops.object.select_all(action='DESELECT')
    saved={o.name:o.matrix_world.copy() for o in meshes}
    for o in meshes:o.matrix_world=fit.inverted()@o.matrix_world;o.select_set(True)
    output=OUT/'models'/source.name
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_extras=True,export_apply=True,export_animations=False)
    for o in meshes:o.matrix_world=saved[o.name]
    studio(size);render(OUT/'renders'/f'{asset}-front.png');camera(size,True);render(OUT/'renders'/f'{asset}-back.png')
    bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'blend'/f'{asset}.blend'))
    report['output_sha256']=hashlib.sha256(output.read_bytes()).hexdigest()
    (OUT/'reports'/f'{asset}.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print('SURFACE_REFINEMENT_DONE',asset,flush=True)
