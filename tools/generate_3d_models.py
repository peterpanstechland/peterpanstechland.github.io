#!/usr/bin/env python3
"""Peter Pan's Techland | procedural GLB art pack, original editable source.
Run: python generate_models.py --out ./models
Requires: trimesh, numpy, Pillow.  Coordinates match static/maker-house/scene.html.
"""
from __future__ import annotations
import argparse, io, json, math, os
from pathlib import Path
import numpy as np
import trimesh as tm
from PIL import Image, ImageDraw, ImageFont

COLORS={
 'ink':'#14101e','black':'#090b14','dark':'#21192b','charcoal':'#31293e',
 'purple':'#66427c','violet':'#9d78d2','pink':'#ec5d96','rose':'#f78bb8',
 'cyan':'#63d6e4','sky':'#346f98','gold':'#f6bb65','amber':'#ffdea0',
 'white':'#f1e5ed','mint':'#93dec4','mintdark':'#539b8f','cream':'#e9d5cc',
 'steel':'#747285','asphalt':'#3c3449','window':'#243f5a', 'violetdark':'#46325f',
 'screen':'#b8eeec','red':'#e74b75','brown':'#8e6475', 'paper':'#ebd3d8',
}
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
if not os.path.exists(FONT):FONT='/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf'

def rgba(hexstr):
 h=hexstr.lstrip('#');return [int(h[i:i+2],16) for i in (0,2,4)]+[255]

def rot_xyz(rx=0,ry=0,rz=0):
 return tm.transformations.euler_matrix(rx,ry,rz,axes='sxyz')

def tf(pos=(0,0,0),rot=(0,0,0)):
 mat=rot_xyz(*rot);mat[:3,3]=pos;return mat

def between(a,b):
 a=np.array(a,dtype=float);b=np.array(b,dtype=float)
 axis=b-a;length=float(np.linalg.norm(axis))
 if length < 1e-6: raise ValueError('rod zero length')
 matrix=tm.geometry.align_vectors([0,0,1],axis / length)
 matrix[:3,3]=(a+b)/2
 return matrix,length

def graphic(title, subtitle=None, width=640, height=180, bg='#160e23', fg='#fff3fa', accent='#fa579d'):
 im=Image.new('RGBA',(width,height),bg);dr=ImageDraw.Draw(im)
 dr.rectangle((0,0,width-1,8),fill=accent)
 dr.rectangle((0,height-8,width-1,height-1),fill=accent)
 dr.rectangle((16,16,width-17,height-17),outline='#604268',width=2)
 fs=min(78,int(width/max(5,len(title))*.96))
 font=ImageFont.truetype(FONT,fs)
 bbox=dr.textbbox((0,0),title,font=font)
 while bbox[2]-bbox[0]>width-42 and fs>10:
  fs-=2;font=ImageFont.truetype(FONT,fs);bbox=dr.textbbox((0,0),title,font=font)
 y=(height-(bbox[3]-bbox[1]))/2-bbox[1]-(14 if subtitle else 0)
 dr.text((width/2,y),title,font=font,fill=fg,anchor='ma',stroke_width=0)
 if subtitle:
  f=ImageFont.truetype(FONT,19)
  dr.text((width/2,height-34),subtitle,font=f,fill='#e2abcb',anchor='ma')
 return im

