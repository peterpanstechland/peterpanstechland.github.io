#!/usr/bin/env python3
"""Extract real plant/planter/grass triangles from the off-target Tripo kiosk.

No geometry, UVs or image pixels are invented. A source-hash-locked topology
selection removes the generated building and its floor. Structural checks do
not replace the required multi-angle visual review.
"""
from __future__ import annotations

import argparse
from collections import Counter
import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import numpy as np

from clean_tree_asset import components, encode_glb
from inspect_tripo_glb import Inspector, ROOT
from prepare_roller_shutter import boundary_edges

SOURCE = ROOT / 'assets/tripo/raw/tripo-out/12-plants-grass-14dc3618/model.glb'
SOURCE_SHA256 = '8ff32a33e446cd5718242f28df4957a804233a03ebe001e53f325493f68fdf18'
TASK_ID = '14dc3618-4de8-4bee-959b-3a807a17bdbb'
MANIFEST = ROOT / 'PeterPansTechland_Tripo_Generation_Pack/manifest.json'
OUTPUT = ROOT / 'assets/tripo/processed/12_plants_grass.glb'
RECORD = ROOT / 'assets/tripo/records/12_plants_grass.processed.record.json'
QA = ROOT / 'assets/tripo/records/12_plants_grass.processed.qa.json'
ROTATION = np.array([[0., 0., -1.], [0., 1., 0.], [1., 0., 0.]])


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def prepare(output, record_file, qa_file):
    require(output.resolve() != SOURCE.resolve(), 'Raw source cannot be overwritten')
    require(sha(SOURCE.read_bytes()) == SOURCE_SHA256, 'Source hash differs from reviewed kiosk')
    source = Inspector(SOURCE, '12_plants_grass', MANIFEST)
    raw_qa = source.run()
    require(raw_qa['status'] == 'passed_implemented_checks', 'Source structural inspection failed')
    require(len(source.doc['meshes']) == len(source.doc['nodes']) == 1, 'Expected one source mesh/node')
    primitive = source.doc['meshes'][0]['primitives'][0]
    require(len(source.doc['meshes'][0]['primitives']) == 1 and primitive.get('mode', 4) == 4, 'Expected one source triangle primitive')
    require(set(primitive['attributes']) == {'POSITION', 'NORMAL', 'TEXCOORD_0'}, 'Unexpected source attributes')
    require(not source.doc.get('skins') and not source.doc.get('animations'), 'Expected static source')
    positions = source.accessor(primitive['attributes']['POSITION']).astype(np.float64)
    normals = source.accessor(primitive['attributes']['NORMAL']).astype(np.float64)
    uv = source.accessor(primitive['attributes']['TEXCOORD_0']).copy()
    faces = source.accessor(primitive['indices']).reshape(-1, 3)
    require(len(faces) == 5168, 'Source topology changed')
    eligible = np.flatnonzero(positions[faces, 1].mean(axis=1) > -.34)
    groups = components(positions, faces[eligible])
    selections = []
    for group in groups:
        lo, hi = np.array(group['min']), np.array(group['max'])
        planter = (group['triangle_count'] == 1157 and np.allclose(lo, [.05054355, -.34097511, .21162114], atol=1e-6)
                   and np.allclose(hi, [.43828595, .09965761, .5], atol=1e-6))
        grass = (group['triangle_count'] == 122 and np.allclose(lo, [.32439110, -.34151360, .01394957], atol=1e-6)
                 and np.allclose(hi, [.46858776, -.30760768, .22850828], atol=1e-6))
        detached_leaf = group['triangle_count'] == 4 and lo[0] > .2 and lo[1] > -.15 and lo[2] > .38 and hi[1] < .02
        if planter or grass or detached_leaf:
            selections.append((group, 'PLANTER_AND_CLUSTER' if planter else 'GRASS_PATCH' if grass else 'DETACHED_LEAF'))
    require(sorted(group['triangle_count'] for group, _ in selections) == [4, 4, 4, 122, 1157], 'Reviewed botanical components are not unique')
    selected_indices = np.sort(np.concatenate([eligible[g['face_indices']] for g, _ in selections]))
    selected = faces[selected_indices]
    used, remapped = np.unique(selected, return_inverse=True)
    matrix = source.local_matrix(source.doc['nodes'][0])
    world = positions[used]@matrix[:3, :3].T+matrix[:3, 3]
    rotated = world@ROTATION.T
    lo, hi = rotated.min(axis=0), rotated.max(axis=0)
    ground = np.array([(lo[0]+hi[0])/2, lo[1], (lo[2]+hi[2])/2])
    factor = .8/(hi[1]-lo[1])
    transformed = ((rotated-ground)*factor).astype('<f4')
    normal_matrix = np.linalg.inv(ROTATION@matrix[:3, :3]).T
    transformed_normals = normals[used]@normal_matrix.T
    transformed_normals /= np.linalg.norm(transformed_normals, axis=1)[:, None]
    doc = copy.deepcopy(source.doc)
    binary = bytearray(source.buffers[0])

    def accessor(values, kind, component=5126):
        values = np.ascontiguousarray(values)
        binary.extend(b'\0'*(-len(binary) % 4))
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
        binary.extend(values.tobytes())
        entry = {'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind}
        if kind == 'VEC3':
            entry.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
        index = len(doc['accessors'])
        doc['accessors'].append(entry)
        return index

    attributes = {'POSITION': accessor(transformed, 'VEC3'), 'NORMAL': accessor(transformed_normals.astype('<f4'), 'VEC3'),
                  'TEXCOORD_0': accessor(uv[used].astype('<f4'), 'VEC2')}
    indices = accessor(remapped.ravel().astype('<u4'), 'SCALAR', 5125)
    doc['meshes'] = [{'name': 'REAL_EXTRACTED_PLANTER_CLUSTER_AND_GRASS', 'primitives': [{'attributes': attributes, 'indices': indices, 'mode': 4, 'material': primitive['material']}]}]
    doc['nodes'] = [{'name': 'PLANTS_GRASS_ROOT', 'mesh': 0, 'extras': {'sourceTaskId': TASK_ID, 'sourceGeometry': '1291 original Tripo triangles; no generated replacement geometry', 'frontAxis': '+Z'}}]
    doc['scenes'] = [{'name': 'Extracted real Tripo plants', 'nodes': [0]}]
    doc['scene'] = 0
    doc['buffers'][0]['byteLength'] = len(binary)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encode_glb(doc, bytes(binary)))
    final = Inspector(output, '12_plants_grass', MANIFEST)
    qa = final.run()
    require(qa['status'] == 'passed_implemented_checks', 'Extracted structural inspection failed')
    require(abs(qa['world_bounds']['size_xyz'][1]-.8)<1e-6, 'Target height failed')
    require(np.linalg.norm(qa['world_bounds']['ground_center_y_up'])<1e-6, 'Bottom-center pivot failed')
    require([i['sha256'] for i in qa['images']] == [i['sha256'] for i in raw_qa['images']], 'Source textures changed')
    require(np.array_equal(final.accessor(attributes['TEXCOORD_0']), uv[used]), 'Source UVs changed')
    require(np.array_equal(used[final.accessor(indices).ravel()].reshape(-1, 3), selected), 'Source triangle identity changed')
    require(sha(SOURCE.read_bytes()) == SOURCE_SHA256, 'Source changed')
    boundary, _, nonmanifold = boundary_edges(transformed[remapped.reshape(-1, 3)])
    # Distinguish pre-existing source seams from the floor-removal boundary.
    unique_source, source_weld = np.unique(np.round(positions, 6), axis=0, return_inverse=True)
    def edge_counts(triangles):
        return Counter(tuple(sorted(edge)) for a,b,c in source_weld[triangles] for edge in ((a,b),(b,c),(c,a)) if edge[0] != edge[1])
    source_edges, selected_edges = edge_counts(faces), edge_counts(selected)
    new_boundary = [edge for edge,count in selected_edges.items() if count == 1 and source_edges[edge] >= 2]
    old_boundary = [edge for edge,count in selected_edges.items() if count == 1 and source_edges[edge] == 1]
    boundary_y = unique_source[np.array(new_boundary).ravel(), 1]
    require(np.max(boundary_y) < -.338 and np.min(boundary_y) > -.342, 'Extraction creates a boundary above the original floor band')
    verification = {'original_source_triangles': 5168, 'retained_source_triangles': len(selected), 'removed_triangles': len(faces)-len(selected),
                    'new_geometry_triangles': 0, 'original_uvs_exact': True, 'original_texture_bytes_exact': True,
                    'source_face_indices': selected_indices.tolist(), 'boundary_edges_at_1e_6_m_weld': len(boundary), 'nonmanifold_edges_at_1e_6_m_weld': nonmanifold,
                    'new_boundary_edges_at_source_weld': len(new_boundary), 'preexisting_boundary_edges_at_source_weld': len(old_boundary),
                    'new_boundary_source_y_range': [float(boundary_y.min()), float(boundary_y.max())],
                    'all_new_boundaries_confined_to_original_floor_band': True}
    record = {'created_at_utc': datetime.now(timezone.utc).isoformat(), 'source_task_id': TASK_ID, 'source_file': str(SOURCE), 'source_sha256': SOURCE_SHA256,
              'processed_file': str(output.resolve()), 'processed_sha256': sha(output.read_bytes()), 'processor': 'tools/clean_plants_asset.py',
              'method': 'Remove triangles centered at/below source Y=-0.34, then retain only five source-hash-locked plant/planter/grass components; no remesh, no new caps, no texture edit',
              'selection': [{k:v for k,v in g.items() if k != 'face_indices'}|{'role': role} for g, role in selections],
              'transforms': {'rotation_y_radians': -np.pi/2, 'uniform_scale_after_original_node': factor, 'bottom_center_before_scale': ground.tolist(), 'height_m': .8},
              'verification': verification, 'world_bounds': qa['world_bounds'], 'visual_review': 'PENDING_MULTI_ANGLE_BROWSER_REVIEW', 'qa_approved': False,
              'limitations': ['Original generation was off-target architecture, not an acceptable complete plants asset.', 'Retained botanical geometry requires review of underside and planter completeness.', 'Floor removal leaves 34 open lower edges in the original floor band, plus 2 pre-existing open edges; not a watertight printing mesh.', 'Original grass texture includes small dark/magenta fringe remnants near its bottom edge.', 'Uniform height normalization preserves original proportions, so width/depth differ from manifest targets.'],
              'additional_paid_calls': 0}
    qa['extraction_verification'] = verification
    qa['visual_review'] = record['visual_review']
    for path, data in ((record_file, record), (qa_file, qa)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    return {'output': str(output), 'triangles': len(selected), 'bounds': qa['world_bounds'], 'boundary_edges': len(boundary), 'status': record['visual_review']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--record', type=Path, default=RECORD)
    parser.add_argument('--qa', type=Path, default=QA)
    args = parser.parse_args()
    print(json.dumps(prepare(args.output, args.record, args.qa), ensure_ascii=False))
