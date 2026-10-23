"""Non-destructive Blender repair of the older garage assets; original files kept.

Work in the scene's display scale, export back to the original coordinate frame.
Rigged cat and articulated shutter retain their hierarchy, pivots and animation.
"""
import bpy
import bmesh
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from repair_workshop_blender import activate, block, material, mesh_stats, clean, studio, camera, render, native, web, cut_below, remove_box

OUT=ROOT/'assets/tripo/blender-garage'
CONFIG=json.loads((ROOT/'static/maker-garage-preview/assets.json').read_text(encoding='utf-8'))
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
AUDIT='--audit' in ARGS
SELECT=[a for a in ARGS if not a.startswith('--')]


def evaluated_points(objects):
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get();points=[]
    for o in objects:
        evaluated=o.evaluated_get(deps);mesh=evaluated.to_mesh()
        points.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
        evaluated.to_mesh_clear()
    return points


def bounds(objects):
    points=evaluated_points(objects)
    return Vector([min(p[i] for p in points) for i in range(3)]),Vector([max(p[i] for p in points) for i in range(3)])


def display_fit(item,meshes):
    angle=item.get('rotationY',0 if item.get('normalized') else -math.pi/2)
    if item['id']=='06_showcase_zone':angle=0
    rotate=Matrix.Rotation(angle,4,'Z')
    points=[rotate@p for p in evaluated_points(meshes)]
    low=Vector([min(p[i] for p in points) for i in range(3)]);high=Vector([max(p[i] for p in points) for i in range(3)])
    size=high-low
    if item.get('normalized'):
        scale=Vector((item.get('uniformScale',1),)*3)
    elif item.get('targetSize'):
        scale=Vector([item['targetSize'][i]/size[j] for i,j in [(0,0),(2,1),(1,2)]])
    else:
        s=item['targetHeight']/size.z if item.get('targetHeight') else item.get('targetWidth',size.x)/size.x
        scale=Vector((s,s,s))
    center=(low+high)/2;center.z=low.z
    return Matrix.Diagonal((*scale,1))@Matrix.Translation(-center)@rotate


def snapshot(objects,collection):
    clones=[]
    for obj in objects:
        clone=obj.copy();clone.data=obj.data.copy();clone.name='BEFORE_'+obj.name
        # Preserve the source's exact normal-strength settings for comparison.
        for i,mat in enumerate(clone.data.materials):
            if mat:clone.data.materials[i]=mat.copy()
        clone.parent=None;clone.matrix_world=obj.matrix_world.copy()
        collection.objects.link(clone);clone.hide_render=True
        clones.append(clone)
    return clones


