"""Inspect and partition the authored vending mesh without changing its source GLB."""
import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/tripo/ambient-motion'
OUT.mkdir(parents=True, exist_ok=True)
raw = (ROOT / 'static/maker-garage-preview/models/05_project_vending.glb').read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + length])
binary = raw[28 + length:]

def accessor(index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    width = {'SCALAR': 1, 'VEC3': 3, 'VEC2': 2}[a['type']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']]
    return np.frombuffer(binary, dtype=dtype, count=a['count'] * width,
                         offset=view.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(a['count'], width)

positions, triangles, uv = accessor(0), accessor(3).reshape(-1, 3), accessor(2)
centers = positions[triangles].mean(1)
texture_index = doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']
view = doc['bufferViews'][doc['images'][doc['textures'][texture_index]['source']]['bufferView']]
texture = np.array(Image.open(io.BytesIO(binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])).convert('RGB'))

def render(filename, depth=False, selected=None):
    image = Image.new('RGB', (1050, 1100), '#111820')
    draw = ImageDraw.Draw(image)
    def xy(p): return (int(90 + (p[0] + .85) * 540), int(1030 - p[1] * 540))
    for i in np.argsort(centers[:, 2]):
        tri = triangles[i]
        tex = uv[tri].mean(0)
        color = tuple(texture[min(texture.shape[0]-1, int(tex[1]*texture.shape[0])), min(texture.shape[1]-1, int(tex[0]*texture.shape[1]))])
        if depth:
            d = int(np.clip((centers[i, 2] + .2) / .65, 0, 1)*255)
            color = (d, d, d)
        if selected is not None and selected[i] >= 0:
            color = [(50,240,220),(255,180,80),(190,100,255)][selected[i] % 3]
        draw.polygon([xy(p) for p in positions[tri]], fill=color)
    for x in np.arange(-.8, .81, .1):
        xx, _ = xy([x,0]); draw.line((xx,48,xx,1030),fill='#796b6b');draw.text((xx,1042),f'{x:.1f}',fill='white')
    for y in np.arange(0,1.81,.1):
        _, yy = xy([0,y]);draw.line((80,yy,1000,yy),fill='#796b6b');draw.text((48,yy-5),f'{y:.1f}',fill='white')
    image.save(OUT/filename)

render('vending-color-map.png')
render('vending-depth-map.png', depth=True)
for lo, hi in [(1.14,1.40),(.82,1.04),(.48,.63)]:
    region=positions[(positions[:,0]>-.61)&(positions[:,0]<.28)&(positions[:,1]>lo)&(positions[:,1]<hi)]
    print(lo,hi,'depth quantiles',np.quantile(region[:,2],[0,.1,.25,.5,.75,.9,1]).round(3).tolist())

# Coordinates measured on the original, front-facing source geometry. Only
# protruding product faces are detached; recessed cabinet walls stay put.
slots = [
    ('robot', -.60, -.265, 1.127, 1.43),
    ('planter', -.16, .085, 1.127, 1.44),
    ('sculpture', .09, .235, 1.127, 1.34),
    ('console', -.61, -.315, .815, 1.07),
    ('box', -.27, -.095, .815, .91),
    ('flower', -.095, .105, .815, 1.035),
    ('cube', .105, .205, .815, .925),
    ('plant', -.61, -.455, .483, .685),
    ('speaker', -.455, -.25, .483, .725),
    ('laptop', -.145, .105, .483, .75),
    ('light', .17, .28, .483, .60),
]
selected = np.full(len(triangles), -1)
items = []
for index, (name, left, right, bottom, top) in enumerate(slots):
    x, y, z = centers.T
    mask = (selected < 0) & (x > left) & (x < right) & (y > bottom) & (y < top) & (z > .055)
    faces = np.flatnonzero(mask)
    selected[faces] = index
    points = positions[np.unique(triangles[faces])]
    pivot = (points.min(0) + points.max(0)) / 2
    items.append({'name':name,'faces':faces.tolist(),'pivot':pivot.tolist(),'floor':bottom,'bounds':[points.min(0).tolist(),points.max(0).tolist()]})
    print(name,len(faces))
assert len(set(i for item in items for i in item['faces'])) == sum(len(item['faces']) for item in items)
manifest = {'source':'05_project_vending.glb','vertexCount':len(positions),'triangleCount':len(triangles),'items':items}
(ROOT/'static/maker-garage-preview/vending-motion.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
render('vending-selected-items.png',selected=selected)
