"""Read-only Blender import audit of the current workshop assets."""
import bpy
import json
import numpy as np
from pathlib import Path

root = Path(__file__).resolve().parents[1]
records = []
for path in sorted((root / 'static/maker-garage-preview/models').glob('*.glb')):
    if not 14 <= int(path.name[:2]) <= 23:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    points = np.array([tuple(o.matrix_world @ v.co) for o in bpy.context.scene.objects if o.type == 'MESH' for v in o.data.vertices])
    # Blender (x, -depth, height) -> web (x, height, depth).
    points = points[:, [0, 2, 1]] * [1, 1, -1]
    bounds = [points.min(0).tolist(), points.max(0).tolist()]
    bands = []
    for low, high in [(0,.1),(.1,.3),(.3,.5),(.5,.7),(.7,.9),(.9,1.01)]:
        subset = points[(points[:,1] >= low*bounds[1][1]) & (points[:,1] < high*bounds[1][1])]
        if len(subset):
            bands.append({'height_fraction':[low,high], 'quantiles_xyz':np.quantile(subset,[.02,.1,.5,.9,.98],axis=0).round(5).tolist()})
    records.append({'asset':path.stem,'bounds':bounds,'bands':bands})
destination = root / 'assets/tripo/blender-repair/audit.json'
destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(json.dumps(records,indent=2))
print('AUDIT',destination)