class Model:
 def __init__(self,name):
  self.name=name;self.scene=tm.Scene();self.counter=0;self.mats={}
 def mat(self,color,emissive=False,metal=.2,rough=.64):
  key=(color,emissive,metal,rough)
  if key not in self.mats:
   self.mats[key]=tm.visual.material.PBRMaterial(name=f'MAT_{color.strip("#")}_{len(self.mats)}',baseColorFactor=rgba(COLORS.get(color,color)),metallicFactor=metal,roughnessFactor=rough,emissiveFactor=([.18,.06,.11] if emissive and color in ('pink','rose','red') else ([.08,.18,.20] if emissive else [0,0,0])))
  return self.mats[key]
 def add(self,mesh,color='white',node=None,parent='world',pos=(0,0,0),rot=(0,0,0),emissive=False,metal=.2,rough=.64):
  self.counter+=1
  nm=node or f'mesh_{self.counter:04d}'
  mesh.visual=tm.visual.TextureVisuals(material=self.mat(color,emissive,metal,rough))
  self.scene.add_geometry(mesh,node_name=nm,geom_name=f'GEO_{self.counter:04d}',parent_node_name=parent,transform=tf(pos,rot))
  return nm
 def group(self,name,at=(0,0,0),parent='world'):
  self.scene.graph.update(frame_from=parent,frame_to=name,matrix=tf(at));return name
 def box(self,extents,pos=(0,0,0),color='dark',rot=(0,0,0),parent='world',node=None,emissive=False,metal=.2):
  return self.add(tm.creation.box(extents=extents),color,node,parent,pos,rot,emissive,metal)
 def ball(self,r,pos,color='white',scale=(1,1,1),parent='world',node=None,detail=2):
  mesh=tm.creation.icosphere(subdivisions=detail,radius=r);mesh.apply_scale(scale)
  return self.add(mesh,color,node,parent,pos)
 def cyl(self,r,h,pos,color='steel',segments=24,parent='world',node=None,rot=(0,0,0),metal=.2):
  mesh=tm.creation.cylinder(radius=r,height=h,sections=segments);mesh.apply_transform(rot_xyz(-math.pi/2,0,0))
  return self.add(mesh,color,node,parent,pos,rot,metal=metal)
 def cone(self,r,h,pos,color='white',parent='world',rot=(0,0,0),sections=4):
  mesh=tm.creation.cone(radius=r,height=h,sections=sections);mesh.apply_transform(rot_xyz(-math.pi/2,0,0))
  return self.add(mesh,color,parent=parent,pos=pos,rot=rot)
 def rod(self,a,b,r=.04,color='steel',parent='world',segments=12,emissive=False):
  M,length=between(a,b)
  mesh=tm.creation.cylinder(radius=r,height=length,sections=segments)
  mesh.visual=tm.visual.TextureVisuals(material=self.mat(color,emissive));self.counter+=1
  self.scene.add_geometry(mesh,node_name=f'rod_{self.counter}',geom_name=f'GEO_{self.counter}',parent_node_name=parent,transform=M)
 def ring(self,major,minor,pos,color='pink',plane='xy',parent='world',segments=32,tube=8):
  # Torus centered on origin in XY plane, rotate to XY/XZ/YZ as requested.
  verts=[];faces=[]
  for i in range(segments):
   phi=2*math.pi*i/segments
   for j in range(tube):
    theta=2*math.pi*j/tube
    x=(major+minor*math.cos(theta))*math.cos(phi)
    y=(major+minor*math.cos(theta))*math.sin(phi)
    z=minor*math.sin(theta)
    if plane=='xz':y,z=z,y
    if plane=='yz':x,y,z=z,x,y
    verts.append([x,y,z])
  for i in range(segments):
   for j in range(tube):
    a=i*tube+j;b=i*tube+(j+1)%tube;c=((i+1)%segments)*tube+j;d=((i+1)%segments)*tube+(j+1)%tube
    faces.extend([[a,c,d],[a,d,b]])
  self.add(tm.Trimesh(vertices=verts,faces=faces,process=False),color,parent=parent,pos=pos,emissive=True)
 def texture(self,img,w,h,pos,parent='world',node=None,orientation='front'):
  self.counter+=1
  # Oriented toward +Z by default. UV top corresponds to image top.
  verts=np.array([[-w/2,-h/2,0],[w/2,-h/2,0],[w/2,h/2,0],[-w/2,h/2,0]],dtype=float)
  faces=np.array([[0,1,2],[0,2,3],[2,1,0],[3,2,0]])
  uv=np.array([[0,0],[1,0],[1,1],[0,1]],dtype=float)
  mesh=tm.Trimesh(vertices=verts,faces=faces,process=False)
  mesh.visual=tm.visual.TextureVisuals(uv=uv,material=tm.visual.material.PBRMaterial(name=f'TEXT_{self.counter}',baseColorTexture=img,baseColorFactor=[255,255,255,255],metallicFactor=0,roughnessFactor=.95,doubleSided=True))
  self.scene.add_geometry(mesh,node_name=node or f'sign_{self.counter}',geom_name=f'GEO_{self.counter}',parent_node_name=parent,transform=tf(pos))
 def export(self,path):
  p=Path(path);p.parent.mkdir(parents=True,exist_ok=True)
  p.write_bytes(self.scene.export(file_type='glb'))
  loaded=tm.load(p,force='scene')
  bbox=loaded.bounds.tolist() if loaded.bounds is not None else None
  return {'file':p.name,'bytes':p.stat().st_size,'meshes':len(loaded.geometry),'nodes':len(loaded.graph.nodes),'bounds':bbox,'animations_nodes':[n for n in loaded.graph.nodes if any(word in n.upper() for word in ['PAW','HAND','CARD','CAMERA','SCREEN','ROOF'])]}

