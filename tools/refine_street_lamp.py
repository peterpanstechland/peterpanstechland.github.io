"""Reorient the real Tripo lamp head and dress its shelf in Blender. No API calls."""
import bpy, bmesh, math, json, hashlib, shutil, sys
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from optimize_garage_blender import display_fit
from repair_workshop_blender import activate, material, block, native
OUT=ROOT/'assets/tripo/street-detail'
OUT.mkdir(parents=True,exist_ok=True)
source=OUT/'08_street_lamp-before.glb'
if not source.exists(): shutil.copy2(ROOT/'static/maker-garage-preview/models/08_street_lamp.glb',source)
config=json.loads((ROOT/'static/maker-garage-preview/assets.json').read_text(encoding='utf-8'))
item=next(a for a in config['assets'] if a['id']=='08_street_lamp')
# The snapshot uses the earlier, unnormalized source coordinate frame.
original_item={**item,'normalized':False,'rotationY':-math.pi/2,'targetHeight':2.8}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
fit=display_fit(original_item,meshes)
for o in list(bpy.context.scene.objects):
    if o.parent is None:o.matrix_world=fit@o.matrix_world
bpy.context.view_layer.update()
for o in meshes:
    m=o.matrix_world.copy();o.parent=None;o.matrix_world=m
    activate(o);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
obj=next(o for o in meshes if o.name.startswith('tripo_node'))
pivot=native((.36,2.23,.015))
bm=bmesh.new();bm.from_mesh(obj.data)
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=pivot,plane_no=(0,0,1))
head=[v for v in bm.verts if v.co.z>=2.23-.000001]
head_angle_degrees=90
rot=Matrix.Rotation(math.radians(head_angle_degrees),3,'Z')
for v in head:v.co=pivot+rot@(v.co-pivot)
# Preserve winding on the source's disconnected textured panels. A global
# outside-normal recalculation can flip these open sheets and cull their fronts.
bm.normal_update()
bm.to_mesh(obj.data);bm.free();obj.data.update()
obj['head_rotation_degrees']=head_angle_degrees
obj['source_task_id']=item['taskId']
obj['repair_tool']='Blender '+bpy.app.version_string
steel=material('LOCAL_planter_dark_metal',(.025,.035,.055),.65,.4)
gold=material('LOCAL_planter_copper',(.33,.16,.045),.72,.33)
leafmat=material('LOCAL_circuit_leaf_teal',(.025,.24,.19),.55,.38)
cyan=material('LOCAL_planter_cyan_LED',(.02,.44,.55),.25,.3)
bsdf=cyan.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Emission Color'].default_value=(.025,.8,1,1)
bsdf.inputs['Emission Strength'].default_value=2.5
def authored(o):
    o['locallyAuthored']=True;o['provenance']='Blender-authored street shelf electronic plant; not Tripo generation'
    return o
def cylinder(name,x,y,z,radius,depth,mat,vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=native((x,y,z)))
    o=authored(bpy.context.object);o.name='LOCAL_'+name;o.data.materials.append(mat)
    mod=o.modifiers.new('Small edge bevel','BEVEL');mod.width=.004;mod.segments=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def rod(name,a,b,r,mat):
    a=native(a);b=native(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=authored(bpy.context.object);o.name='LOCAL_'+name
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(mat)
    return o
# The original upper collar covers the seam; this sleeve keeps the joint closed.
cylinder('lamp_swivel_collar',.36,2.23,.015,.125,.065,steel)
x,z=-.31,-.52
authored(block('planter_mount_plate',(x,1.30,z),(.29,.04,.29),steel,.012))
cylinder('electronic_planter',x,1.40,z,.125,.16,steel,8)
cylinder('planter_upper_rim',x,1.483,z,.131,.022,gold)
cylinder('planter_LED_ring',x,1.375,z,.128,.012,cyan)
cylinder('planter_substrate',x,1.496,z,.115,.008,steel)
rod('plant_main_stem',(x,1.50,z),(x,1.69,z),.018,gold)
for i in range(7):
    angle=i*math.tau/7
    radial=.11 if i%2 else .09
    tip=(x+radial*math.cos(angle),1.72+(i%3)*.045,z+radial*math.sin(angle))
    base=(x,1.57+(i%2)*.035,z)
    rod('plant_circuit_branch',base,tip,.007,gold)
    a=native(base);b=native(tip);center=a.lerp(b,.72)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=1,location=center)
    o=authored(bpy.context.object);o.name='LOCAL_circuit_leaf'
    o.scale=(.044,.012,.098);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    o.data.materials.append(leafmat)
    for p in o.data.polygons:p.use_smooth=True
    # Emissive circuit stripe, standing just clear of the leaf face.
    offset=o.rotation_euler.to_matrix()@Vector((0,.014,0))
    u=center+(b-a).normalized()*.06+offset;v=center-(b-a).normalized()*.045+offset
    rod('leaf_LED_trace',(u.x,u.z,-u.y),(v.x,v.z,-v.y),.003,cyan)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=.012,location=b)
    bulb=authored(bpy.context.object);bulb.name='LOCAL_leaf_LED_tip';bulb.data.materials.append(cyan)
# Small bracket keeps the planter attached to the inspected original shelf.
for dx in [-.10,.10]: cylinder('planter_mount_bolt',x+dx,1.325,z+.10,.012,.012,gold,8)
for o in list(bpy.context.scene.objects):
    if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='SELECT')
output=OUT/'08_street_lamp.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_extras=True,export_apply=True,export_animations=False)
bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'08_street_lamp.blend'))
fixture=pivot+rot@(native((-.36,2.57,.37))-pivot)
record={'source_task_id':item['taskId'],'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'head_rotation_degrees':head_angle_degrees,'head_pivot_local_xyz':[.36,2.23,.015],'fixture_local_xyz':[fixture.x,fixture.z,-fixture.y],'planter_support_local_xyz':[x,1.30,z],'coordinate_frame':'Scene-ready meters, Y up; normalized placement','local_additions':'Swivel collar, mechanically mounted electronic planter, copper branches, circuit leaves and cyan LEDs','credits_spent':0}
(OUT/'record.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('STREET_DETAIL_DONE',flush=True)
