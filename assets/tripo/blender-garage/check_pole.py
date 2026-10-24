import bpy,json
bpy.ops.wm.open_mainfile(filepath='assets/tripo/blender-garage/blend/08_street_lamp.blend',load_ui=False)
for o in bpy.context.scene.objects:
 if o.type!='MESH' or o.name.startswith(('REVIEW','BEFORE','LOCAL')):continue
 p=[o.matrix_world@v.co for v in o.data.vertices if .9<(o.matrix_world@v.co).z<1.25 and (o.matrix_world@v.co).y<.28]
 print('POLE',[(min(v[k] for v in p),max(v[k] for v in p)) for k in range(3)])