def make_neko():
 m=Model('NEKO');
 m.cyl(.59,.12,(0,.07,0),'purple',segments=32)
 m.ball(.56,(0,.72,0),'white',scale=(.97,1.15,.83),detail=3)
 m.ball(.54,(0,1.63,.02),'white',scale=(1,1.04,.85),detail=3)
 for s in [-1,1]:
  m.cone(.23,.49,(s*.36,2.18,.04),'white',sections=4)
  m.cone(.126,.25,(s*.36,2.24,.25),'pink',sections=4)
  m.ball(.13,(s*.42,1.51,.425),'rose',scale=(1,.55,.3))
  m.ball(.058,(s*.20,1.70,.462),'ink',scale=(.75,1.35,.7),detail=2)
  m.ball(.21,(s*.30,.25,.31),'white',scale=(1,.66,1.0))
 m.ball(.055,(0,1.50,.51),'pink',scale=(1,.75,.8))
 m.rod((-.1,1.43,.52),(0,1.38,.53),.013,'charcoal')
 m.rod((0,1.38,.53),(.1,1.43,.52),.013,'charcoal')
 for s in [-1,1]:
  for j in range(2):m.rod((s*.12,1.49+j*.055,.53),(s*.37,1.51+j*.105,.48),.011,'steel')
 m.ring(.25,.045,(0,.91,.47),'gold',plane='xy')
 m.cyl(.20,.07,(-.54,.97,.48),'gold',segments=24,rot=(math.pi/2,0,0),metal=.45)
 m.box((.14,.04,.03),(-.54,.97,.52),'cream')
 m.group('PAW_WAVE',at=(.55,1.17,.08))
 m.ball(.2,(.10,.21,.1),'white',scale=(.8,1.5,.85),parent='PAW_WAVE')
 m.ball(.22,(.14,.47,.13),'white',scale=(.98,1.1,.9),parent='PAW_WAVE')
 for x in [-.08,.03,.14,.25]:m.ball(.045,(x,.63,.305),'rose',parent='PAW_WAVE',detail=1)
 m.ball(.16,(-.54,1.02,.10),'white',scale=(.75,1.45,.86))
 # Magenta circuit traces across belly.
 for s in [-1,1]:
  m.rod((s*.22,.6,.45),(s*.22,.74,.44),.013,'pink')
  m.ball(.028,(s*.22,.74,.45),'pink',detail=1)
 return m

