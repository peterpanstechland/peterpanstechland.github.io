import bpy,json
from pathlib import Path
p=Path('assets/tripo/blender-garage')
bpy.ops.wm.open_mainfile(filepath=str(p/'blend/08_street_lamp.blend'),load_ui=False)
for o in bpy.context.scene.objects:
 if o.type!='MESH' or o.name.startswith(('REVIEW','BEFORE','LOCAL')):continue
 adj={v.index:set() for v in o.data.vertices}
 for e in o.data.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
 seen=set();comps=[]
 for i in adj:
  if i in seen:continue
  todo=[i];seen.add(i);part=[]
  while todo:
   n=todo.pop();part.append(n)
   for j in adj[n]-seen:seen.add(j);todo.append(j)
  if len(part)<10:continue
  pts=[o.matrix_world@o.data.vertices[j].co for j in part]
  comps.append({'n':len(part),'min':[min(v[k] for v in pts) for k in range(3)],'max':[max(v[k] for v in pts) for k in range(3)]})
 print('COMPONENTS',json.dumps(sorted(comps,key=lambda c:-c['n'])[:20]))
