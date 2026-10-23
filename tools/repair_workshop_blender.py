"""Blender 5.2: measured, reversible repairs to nine Tripo workshop assets.

Run with blender --background --factory-startup --python this_file -- [asset_id].
Inputs are snapshotted once. Raw Tripo downloads are never edited. New structural
parts are explicitly named LOCAL_; UVs on retained source faces are preserved.
This is display-mesh repair, not manufacturer CAD or an automated watertight pass.
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

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/tripo/blender-repair'
MANIFEST = json.loads((ROOT / 'assets/tripo/INTERIOR_EQUIPMENT.json').read_text(encoding='utf-8'))
FILTER = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []


def web(co):
    return Vector((co.x, co.z, -co.y))


def native(co):
    return Vector((co[0], -co[2], co[1]))


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def material(name, color, metallic=0, roughness=.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def block(name, center, size, mat, bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1, location=native(center))
    obj = bpy.context.object
    obj.name = 'LOCAL_' + name
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Manufactured edge radius', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # Flat main faces, smooth bevel strips, weighted split normals.
    for poly in obj.data.polygons:
        poly.use_smooth = True
    mod = obj.modifiers.new('Area weighted corner normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj['locallyAuthored'] = True
    obj['purpose'] = 'Replacement for malformed structural geometry'
    return obj


def mesh_stats(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    result = dict(vertices=len(bm.verts), faces=len(bm.faces),
                  boundary_edges=sum(e.is_boundary for e in bm.edges),
                  nonmanifold_edges=sum(not e.is_manifold for e in bm.edges),
                  degenerate_faces=sum(f.calc_area() < 1e-12 for f in bm.faces))
    bm.free()
    return result


def clean(obj):
    before = mesh_stats(obj)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000001)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=.0000001)
    # Close only accidental microscopic triangular holes; preserve vents,
    # cable loops and deliberately open machine structures.
    edges = [e for e in bm.edges if e.is_boundary and e.calc_length() < .00015]
    if edges:
        bmesh.ops.holes_fill(bm, edges=edges, sides=3)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return {'before': before, 'after': mesh_stats(obj)}


def plane(obj, axis, target, box, tolerance, normal_min=.55):
    """Flatten a specified panel, leaving controls, seams and bevels alone."""
    changed = 0
    worst = 0
    for v in obj.data.vertices:
        p = web(v.co)
        n = web(v.normal)
        if all(lo <= p[i] <= hi for i, (lo, hi) in enumerate(box)) and abs(n[axis]) >= normal_min and abs(p[axis]-target) <= tolerance:
            delta = abs(p[axis]-target)
            if delta > 1e-7:
                p[axis] = target
                v.co = native(p)
                changed += 1
                worst = max(worst, delta)
    obj.data.update()
    return {'axis_xyz':axis, 'plane_m':target, 'changed_vertices':changed, 'max_displacement_m':worst}


def cut_below(obj, height):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    result = bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
        dist=1e-7, plane_co=(0,0,height), plane_no=(0,0,1), clear_inner=True, clear_outer=False)
    cut_edges = [e for e in result['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
    if cut_edges:
        bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def remove_box(obj, low, high, preserve_chassis=False):
    """Cut out malformed geometry inside a measured replacement volume."""
    bm=bmesh.new();bm.from_mesh(obj.data)
    a=native(low);b=native(high)
    limits=[(min(a[i],b[i]),max(a[i],b[i])) for i in range(3)]
    for axis,(lo,hi) in enumerate(limits):
        normal=Vector((0,0,0));normal[axis]=1
        for value in [lo,hi]:
            point=Vector((0,0,0));point[axis]=value
            bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                dist=1e-7,plane_co=point,plane_no=normal)
    def keep_wall(face):
        p=web(face.calc_center_median());n=web(face.normal)
        return preserve_chassis and ((abs(p.x)>.145 and abs(n.y)<.45) or (abs(p.x)>.13 and abs(n.x)>.5) or (abs(p.x)>.12 and p.z>.16 and abs(n.y)<.45))
    faces=[f for f in bm.faces if all(lo-1e-7 <= f.calc_center_median()[i] <= hi+1e-7 for i,(lo,hi) in enumerate(limits)) and not keep_wall(f)]
    bmesh.ops.delete(bm,geom=faces,context='FACES')
    bm.to_mesh(obj.data);bm.free();obj.data.update()


def repair(asset, meshes):
    obj = meshes[0]
    changes = {'cleanup':{}, 'planar_patches':[], 'local_parts':[], 'notes':[]}
    for m in meshes:
        changes['cleanup'][m.name] = clean(m)
    def patch(axis, target, box, tolerance, normal_min=.55):
        changes['planar_patches'].append(plane(obj,axis,target,box,tolerance,normal_min))
    if asset == '14_bambu_x1c':
        # The thin double wall must not be flattened onto itself. Keep the
        # original wall spacing and repair its shading rather than collapsing it.
        remove_box(obj,(-.167,.145,-.152),(.167,.23,.204),preserve_chassis=True)
        pei=material('LOCAL_textured_PEI_build_plate',(.105,.092,.055),.55,.72)
        heater=material('LOCAL_aluminium_heated_bed',(.11,.13,.14),.75,.42)
        carrier=material('LOCAL_bed_carriage',(.033,.04,.044),.55,.46)
        block('X1C_flat_PEI_print_surface',(0,.18175,.015),(.286,.0035,.282),pei,.0007)
        block('X1C_heated_bed_substrate',(0,.175,.015),(.29,.010,.286),heater,.0015)
        block('X1C_bed_underframe',(0,.163,.006),(.252,.014,.268),carrier,.0015)
        # Rear carriage meets the retained rear mechanism; it is not a floating
        # decorative plate. Clearances to side/front walls remain positive.
        block('X1C_rear_bed_carriage',(0,.148,-.14),(.09,.064,.06),carrier,.0015)
        block('X1C_plate_front_tab',(0,.18175,.165),(.044,.0035,.02),pei,.0007)
        def part_bounds(name):
            part=bpy.data.objects['LOCAL_'+name]
            bpy.context.view_layer.update()
            points=[web(part.matrix_world@v.co) for v in part.data.vertices]
            return [Vector([min(p[i] for p in points) for i in range(3)]),Vector([max(p[i] for p in points) for i in range(3)])]
        plate_bounds=part_bounds('X1C_flat_PEI_print_surface')
        heater_bounds=part_bounds('X1C_heated_bed_substrate')
        frame_bounds=part_bounds('X1C_bed_underframe')
        carriage_bounds=part_bounds('X1C_rear_bed_carriage')
        gaps=[plate_bounds[0].y-heater_bounds[1].y,heater_bounds[0].y-frame_bounds[1].y]
        overlap=[min(frame_bounds[1][i],carriage_bounds[1][i])-max(frame_bounds[0][i],carriage_bounds[0][i]) for i in range(3)]
        assert all(abs(g)<1e-6 for g in gaps),gaps
        assert all(d>0 for d in overlap),overlap
        changes['print_bed_contact_check']={'layer_gaps_m':gaps,'carriage_overlap_m_xyz':overlap,'passed':True}
        changes['notes'].append('Preserved thin double-wall spacing and repaired panel shading. Removed the warped build platform and rebuilt a flat PEI sheet, heated substrate, underframe and rear support; original chassis, toolhead and screen retained.')
    elif asset == '15_makeblock_laserbox':
        patch(2,.259,[(-.435,.435),(.025,.195),(.242,.27)],.017)
        patch(2,-.259,[(-.435,.435),(.025,.195),(-.27,-.242)],.017)
        for side in [-1,1]:
            patch(0,side*.474,[(-.49,.49),(.025,.19),(-.21,.21)],.012)
        remove_box(obj,(-.28,.18,-.18),(.28,.30,.18))
        glass=material('LOCAL_smoked_inspection_lid',(.025,.043,.05),.3,.17)
        block('laserbox_flat_inspection_window',(0,.25,0),(.566,.008,.366),glass,.002)
        changes['notes'].append('Straightened outer side walls. Cut away the crumpled window geometry and installed a flat, solid smoked inspection insert; enclosure and lid frame retained.')
    elif asset == '16_openpnp_machine':
        patch(2,.294,[(-.32,.32),(.025,.085),(.278,.305)],.016)
        for side in [-1,1]:
            patch(0,side*.34,[(-.35,.35),(.13,.32),(-.19,.02)],.009)
        changes['notes'].append('Regularized base front and outer gantry supports; nozzle, feeders and PCB kept.')
    elif asset == '17_soldering_station':
        patch(1,.128,[(-.026,.048),(.121,.132),(-.033,.035)],.007)
        patch(0,-.036,[(-.04,-.03),(.025,.116),(-.03,.038)],.004)
        patch(0,.06,[(.055,.064),(.025,.116),(-.03,.038)],.004)
        changes['notes'].append('Flattened controller top and sides; iron, connector, knob and cable untouched.')
    elif asset == '18_hot_air_station':
        patch(0,-.089,[(-.098,-.08),(.115,.183),(-.07,-.015)],.009)
        patch(1,.066,[(-.078,.045),(.06,.071),(-.06,.075)],.006)
        changes['notes'].append('Flattened base deck and controller side; gun, holder and hose retained.')
    elif asset == '19_oscilloscope':
        patch(1,.133,[(-.135,.135),(.128,.138),(-.055,.035)],.005)
        changes['notes'].append('Flattened top housing and repaired shading; screen recess, rounded side walls, handle and front controls retained.')
    elif asset == '21_monitor':
        patch(2,.016,[(-.26,.26),(.127,.385),(.007,.022)],.01,.25)
        patch(1,0,[(-.15,.15),(-.001,.004),(-.09,.09)],.004,.4)
        changes['notes'].append('Flattened screen face and base contact plane; original stand and rear casing retained.')
    elif asset == '22_office_desk':
        cut_below(obj,.535)
        obj.name = 'TRIPO_RETAINED_WOOD_TOP_DRAWERS'
        patch(1,.72,[(-.625,.625),(.704,.721),(-.35,.35)],.016,.35)
        steel=material('LOCAL_powder_coated_graphite',(.048,.057,.062),.6,.39)
        rubber=material('LOCAL_rubber_feet',(.012,.016,.018),0,.85)
        for x in [-.585,.585]:
            for z in [-.305,.305]:
                block('desk_square_tube_leg',(x,.346,z),(.032,.652,.032),steel,.0015)
                block('desk_foot',(x,.01,z),(.045,.02,.045),rubber,.002)
            block('desk_side_lower_rail',(x,.09,0),(.032,.032,.61),steel,.0015)
            block('desk_side_upper_rail',(x,.663,0),(.032,.032,.61),steel,.0015)
        block('desk_rear_crossbar',(0,.17,-.305),(1.17,.03,.03),steel,.0015)
        block('desk_front_upper_rail',(0,.663,.305),(1.17,.03,.03),steel,.0015)
        changes['notes'].append('Retained textured wooden top/drawers. Replaced malformed metal legs with four square tubes, support rails and level rubber feet.')
    elif asset == '23_workbench':
        # Keep only the textured upper apron of the Tripo bench. The previously
        # authored plate is replaced with a beveled solid slab in Blender.
        for m in meshes[1:]:
            bpy.data.objects.remove(m,do_unlink=True)
        meshes[:] = [obj]
        cut_below(obj,.65)
        obj.name='TRIPO_RETAINED_WORKBENCH_UPPER_APRON'
        steel=material('LOCAL_bench_dark_steel',(.065,.046,.04),.65,.42)
        top=material('LOCAL_brushed_work_surface',(.17,.20,.21),.65,.43)
        rubber=material('LOCAL_bench_rubber_feet',(.012,.014,.015),0,.8)
        # Entire top and shelf are supported; no floating inserts.
        block('bench_solid_top',(0,.738,0),(2.2,.024,.66),top,.003)
        block('bench_solid_lower_shelf',(0,.16,0),(2.07,.018,.57),steel,.002)
        for x in [-1.01,1.01]:
            for z in [-.285,.285]:
                block('bench_square_leg',(x,.38,z),(.052,.70,.052),steel,.0025)
                block('bench_level_foot',(x,.015,z),(.066,.03,.066),rubber,.003)
            for h in [.14,.70]:
                block('bench_end_rail',(x,h,0),(.052,.045,.57),steel,.002)
        for z in [-.285,.285]:
            for h in [.14,.70]:
                block('bench_long_rail',(0,h,z),(2.02,.045,.045),steel,.002)
        changes['notes'].append('Retained textured Tripo upper apron. Rebuilt torn lower shelf, irregular legs and both work surfaces as solid beveled steel parts.')
    # Suppress exaggerated generated micro-normal wrinkles, keep all source
    # color / ORM / normal images and UVs embedded and editable.
    for mat in bpy.data.materials:
        if mat.use_nodes and not mat.name.startswith('LOCAL_'):
            for node in mat.node_tree.nodes:
                if node.type == 'NORMAL_MAP':
                    node.inputs['Strength'].default_value=.35
    for m in [o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.startswith('LOCAL_')]:
        clean(m)
        activate(m)
        # Preserve smooth cables/knobs as well as hard 90-degree case seams.
        bpy.ops.object.shade_auto_smooth(angle=math.radians(80))
        for mod in list(m.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=m.modifiers.new('Area weighted panel normals','WEIGHTED_NORMAL')
        mod.keep_sharp=True
        mod.weight=35
        bpy.ops.object.modifier_apply(modifier=mod.name)
    changes['local_parts']=[o.name for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('LOCAL_')]
    changes['notes'].append('Merged coincident vertices at 1 micrometre, removed degenerate edges, recalculated winding and panel normals; generated normal-map strength reduced to 0.35.')
    return changes


def studio(size):
    s=max(size)
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=16
    scene.cycles.use_denoising=True
    scene.render.resolution_x=800
    scene.render.resolution_y=600
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.world=bpy.data.worlds.new('Neutral review environment')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.23,.28,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene.view_settings.view_transform='AgX'
    floor=material('REVIEW_floor',(.055,.065,.08),0,.65)
    bpy.ops.mesh.primitive_plane_add(size=s*200,location=(0,0,-.001))
    bpy.context.object.name='REVIEW_FLOOR'
    bpy.context.object.data.materials.append(floor)
    for name,pos,power,area in [('key',(1,-2,3),180,2),('fill',(-2,-1,1.5),110,2),('rim',(0,2,2.5),220,1.5)]:
        data=bpy.data.lights.new('REVIEW_'+name,'AREA');data.energy=power*s*s;data.shape='DISK';data.size=area*s
        o=bpy.data.objects.new('REVIEW_'+name,data);scene.collection.objects.link(o);o.location=Vector(pos)*s
        o.rotation_euler=(Vector((0,0,size[1]*.45))-o.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Review camera');o=bpy.data.objects.new('REVIEW_CAMERA',data);scene.collection.objects.link(o);scene.camera=o
    data.type='ORTHO';data.ortho_scale=s*(1.9 if size[1]/s>.8 else 1.52)
    camera(size,False)


def camera(size,back):
    s=max(size);target=Vector((0,0,size[1]*.45));o=bpy.context.scene.camera
    o.location=target+Vector((1.15,2 if back else -2,1.05))*s
    o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()


def render(path):
    bpy.context.scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)


def main():
    for folder in ['before','models','blend','renders','reports']:
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    for item in MANIFEST['items']:
        asset=item['id']
        if not item.get('website_glb') or (FILTER and asset not in FILTER):
            continue
        source=OUT/'before'/f'{asset}.glb'
        if not source.exists():
            shutil.copy2(ROOT/item['website_glb'],source)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source))
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        for obj in meshes:
            matrix=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=matrix
            activate(obj);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
            obj['source_task_id']=item['task_id']
        for obj in list(bpy.context.scene.objects):
            if obj.type!='MESH':bpy.data.objects.remove(obj,do_unlink=True)
        # Save source geometry in memory for a camera-identical comparison.
        before_collection=bpy.data.collections.new('BEFORE_original_display_mesh');bpy.context.scene.collection.children.link(before_collection)
        before=[]
        for obj in meshes:
            clone=obj.copy();clone.data=obj.data.copy();clone.name='BEFORE_'+obj.name
            # Normal-strength edits must not alter comparison materials.
            for i,mat in enumerate(clone.data.materials):
                if mat:clone.data.materials[i]=mat.copy()
            before_collection.objects.link(clone);clone.hide_render=True;clone.hide_viewport=True;before.append(clone)
        # Exclude source duplicates while applying repairs.
        for o in before:before_collection.objects.unlink(o)
        changes=repair(asset,meshes)
        repaired=[o for o in bpy.context.scene.objects if o.type=='MESH']
        points=[o.matrix_world@v.co for o in repaired for v in o.data.vertices]
        low=Vector([min(p[i] for p in points) for i in range(3)])
        high=Vector([max(p[i] for p in points) for i in range(3)])
        center=(low+high)/2;center.z=low.z
        target=Vector((item['display_size_m_xyz'][0],item['display_size_m_xyz'][2],item['display_size_m_xyz'][1]))
        scale=Vector([target[i]/(high[i]-low[i]) for i in range(3)])
        fit=Matrix.Diagonal((*scale,1))@Matrix.Translation(-center)
        for o in repaired:o.matrix_world=fit@o.matrix_world
        changes['display_envelope_fit']={'scale_native_xyz':list(scale),'translation_to_bottom_center':list(-center)}
        for o in repaired:o['repair_tool']='Blender '+bpy.app.version_string
        bpy.ops.object.select_all(action='DESELECT')
        for o in repaired:o.select_set(True)
        output=OUT/'models'/f'{asset}.glb'
        bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,
            export_extras=True,export_yup=True,export_apply=True,export_animations=False,
            export_materials='EXPORT',export_cameras=False,export_lights=False)
        for o in before:before_collection.objects.link(o)
        studio(item['display_size_m_xyz'])
        for obj in before:
            # Copied source materials are isolated from the repaired materials.
            for mat in obj.data.materials:
                if mat and mat.use_nodes:
                    for node in mat.node_tree.nodes:
                        if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=1
        for o in repaired:o.hide_render=True
        for o in before:o.hide_render=False
        render(OUT/'renders'/f'{asset}-before.png')
        for o in repaired:o.hide_render=False
        for o in before:o.hide_render=True
        render(OUT/'renders'/f'{asset}-after.png')
        camera(item['display_size_m_xyz'],True)
        render(OUT/'renders'/f'{asset}-back.png')
        camera(item['display_size_m_xyz'],False)
        before_collection.hide_viewport=True
        bpy.ops.file.pack_all()
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'blend'/f'{asset}.blend'))
        record={'asset_id':asset,'source_task_id':item['task_id'],'blender_version':bpy.app.version_string,
            'input':str(source.relative_to(ROOT)).replace('\\','/'),'input_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'output':str(output.relative_to(ROOT)).replace('\\','/'),'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
            'raw_glb_unchanged':hashlib.sha256((ROOT/item['raw_glb']).read_bytes()).hexdigest()==item['raw_sha256'],
            'changes':changes,'mesh_stats':{o.name:mesh_stats(o) for o in repaired},
            'visual_acceptance':'pending','credits_spent':0}
        (OUT/'reports'/f'{asset}.json').write_text(json.dumps(record,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        print('REPAIR_COMPLETE',asset,flush=True)


if __name__=='__main__':main()