def make_pan():
 m=Model('PAN')
 m.box((1.46,.13,1.03),(0,.08,0),'violetdark')
 m.box((1.34,1.02,.84),(0,.68,0),'charcoal')
 for x in [-.56,.56]:
  m.box((.13,.88,.92),(x,.69,0),'steel',metal=.6)
 m.box((1.08,.65,.04),(0,.82,.445),'purple')
 m.texture(graphic('PΛN','TALK · PLAY · TASTE',width=460,height=220,accent='#ff6aa6'),.95,.48,(0,.84,.477))
 m.box((1.18,.13,.15),(0,1.25,.18),'pink')
 for x,col in [(-.42,'pink'),(0,'cyan'),(.42,'gold')]:
  m.cyl(.105,.44,(x,1.53,-.15),col,segments=18)
  m.cyl(.08,.035,(x,1.77,-.15),'ink')
  m.rod((x,1.75,-.15),(x,.36,-.21),.018,'cream')
 m.cyl(.27,.085,(0,.16,.62),'steel',segments=30)
 m.cyl(.215,.30,(0,.33,.60),'white',segments=30)
 m.ring(.17,.032,(0,.21,.61),'cyan',plane='xz')
 # vintage handset on left, resting on a cradle
 m.box((.54,.10,.16),(-.84,1.07,.19),'cream',rot=(0,0,-.25))
 for x in [-1.06,-.62]:m.cyl(.13,.17,(x,1.08,.19),'rose',rot=(0,0,math.pi/2),segments=20)
 m.ring(.31,.022,(-.81,.76,.14),'pink',plane='yz')
 m.cyl(.12,.1,(.51,.46,.49),'gold')
 m.cyl(.10,.10,(.65,.46,.49),'cyan')
 m.group('HAND_WAVE',at=(.70,1.25,-.08))
 m.rod((0,0,0),(.18,.49,.05),.075,'steel',parent='HAND_WAVE')
 m.ball(.17,(.18,.55,.05),'white',scale=(.9,.9,.45),parent='HAND_WAVE')
 for j in range(3):m.rod((.08+j*.10,.57,.11),(.02+j*.13,.86,.12),.026,'white',parent='HAND_WAVE')
 return m

def make_flipfate():
 m=Model('FlipFate')
 m.box((1.25,.13,.89),(0,.07,0),'purple')
 m.box((1.1,1.36,.76),(0,.76,0),'violetdark')
 m.box((1.16,.14,.83),(0,1.46,0),'pink')
 m.box((.84,.93,.03),(0,1.0,.40),'ink')
 m.ring(.39,.026,(0,1.09,.439),'gold','xy')
 m.group('CARD_FLIP',at=(0,1.02,.49))
 m.box((.46,.67,.052),(0,0,0),'white',parent='CARD_FLIP')
 m.box((.39,.60,.006),(0,0,.031),'purple',parent='CARD_FLIP')
 m.ring(.13,.018,(0,.025,.044),'gold','xy',parent='CARD_FLIP')
 m.ball(.06,(0,.025,.047),'rose',parent='CARD_FLIP')
 for s in [-1,1]:
  m.ball(.045,(s*.135,.20,.045),'gold',parent='CARD_FLIP',detail=1)
 m.box((.57,.052,.055),(0,.25,.445),'cyan')
 m.box((.5,.06,.05),(0,.34,.445),'pink')
 m.box((.54,.17,.26),(0,.19,.44),'charcoal')
 m.box((.44,.035,.26),(0,.25,.58),'paper')
 m.cyl(.11,.09,(.43,.28,.51),'gold',rot=(math.pi/2,0,0))
 for x in [-.46,.46]:
  m.rod((x,.2,.37),(x,1.47,.37),.023,'gold')
 return m