def repair_static(asset,meshes,size):
    changes={'cleanup':{},'notes':[]}
    for o in meshes:
        changes['cleanup'][o.name]=clean(o)
    obj=meshes[0]
    def top_plane(low,high,target,xy=None):
        count=0
        for v in obj.data.vertices:
            if low<v.co.z<high and v.normal.z>.65 and (xy is None or (abs(v.co.x)<xy[0] and abs(v.co.y)<xy[1])):
                v.co.z=target;count+=1
        obj.data.update()
        changes.setdefault('flattened_panels',[]).append({'height':target,'vertices':count})
    if asset=='01_garage_shell':
        top_plane(2.77,2.96,2.85,(1.8,1.30))
        # Remove hanging interior shards without touching exterior wall fittings.
        remove_box(obj,(-1.98,1.62,-1.48),(1.98,2.77,1.18))
        ceiling=material('LOCAL_garage_ceiling_steel',(.035,.028,.04),.25,.8)
        block('garage_interior_ceiling',(0,2.22,-.14),(4.05,.05,2.72),ceiling,.006)
        lining=material('LOCAL_garage_inner_wall_steel',(.048,.036,.045),.22,.83)
        block('garage_inner_back_wall',(0,1.235,-1.43),(3.98,1.99,.035),lining,.004)
        for x in [-1.98,1.98]:
            block('garage_inner_side_wall',(x,1.235,-.14),(.035,1.99,2.60),lining,.004)
        # Source floor folds intersected the road, producing holes and z-fighting.
        bm=bmesh.new();bm.from_mesh(obj.data)
        faces=[f for f in bm.faces if .04<f.calc_center_median().z<.40 and abs(f.calc_center_median().x)<1.79 and -1.40 < -f.calc_center_median().y < .84 and f.normal.z>.35]
        bmesh.ops.delete(bm,geom=faces,context='FACES');bm.to_mesh(obj.data);bm.free();obj.data.update()
        floor=material('LOCAL_garage_floor_concrete',(.07,.052,.043),0,.92)
        block('garage_interior_floor',(0,.215,-.15),(4.05,.07,2.65),floor,.006)
        # Separate the real roof faces; neither a new roof nor a merged scene.
        activate(obj);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='DESELECT');bpy.ops.object.mode_set(mode='OBJECT')
        for face in obj.data.polygons:
            face.select=face.center.z>2.72 and face.normal.z>.45
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
        obj.name='GARAGE_FRAME'
        for piece in bpy.context.selected_objects:
            if piece!=obj:piece.name='ROOF_MAIN'
        changes['notes'].append('Flattened the rippled central roof while preserving perimeter rails and exterior fittings. Separated real roof faces as ROOF_MAIN. Removed hanging interior shards and patched the broken ceiling/floor with solid steel and concrete inserts.')
    elif asset=='03_profile_sign':
        changes['notes'].append('Cleaned circular frame seams and reduced noisy metal highlights; original neon segments and empty portrait area retained.')
    elif asset=='05_project_vending':
        top_plane(size[1]-.045,size[1]-.006,size[1]-.015,(size[0]*.43,size[2]*.42))
        changes['notes'].append('Flattened the cabinet roof and repaired hard-surface shading; original display compartments, controls and pickup opening retained.')
    elif asset=='06_showcase_zone':
        metal=material('LOCAL_showcase_shelf_steel',(.045,.032,.052),.35,.65)
        for h in [.455,.905,1.31]:
            bm=bmesh.new();bm.from_mesh(obj.data)
            faces=[f for f in bm.faces if abs(f.calc_center_median().z-h)<.025 and abs(f.normal.z)>.45 and abs(f.calc_center_median().x)<.83]
            bmesh.ops.delete(bm,geom=faces,context='FACES');bm.to_mesh(obj.data);bm.free();obj.data.update()
            block('showcase_solid_shelf',(0,h-.006,0),(1.66,.012,.407),metal,.002)
        changes['notes'].append('Replaced torn horizontal shelf surfaces with three solid steel inserts. Original vertical partitions, lower doors, trim and empty project slots retained.')
    elif asset=='08_street_lamp':
        steel=material('LOCAL_lamp_bracket_steel',(.06,.038,.025),.5,.65)
        for height in [.62,1.17]:
            beam=block('lamp_control_box_bracket',(.03,height,-.26),(.88,.065,.065),steel,.006)
            beam.rotation_euler.z=math.atan2(.52,-.62)
        changes['notes'].append('Cleaned pole/head topology and smoothed metallic shading. Added two steel brackets between the floating control box and the pole; original head and weathered fittings retained.')
    elif asset=='09_trash_bin':
        cut_below(obj,.075)
        for lo,hi in [((.285,.075,-.5),(.5,.35,.5)),((-.5,.075,-.5),(-.285,.35,.5)),((-.5,.075,.285),(.5,.35,.5)),((-.5,.075,-.5),(.5,.35,-.285))]:
            remove_box(obj,lo,hi)
        base=material('LOCAL_bin_base_steel',(.075,.055,.045),.45,.72)
        block('bin_closed_bottom',(0,.04,0),(.57,.08,.55),base,.008)
        remove_box(obj,(-.24,.10,-.5),(.24,.76,-.16))
        rear=material('LOCAL_bin_rear_panel',(.025,.047,.06),.35,.72)
        block('bin_rear_panel',(0,.455,-.255),(.48,.81,.025),rear,.004)
        changes['notes'].append('Removed torn ground scraps, bottom spikes and the broken rear flap; rebuilt a level bottom and solid rear panel. Rusty blue front, lid and handles retained.')
    elif asset=='10_utility_cabinet':
        top_plane(size[1]-.035,size[1]+.001,size[1]-.008,(size[0]*.43,size[2]*.43))
        changes['notes'].append('Flattened the broad cabinet top and repaired side-panel shading; hinges, vents, handles and weathered marks retained.')
    elif asset in ['11_tree','12_plants_grass']:
        changes['notes'].append('Removed redundant coincident/degenerate geometry and stabilized base contact. Preserved leaf silhouettes, plant separation and source color; no blanket leaf decimation or smoothing.')
        for v in obj.data.vertices:
            if v.co.z<.003:v.co.z=0
    elif asset=='13_street_base':
        changes.update(rebuild_street(obj,size));meshes[:]=[]
    for o in [o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.startswith('LOCAL_')]:
        if asset not in ['11_tree','12_plants_grass']:
            activate(o);bpy.ops.object.shade_auto_smooth(angle=math.radians(78))
            for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
            mod=o.modifiers.new('Weighted hard-surface normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=30
            bpy.ops.object.modifier_apply(modifier=mod.name)
        for mat in o.data.materials:
            if mat and mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.65 if asset in ['11_tree','12_plants_grass'] else .4
    changes['local_parts']=[o.name for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('LOCAL_')]
    changes['notes'].append('Retained source UV/color detail on surviving geometry; used Blender for topology cleanup and shading correction. Original downloads remain untouched.')
    return changes


def rebuild_street(source,size):
    """Bake original road color onto a real closed foundation, not a thin sheet."""
    w,h,d=size
    asphalt=material('LOCAL_road_edge_concrete',(.025,.019,.016),0,.94)
    fallback=block('BAKE_ONLY_background',(0,-.018,0),(w*1.05,.012,d*1.05),asphalt,0)
    mesh=bpy.data.meshes.new('road_bake_receiver')
    coords=[(-w/2,-d/2,h+.002),(w/2,-d/2,h+.002),(w/2,d/2,h+.002),(-w/2,d/2,h+.002)]
    mesh.from_pydata(coords,[],[(0,1,2,3)]);mesh.update()
    receiver=bpy.data.objects.new('BAKE_ONLY_receiver',mesh);bpy.context.scene.collection.objects.link(receiver)
    uv=mesh.uv_layers.new(name='UVMap')
    for loop in mesh.loops:
        p=mesh.vertices[loop.vertex_index].co;uv.data[loop.index].uv=((p.x+w/2)/w,(-p.y+d/2)/d)
    baked=material('TRIPO_road_color_rebaked_in_Blender',(.1,.07,.06),.05,.82)
    image=bpy.data.images.new('ROAD_SOURCE_COLOR_BAKE',width=2048,height=2048,alpha=False)
    image.colorspace_settings.name='sRGB'
    tex=baked.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;baked.node_tree.nodes.active=tex
    mesh.materials.append(baked)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
    scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
    activate(receiver);source.select_set(True);fallback.select_set(True)
    bpy.ops.object.bake(type='DIFFUSE',use_selected_to_active=True,cage_extrusion=.65,max_ray_distance=1.3,margin=8)
    image.pack()
    normal_image=bpy.data.images.new('ROAD_SOURCE_NORMAL_BAKE',width=2048,height=2048,alpha=False)
    normal_image.colorspace_settings.name='Non-Color'
    normal_tex=baked.node_tree.nodes.new('ShaderNodeTexImage');normal_tex.image=normal_image;baked.node_tree.nodes.active=normal_tex
    bpy.ops.object.bake(type='NORMAL',use_selected_to_active=True,cage_extrusion=.65,max_ray_distance=1.3,margin=8)
    normal_image.pack()
    normal=baked.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.35
    baked.node_tree.links.new(normal_tex.outputs['Color'],normal.inputs['Color'])
    baked.node_tree.links.new(normal.outputs['Normal'],baked.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
    baked.node_tree.links.new(tex.outputs['Color'],baked.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    bpy.data.objects.remove(receiver,do_unlink=True);bpy.data.objects.remove(fallback,do_unlink=True);bpy.data.objects.remove(source,do_unlink=True)
    slab=block('STREET_SOLID_FOUNDATION',(0,h/2,0),(w,h,d),asphalt,.025)
    slab.data.materials.append(baked)
    uv=slab.data.uv_layers.active or slab.data.uv_layers.new(name='UVMap')
    for face in slab.data.polygons:
        face.material_index=1 if face.normal.z>.7 else 0
        for li in face.loop_indices:
            p=slab.matrix_world@slab.data.vertices[slab.data.loops[li].vertex_index].co
            uv.data[li].uv=((p.x+w/2)/w,(-p.y+d/2)/d)
    return {'notes':['Rebuilt the torn paper-thin street as a closed beveled foundation. Original Tripo road color was baked in Blender onto the new top; new side walls use local concrete material.'],
        'texture_bake':{'source':'original Tripo base-color and surface normals','resolution':[2048,2048],'method':'Cycles selected-to-active diffuse color and tangent normals, normal strength 0.35'},
        'solid_street':True}


def preserve_animated(item,source,objects,meshes,roots,originals,fit,size,audit):
    asset=item['id'];rig=asset=='04_lucky_cat'
    changes={'notes':[],'cleanup':{}}
    for o in meshes:
        if rig:
            # Topology, vertex groups and skin weights remain unchanged.
            activate(o);bpy.ops.object.shade_smooth()
        else:
            changes['cleanup'][o.name]=clean(o)
    for mat in {m for o in meshes for m in o.data.materials if m}:
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.7 if rig else .55
    changes['notes'].append('Smoothed skin shading and reduced excessive normal-map relief; no remeshing or weight changes.' if rig else 'Cleaned each of the 26 door slats independently; preserved names, individual pivots, roll metadata and continuous graffiti UVs.')
    saved={o.name:o.matrix_world.copy() for o in roots}
    for o in roots:o.matrix_world=originals[o.name]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    output=OUT/'models'/source.name
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_extras=True,
        export_apply=False,export_animations=rig,export_force_sampling=True)
    for o in roots:o.matrix_world=saved[o.name]
    studio(size);render(OUT/'renders'/f'{asset}-after.png');camera(size,True);render(OUT/'renders'/f'{asset}-back.png');camera(size,False)
    if rig:
        original_frame=bpy.context.scene.frame_current
        for frame in [16,32,48]:
            bpy.context.scene.frame_set(frame);render(OUT/'renders'/f'{asset}-motion-{frame}.png')
        bpy.context.scene.frame_set(original_frame)
    bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'blend'/f'{asset}.blend'))
    record={**audit,'source_task_id':item['taskId'],'changes':changes,'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'output_glb':str(output.relative_to(ROOT)).replace('\\','/'),'credits_spent':0,'visual_acceptance':'pending',
        'animation_compatibility':'pending exported-GLB checks'}
    (OUT/'reports'/f'{asset}.json').write_text(json.dumps(record,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print('DYNAMIC_REPAIR_DONE',asset,flush=True)


def main():
    for name in ['before','models','blend','renders','reports']:(OUT/name).mkdir(parents=True,exist_ok=True)
    for item in CONFIG['assets']:
        asset=item['id']
        if int(asset[:2])>=14 or not item.get('file') or (SELECT and asset not in SELECT):continue
        source=OUT/'before'/Path(item['file']).name
        if not source.exists():shutil.copy2(ROOT/'static/maker-garage-preview'/item['file'],source)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source))
        # glTF importer creates hidden custom bone-shape meshes. They are not assets.
        bone_shapes={b.custom_shape for o in bpy.context.scene.objects if o.type=='ARMATURE' for b in o.pose.bones if b.custom_shape}
        objects=[o for o in bpy.context.scene.objects if o not in bone_shapes]
        meshes=[o for o in objects if o.type=='MESH']
        rig=any(o.type=='ARMATURE' for o in objects)
        articulated=asset=='02_roller_shutter'
        fit=display_fit(item,meshes)
        roots=[o for o in objects if o.parent is None]
        originals={o.name:o.matrix_world.copy() for o in roots}
        for o in roots:o.matrix_world=fit@o.matrix_world
        bpy.context.view_layer.update()
        low,high=bounds(meshes);size_native=high-low;size=[size_native.x,size_native.z,size_native.y]
        audit={'asset_id':asset,'display_size_m_xyz':size,'working_bounds_native':[list(low),list(high)],
            'original_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'rig':rig,'articulated':articulated,
            'meshes':{o.name:mesh_stats(o) for o in meshes}}
        levels={}
        for o in meshes:
            for face in o.data.polygons:
                normal=o.matrix_world.to_3x3().inverted().transposed()@face.normal
                if normal.normalized().z>.6:
                    height=(o.matrix_world@face.center).z
                    key=round(height/.025)*.025
                    levels[key]=levels.get(key,0)+face.area
        audit['upward_surface_levels']=sorted(levels.items(),key=lambda x:-x[1])[:15]
        (OUT/'reports'/f'{asset}.audit.json').write_text(json.dumps(audit,indent=2)+'\n')
        if AUDIT:
            studio(size);render(OUT/'renders'/f'{asset}-before.png');camera(size,True);render(OUT/'renders'/f'{asset}-before-back.png')
            print('AUDIT_DONE',asset,flush=True);continue
        if rig or articulated:
            preserve_animated(item,source,objects,meshes,roots,originals,fit,size,audit)
            continue
        for o in meshes:
            matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=matrix
            activate(o);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        for o in list(bpy.context.scene.objects):
            if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
        collection=bpy.data.collections.new('BEFORE_original_display_mesh');bpy.context.scene.collection.children.link(collection)
        before=snapshot(meshes,collection)
        for o in before:collection.objects.unlink(o)
        changes=repair_static(asset,meshes,size)
        repaired=[o for o in bpy.context.scene.objects if o.type=='MESH']
        bpy.ops.object.select_all(action='DESELECT')
        saved={o.name:o.matrix_world.copy() for o in repaired}
        for o in repaired:
            o['source_task_id']=item['taskId'];o['repair_tool']='Blender '+bpy.app.version_string
            o.matrix_world=fit.inverted()@o.matrix_world;o.select_set(True)
        output=OUT/'models'/source.name
        bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_extras=True,export_apply=True,export_animations=False)
        for o in repaired:o.matrix_world=saved[o.name]
        for o in before:collection.objects.link(o)
        studio(size);render(OUT/'renders'/f'{asset}-after.png');camera(size,True);render(OUT/'renders'/f'{asset}-back.png');camera(size,False)
        collection.hide_viewport=True
        bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'blend'/f'{asset}.blend'))
        record={**audit,'source_task_id':item['taskId'],'changes':changes,'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
            'output_glb':str(output.relative_to(ROOT)).replace('\\','/'),'credits_spent':0,'visual_acceptance':'pending'}
        (OUT/'reports'/f'{asset}.json').write_text(json.dumps(record,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        print('REPAIR_DONE',asset,flush=True)


if __name__=='__main__':main()
