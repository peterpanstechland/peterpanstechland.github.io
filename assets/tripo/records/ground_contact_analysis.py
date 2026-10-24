"""Offline diagnostic only: real GLB surfaces under current scene transforms."""
import sys,json,math,hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools'))
from inspect_tripo_glb import Inspector
MF=ROOT/'PeterPansTechland_Tripo_Generation_Pack/manifest.json'
CONFIG=ROOT/'static/maker-garage-preview/assets.json'
models={}
def geometry(c):
 p=ROOT/'static/maker-garage-preview'/c['file']; ins=Inspector(p,c['id'],MF); ins.container(); d=ins.doc; nodes=d['nodes']; parents={ch:i for i,n in enumerate(nodes) for ch in n.get('children',[])}; matrices={}
 def world(i):
  if i not in matrices: matrices[i]=(world(parents[i]) if i in parents else np.eye(4))@ins.local_matrix(nodes[i])
  return matrices[i]
 active=set(); todo=list(d['scenes'][d.get('scene',0)]['nodes'])
 while todo:
  i=todo.pop(); active.add(i); todo.extend(nodes[i].get('children',[]))
 vertices=[]; faces=[]; offset=0
 for i in sorted(active):
  n=nodes[i]
  if 'mesh' not in n: continue
  skin=d.get('skins',[])[n['skin']] if 'skin' in n else None
  if skin:
   inv=ins.accessor(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1); palette=np.stack([world(j)@inv[k] for k,j in enumerate(skin['joints'])])
  for prim in d['meshes'][n['mesh']]['primitives']:
   a=prim['attributes']; pos=ins.accessor(a['POSITION']).astype(float); hp=np.column_stack((pos,np.ones(len(pos))))
   if skin:
    pp=np.zeros_like(hp); weight=np.zeros(len(pos)); aset=0
    while f'JOINTS_{aset}' in a:
     js=ins.accessor(a[f'JOINTS_{aset}']).astype(int); ws=ins.accessor(a[f'WEIGHTS_{aset}'])
     for k in range(4): pp+=np.einsum('nij,nj->ni',palette[js[:,k]],hp)*ws[:,k,None]
     weight+=ws.sum(axis=1); aset+=1
    pos=pp[:,:3]/weight[:,None]
   else: pos=(hp@world(i).T)[:,:3]
   ix=ins.accessor(prim['indices']).astype(int).reshape(-1,3) if 'indices' in prim else np.arange(len(pos)).reshape(-1,3)
   vertices.append(pos); faces.append(ix+offset); offset+=len(pos)
 v=np.concatenate(vertices); f=np.concatenate(faces)
 ang=c.get('rotationY',0 if c.get('normalized') else -math.pi/2); co,si=math.cos(ang),math.sin(ang); rot=np.array([[co,0,si],[0,1,0],[-si,0,co]])
 v=v@rot.T; rawlo=v.min(0); rawhi=v.max(0); rawsize=rawhi-rawlo
 if not c.get('normalized'):
  scale=np.array(c['targetSize'])/rawsize if 'targetSize' in c else np.repeat(c.get('targetHeight',0)/rawsize[1] if c.get('targetHeight',0)>0 else c.get('targetWidth',0)/rawsize[0] if c.get('targetWidth',0)>0 else 1,3)
  v=(v-np.array([(rawlo[0]+rawhi[0])/2,rawlo[1],(rawlo[2]+rawhi[2])/2]))*scale
 else: scale=np.ones(3)
 v+=np.array(c.get('position',[0,0,0])); tri=v[f]; norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]); area=np.linalg.norm(norm,axis=1)/2; ny=norm[:,1]/np.maximum(area*2,1e-30)
 return dict(v=v,f=f,tri=tri,area=area,ny=ny,config=c,sha=hashlib.sha256(p.read_bytes()).hexdigest(),scale=scale.tolist(),source_y=[float(rawlo[1]),float(rawhi[1])])
for c in json.loads(CONFIG.read_text(encoding='utf-8-sig'))['assets']:
 if c.get('file'): models[c['id']]=geometry(c)
def ys_at(m,x,z,ymax=1,up=.1):
 t=m['tri']; a=t[:,0]; b=t[:,1]-a; c=t[:,2]-a; qx=x-a[:,0]; qz=z-a[:,2]; den=b[:,0]*c[:,2]-b[:,2]*c[:,0]; good=np.abs(den)>1e-10
 u=np.divide(qx*c[:,2]-qz*c[:,0],den,out=np.zeros_like(den),where=good); w=np.divide(b[:,0]*qz-b[:,2]*qx,den,out=np.zeros_like(den),where=good)
 y=a[:,1]+u*b[:,1]+w*c[:,1]; good&=(u>=-1e-7)&(w>=-1e-7)&(u+w<=1+1e-7)&(y<=ymax)&(m['ny']>up)
 return np.sort(y[good])