def make_bmo():
 m=Model('BMO')
 m.box((1.04,1.35,.72),(0,.93,0),'mint')
 m.box((.83,.72,.03),(0,1.15,.38),'mintdark')
 m.texture(graphic('◕ ᴗ ◕',width=512,height=340,bg='#b2eece',fg='#244e54',accent='#6bcebd'),.74,.58,(0,1.16,.407))
 m.box((.33,.06,.03),(-.17,.6,.395),'purple')
 m.cyl(.07,.045,(.26,.62,.4),'pink',rot=(math.pi/2,0,0))
 m.cyl(.048,.045,(.37,.53,.4),'gold',rot=(math.pi/2,0,0))
 m.group('SCREEN_FACE',at=(0,1.16,.405))
 m.box((.07,.10,.012),(0,-.28,.012),'cyan',parent='SCREEN_FACE')
 for s in [-1,1]:
  m.ball(.16,(s*.69,.86,.04),'mint',scale=(.50,1.2,.6))
  m.ball(.13,(s*.71,.60,.065),'white',scale=(.86,.8,.8))
  m.box((.2,.37,.30),(s*.29,.13,0),'mintdark')
  m.box((.25,.12,.36),(s*.29,.045,.16),'ink')
 for z in [-.18,.18]:m.box((.028,.35,.07),(-.53,1.18,z),'purple')
 return m

def make_roomba():
 m=Model('Roomba')
 m.cyl(.72,.30,(0,.22,0),'charcoal',segments=40)
 m.cyl(.73,.075,(0,.39,0),'purple',segments=40)
 m.ring(.67,.028,(0,.42,0),'cyan','xz')
 for s in [-1,1]:
  m.cyl(.18,.09,(s*.65,.16,.18),'ink',segments=20,rot=(0,0,math.pi/2))
  m.cyl(.115,.10,(s*.74,.16,.18),'steel',segments=20,rot=(0,0,math.pi/2))
 m.cyl(.14,.31,(0,.62,-.08),'steel')
 m.group('CAMERA_HEAD',at=(0,.81,-.08))
 m.box((.62,.46,.43),(0,.11,0),'ink',parent='CAMERA_HEAD')
 m.box((.58,.39,.025),(0,.11,.24),'purple',parent='CAMERA_HEAD')
 m.cyl(.205,.06,(0,.13,.27),'cyan',parent='CAMERA_HEAD',segments=30,rot=(math.pi/2,0,0))
 m.cyl(.13,.065,(0,.13,.31),'window',parent='CAMERA_HEAD',segments=30,rot=(math.pi/2,0,0))
 m.cyl(.055,.067,(0,.13,.355),'sky',parent='CAMERA_HEAD',segments=28,rot=(math.pi/2,0,0))
 for s in [-1,1]:m.box((.08,.14,.025),(s*.235,.13,.26),'pink',parent='CAMERA_HEAD')
 m.rod((-.19,.28,-.12),(-.19,.50,-.12),.03,'steel',parent='CAMERA_HEAD')
 m.ball(.065,(-.19,.5,-.12),'gold',parent='CAMERA_HEAD')
 m.box((.45,.07,.08),(0,.42,.48),'pink')
 m.box((.17,.08,.10),(0,.38,-.69),'cyan')
 return m

