"""Re-open the delivered .blend files and verify embedded source images."""
import bpy
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]/'assets/tripo/blender-repair'
results=[]
for path in sorted((root/'blend').glob('*.blend')):
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False)
    images=[i for i in bpy.data.images if i.type=='IMAGE' and i.source=='FILE']
    assert len(images)>=3,path.name
    assert all(i.packed_file or len(i.packed_files) for i in images),path.name
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.startswith(('BEFORE_','REVIEW_'))]
    assert meshes,path.name
    assert all(o.hide_render is False for o in meshes),path.name
    assert all(o.hide_render for o in bpy.data.collections['BEFORE_original_display_mesh'].objects),path.name
    results.append({'project':path.name,'opens':True,'packed_images':len(images),'editable_meshes':len(meshes),'original_comparison_hidden':True})
(root/'native-project-validation.json').write_text(json.dumps(results,indent=2)+'\n')
print('PROJECTS_VERIFIED',len(results))