def stats(vals):
 vals=np.asarray(vals,float)
 return dict(n=len(vals),min=float(vals.min()),p10=float(np.quantile(vals,.1)),median=float(np.median(vals)),p90=float(np.quantile(vals,.9)),max=float(vals.max())) if len(vals) else None
out=dict(scope='Offline actual triangles under current assets.json transforms. Cat CPU bind skinning. Upward barycentric XZ ray samples below 1m. Not browser visual acceptance.',config_sha256=hashlib.sha256(CONFIG.read_bytes()).hexdigest(),assets={})
for aid,m in models.items():
 v=m['v'];lo=v.min(0);hi=v.max(0);tri=m['tri'];cent=tri.mean(1)
 upward=(m['ny']>.7)&(cent[:,1]<min(lo[1]+.7,hi[1])); bins={}
 for y,ar in zip(cent[upward,1],m['area'][upward]):
  key=round(float(y)/.02)*.02;bins[key]=bins.get(key,0)+float(ar)
 patches=sorted(bins.items(),key=lambda k:-k[1])[:10]
 low=v[v[:,1]<=lo[1]+min(.05,(hi[1]-lo[1])*.07)]
 if len(low)>500: low=low[np.linspace(0,len(low)-1,500,dtype=int)]
 gaps=[];support=[]
 for p in low:
  levels=ys_at(models['13_street_base'],p[0],p[2],.3)
  if len(levels): support.append(float(levels[-1]));gaps.append(float(p[1]-levels[-1]))
 center=np.array(m['config'].get('position',[0,0,0]));cs=ys_at(models['13_street_base'],center[0],center[2],.3)
 out['assets'][aid]=dict(sha256=m['sha'],bounds=[lo.tolist(),hi.tolist()],scale=m['scale'],source_y=m['source_y'],triangle_count=len(tri),low_upward_surface_bins_m_area_m2=patches,bottom_region_minmax_xz=[low[:,[0,2]].min(0).tolist(),low[:,[0,2]].max(0).tolist()],base13_under_pivot_upward_ys=cs.tolist(),base13_under_low_vertices=stats(support),gap_to_base13_at_low_vertices=stats(gaps))
for aid in ['13_street_base','01_garage_shell']:
 m=models[aid];lo=m['v'].min(0);hi=m['v'].max(0)
 xs=np.linspace(lo[0]+.1,hi[0]-.1,13);zs=np.linspace(lo[2]+.1,hi[2]-.1,13)
 out['assets'][aid]['surface_grid']={'x':xs.tolist(),'z':zs.tolist(),'top_upward_y_below_1m':[[float(y[-1]) if len(y:=ys_at(m,x,z)) else None for x in xs] for z in zs]}
 probes={}
 for x,z in [(0,0),(-1,0),(1,0),(0,-1),(0,1),(0,1.5),(0,1.75),(0,2),(0,2.5),(.35,-1.25),(1.55,2.12),(-1.25,2.1),(-2.75,1.5),(-2.6,.5),(2.65,0),(-2.6,-1.15),(2.6,.95)]: probes[f'{x},{z}']=ys_at(m,x,z).tolist()
 out['assets'][aid]['exact_surface_probe_ys']=probes
 out['assets'][aid]['dominant_low_upward_triangles']=[]
 eligible=np.flatnonzero((m['ny']>.7)&(m['tri'].mean(1)[:,1]<.8));best=eligible[np.argsort(-m['area'][eligible])[:25]]
 for j in best: out['assets'][aid]['dominant_low_upward_triangles'].append(dict(area=float(m['area'][j]),vertices=m['tri'][j].tolist()))
p=ROOT/'assets/tripo/records/ground-contact-analysis.json';p.write_text(json.dumps(out,indent=2),encoding='utf-8');print(p)
for aid,a in out['assets'].items(): print(aid,'bounds',np.round(a['bounds'],4).tolist(),'centerbase',np.round(a['base13_under_pivot_upward_ys'],4).tolist(),'gap',a['gap_to_base13_at_low_vertices'],'surfacebins',a['low_upward_surface_bins_m_area_m2'][:5])
for aid in ['13_street_base','01_garage_shell']:print(aid,'PROBES',out['assets'][aid]['exact_surface_probe_ys'])
