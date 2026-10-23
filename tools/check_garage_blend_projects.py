"""Reopen all older-asset Blender projects and verify portable textures."""
import bpy
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'assets/tripo/blender-garage'
results=[]
for path in sorted((root/'blend').glob('*.blend')):
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False)
    images=[i for i in bpy.data.images if i.type=='IMAGE' and i.source in ['FILE','GENERATED'] and i.users]
    assert images and all(i.packed_file or len(i.packed_files) for i in images),path.name
    shapes={b.custom_shape for o in bpy.context.scene.objects if o.type=='ARMATURE' for b in o.pose.bones if b.custom_shape}
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in shapes and not o.name.startswith(('BEFORE_','REVIEW_'))]
    assert meshes,path.name
    if path.stem=='13_street_base':
        import bmesh
        bm=bmesh.new();bm.from_mesh(meshes[0].data)
        assert all(e.is_manifold for e in bm.edges),'Street foundation must be a closed mesh'
        bm.free()
    results.append({'project':path.name,'opens':True,'packed_images':len(images),'editable_meshes':len(meshes)})
assert len(results)==12
(root/'native-project-validation.json').write_text(json.dumps(results,indent=2)+'\n')
print('PROJECTS_VERIFIED',len(results))
