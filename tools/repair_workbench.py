"""Clear generated boxes from the real Tripo bench; preserve raw downloads.

Run after prepare_workshop_asset.py. Retained triangles keep their source UVs
and images. A separate, explicitly local steel work surface closes the cut.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import struct

import numpy as np
from inspect_tripo_glb import Inspector


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    assert args.source.resolve() != args.output.resolve()
    manifest = Path('assets/tripo/INTERIOR_EQUIPMENT_PLAN.json')
    original = Inspector(args.source, '23_workbench', manifest)
    assert original.run()['ready_for_visual_review']
    doc = copy.deepcopy(original.doc)
    assert len(doc['meshes']) == 1 and len(doc['nodes']) == 2
    primitive = doc['meshes'][0]['primitives'][0]
    attrs = primitive['attributes']
    matrix = original.local_matrix(doc['nodes'][1]) @ original.local_matrix(doc['nodes'][0])
    pos = original.accessor(attrs['POSITION']).astype(float)
    pos = pos @ matrix[:3, :3].T + matrix[:3, 3]
    normals = original.accessor(attrs['NORMAL']).astype(float) @ np.linalg.inv(matrix[:3, :3])
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    uv = original.accessor(attrs['TEXCOORD_0'])
    vertices = np.c_[pos, normals, uv]
    indices = original.accessor(primitive['indices']).reshape(-1, 3)
    cut = .652
    triangles = []
    for tri in vertices[indices]:
        clipped = []
        for a, b in zip(tri, np.roll(tri, -1, axis=0)):
            if a[1] <= cut:
                clipped.append(a)
            if (a[1] <= cut) != (b[1] <= cut):
                clipped.append(a + (b-a) * ((cut-a[1])/(b[1]-a[1])))
        for i in range(1, len(clipped)-1):
            t = np.array([clipped[0], clipped[i], clipped[i+1]])
            if np.linalg.norm(np.cross(t[1,:3]-t[0,:3], t[2,:3]-t[0,:3])) > 1e-10:
                triangles.append(t)
    data = np.array(triangles).reshape(-1, 8)
    data[:, 1] *= .75 / cut
    data[:, 4] *= cut / .75
    data[:, 3:6] /= np.linalg.norm(data[:, 3:6], axis=1)[:, None]
    binary = bytearray(original.buffers[0])

    def accessor(values, kind):
        values = np.asarray(values, dtype='<f4')
        binary.extend(b'\0' * (-len(binary) % 4))
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
        binary.extend(values.tobytes())
        item = {'bufferView': view, 'componentType': 5126, 'count': len(values), 'type': kind}
        if kind == 'VEC3':
            item.update(min=values.min(0).tolist(), max=values.max(0).tolist())
        doc['accessors'].append(item)
        return len(doc['accessors'])-1

    retained = {'attributes': {'POSITION': accessor(data[:,:3], 'VEC3'), 'NORMAL': accessor(data[:,3:6], 'VEC3'), 'TEXCOORD_0': accessor(data[:,6:], 'VEC2')}, 'material': primitive['material']}
    # Thin physical plate, visibly distinct from the retained textured frame.
    faces = [(2,3,7,6), (0,4,5,1), (0,1,3,2), (4,6,7,5), (0,2,6,4), (1,5,7,3)]
    plate, plate_normals = [], []
    # A lower shelf insert covers the source's torn shelf while retaining the
    # original structural rails, legs and their textures.
    for width, depth, low, high in [(1.08,.32,.738,.75), (1.035,.29,.164,.174)]:
        corners = np.array([[x,y,z] for x in [-width,width] for y in [low,high] for z in [-depth,depth]])
        for a,b,c,d in faces:
            normal = np.cross(corners[b]-corners[a],corners[c]-corners[a]); normal /= np.linalg.norm(normal)
            for index in [a,b,c,a,c,d]:
                plate.append(corners[index]); plate_normals.append(normal)
    mat = len(doc['materials'])
    doc['materials'].append({'name':'LOCAL_REPLACEMENT_STEEL_WORK_SURFACE','pbrMetallicRoughness':{'baseColorFactor':[.24,.29,.31,1],'roughnessFactor':.67,'metallicFactor':.4},'extras':{'locallyAuthored':True}})
    cap = {'attributes':{'POSITION':accessor(plate,'VEC3'),'NORMAL':accessor(plate_normals,'VEC3')},'material':mat}
    provenance = doc['asset']['extras']['workshop_provenance']
    provenance['postprocess'] = 'Root transform baked; source triangles clipped above tabletop; local steel work surface closes cut and a lower shelf insert covers source holes. Original textures retained.'
    provenance['normalized_input_sha256'] = hashlib.sha256(args.source.read_bytes()).hexdigest()
    doc['nodes'] = [{'name':'TRIPO_WORKBENCH_RETAINED_FRAME','mesh':0},{'name':'LOCAL_STEEL_WORK_SURFACE','mesh':1,'extras':{'locallyAuthored':True}}]
    doc['meshes'] = [{'primitives':[retained]},{'primitives':[cap]}]
    doc['scenes'] = [{'nodes':[0,1]}]; doc['scene']=0
    binary.extend(b'\0'*(-len(binary)%4)); doc['buffers']=[{'byteLength':len(binary)}]
    js = json.dumps(doc,separators=(',',':')).encode(); js += b' '*(-len(js)%4)
    body = struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
    args.output.write_bytes(struct.pack('<III',0x46546c67,2,len(body)+12)+body)
    qa = Inspector(args.output,'23_workbench',manifest).run()
    assert qa['ready_for_visual_review'], qa['errors']
    print(json.dumps({'output':str(args.output),'retained_triangles':len(triangles),'local_plate_triangles':24,'raw_preserved':True,'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
