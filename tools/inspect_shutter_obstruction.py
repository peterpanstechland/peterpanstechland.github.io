import bpy, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from optimize_garage_blender import display_fit
bpy.ops.wm.read_factory_settings(use_empty=True)
item=json.loads((ROOT/'static/maker-garage-preview/assets.json').read_text())['assets'][0]
bpy.ops.import_scene.gltf(filepath=str(ROOT/'static/maker-garage-preview'/item['file']))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
fit=display_fit(item,meshes)
report=[]
for o in meshes:
    coords=[fit@o.matrix_world@v.co for v in o.data.vertices]
    # Weld UV seams only for identifying connected islands; leave mesh untouched.
    roots=list(range(len(coords)))
    def find(i):
        while roots[i]!=i:
            roots[i]=roots[roots[i]];i=roots[i]
        return i
    def union(a,b):roots[find(a)]=find(b)
    keys={}
    for i,p in enumerate(coords):
        k=tuple(round(c,4) for c in p)
        if k in keys:union(i,keys[k])
        else:keys[k]=i
    for e in o.data.edges:union(*e.vertices)
    groups={}
    for i in range(len(coords)):groups.setdefault(find(i),[]).append(i)
    for ids in groups.values():
        lo=[min(coords[i][j] for i in ids) for j in range(3)]
        hi=[max(coords[i][j] for i in ids) for j in range(3)]
        if hi[0]>-1.8 and lo[0]<-.7 and lo[1]<-1 and lo[2]<1.2:
            report.append({'mesh':o.name,'count':len(ids),'low':lo,'high':hi,'seed':ids[0]})
out=ROOT/'assets/tripo/shutter-clearance';out.mkdir(exist_ok=True)
(out/'islands.json').write_text(json.dumps(report,indent=2))
print('ISLANDS',json.dumps(report))
from mathutils import Vector
for o in meshes:
    m=fit@o.matrix_world;o.parent=None;o.matrix_world=m
if '--cutaway' in sys.argv:
    import bmesh
    for o in meshes:
        bm=bmesh.new();bm.from_mesh(o.data)
        outside=[v for v in bm.verts if not (-1.32<(o.matrix_world@v.co).x<-.65 and .16<(o.matrix_world@v.co).z<.9)]
        bmesh.ops.delete(bm,geom=outside,context='VERTS');bm.to_mesh(o.data);bm.free()
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Inspection world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.35,.35,.35,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
bpy.ops.object.light_add(type='AREA',location=(-2,-4,3));bpy.context.object.data.energy=350;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=1.4
for name,loc,target in [('front',(-1.25,-6,.55),(-1.25,-1,.55)),('side',(3,-1.2,.55),(-1.25,-1.2,.55))]:
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(name+('-cutaway' if '--cutaway' in sys.argv else '-before')+'.png'));bpy.ops.render.render(write_still=True)