def make_garage():
 m=Model('MakerGarage')
 # Architectural shell is distinct from the existing procedural ground, resident stands and nav signs.
 for x in (-8.20,8.20):
  m.box((.26,4.85,11.45),(x,2.4,0),'dark')
  for z in (-5.30,-2.65,0,2.65,5.25):m.box((.31,4.95,.25),(x,2.45,z),'purple')
  m.box((.32,.15,11.55),(x,4.84,0),'rose')
 m.box((16.5,4.85,.26),(0,2.4,-5.60),'charcoal')
 m.box((16.52,.25,.3),(0,4.78,-5.58),'pink')
 m.box((16.52,.20,.25),(0,.18,-5.55),'steel')
 for x in [-7.95,-5.5,-3.0,-.5,2,4.5,7.0]:m.box((.18,4.5,.4),(x,2.4,-5.45),'violetdark')
 # Side windows, windows have translucent-looking blue opaque backing.
 for s in [-1,1]:
  for z in [-3.6,.15,3.8]:
   m.box((.045,1.58,2.0),(s*8.38,2.75,z),'window')
   for dz in [-1,1]:m.box((.085,1.65,.05),(s*8.41,2.75,z+dz*1.0),'cyan')
   m.box((.07,.065,2.06),(s*8.42,2.76,z),'sky')
 # hanging roof panels, each has named parent node for fade / roof reveal
 for s,label in [(-1,'ROOF_LEFT'),(1,'ROOF_RIGHT')]:
  m.group(label)
  m.box((9.5,.29,12.1),(s*4.05,6.10,0),'violetdark',rot=(0,0,s*.39),parent=label)
  for z in [-5.75,0,5.75]:m.box((9.55,.085,.11),(s*4.05,6.15,z),'rose',rot=(0,0,s*.39),parent=label)
 m.box((.19,.2,12.1),(0,7.82,0),'pink')
 # front pillars and cornice; avoid filling the central transparent doorway
 for x in [-8.10,-4.35,4.35,8.1]:m.box((.24,4.8,.25),(x,2.44,5.58),'steel')
 for x in [-6.10,6.1]:
  m.box((2.0,3.1,.16),(x,2.15,5.64),'window')
  m.box((2.05,.065,.22),(x,3.73,5.68),'cyan')
  m.box((.06,3.17,.22),(x,2.15,5.68),'purple')
 m.box((17.0,.20,.36),(0,4.86,5.7),'purple')
 m.box((8.5,1.02,.28),(0,5.40,5.89),'ink')
 m.box((8.58,.065,.30),(0,5.99,5.89),'pink')
 m.texture(graphic('PETER PAN\'S TECHLAND',width=1024,height=170,accent='#f067aa'),7.80,.80,(0,5.40,6.045))
 # rear wall maker workbench details that do not conflict with front categorical signs
 for x in [-6.60,-3.3,0,3.30,6.6]:
  m.box((1.65,.95,.26),(x,1.25,-5.23),'violetdark')
  m.box((1.43,.10,.28),(x,1.82,-5.17),'cyan')
  m.box((1.10,.65,.045),(x,2.60,-5.33),'window')
  m.box((.80,.09,.056),(x,2.56,-5.30),'pink')
 # wall tool silhouette / rails
 for x in (-7.4,7.4):
  m.box((.10,1.6,1.5),(x,2.20,-3.85),'purple')
  for k in range(4):m.rod((x,1.6+k*.35,-4.4),(x,1.6+k*.35,-3.3),.02,'gold')
 # warm roof/corner strings, geometry carries lighting hints without heavy PBR glow
 for x in [-6.6,-3.3,0,3.3,6.6]:
  m.ball(.09,(x,4.58,-5.02),'amber',detail=1)
  m.cyl(.05,.42,(x,4.35,-5.02),'gold',segments=8)
 # chimney / garage side detail
 m.box((1.2,1.2,1.2),(6.0,7.12,-3.2),'charcoal')
 m.box((1.35,.15,1.35),(6,7.78,-3.2),'pink')
 return m

MAKERS=[('maker-garage.glb',make_garage),('neko-luckycat.glb',make_neko),('pan-cocktail-robot.glb',make_pan),('flipfate-machine.glb',make_flipfate),('bmo-companion.glb',make_bmo),('roomba-camera-bot.glb',make_roomba)]

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--out',default='models');args=parser.parse_args()
 dest=Path(args.out);dest.mkdir(parents=True,exist_ok=True);result=[]
 for filename,f in MAKERS:
  model=f();meta=model.export(dest/filename);result.append(meta)
  print(f"{meta['file']:27s} {meta['bytes']:8d} B  {meta['meshes']:4d} meshes | {meta['nodes']:4d} nodes")
 (dest/'model_manifest.json').write_text(json.dumps({'generator':'Peter Pans Techland | Procedural 3D Pack 1.0','format':'glb','license':'CC BY 4.0 - Original procedural models','note':'Artist-designed code-generated GLB meshes, not Tripo outputs','assets':result},ensure_ascii=False,indent=2),encoding='utf-8')
 print('Saved to',dest.resolve())

if __name__=='__main__':main()