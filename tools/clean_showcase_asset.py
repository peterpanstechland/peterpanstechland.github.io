#!/usr/bin/env python3
"""Remove unwanted display contents from the actual Tripo cabinet geometry.

The raw GLB is immutable. This processes real triangles and preserves source
UVs/materials/images; it never substitutes a newly modeled cabinet.
"""
from __future__ import annotations

import argparse
import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import numpy as np

from inspect_tripo_glb import Inspector, ROOT
from prepare_roller_shutter import area, encode_glb, make_caps, polygon_triangles, require, split_polygon


SOURCE = ROOT / 'assets/tripo/raw/tripo-out/06-showcase-zone-2c13d6cc/model.glb'
OUTPUT = ROOT / 'assets/tripo/processed/06_showcase_zone.glb'
RECORD = ROOT / 'assets/tripo/records/06_showcase_zone.processed.record.json'
QA = ROOT / 'assets/tripo/records/06_showcase_zone.processed.qa.json'
MANIFEST = ROOT / 'PeterPansTechland_Tripo_Generation_Pack/manifest.json'
TASK_ID = '2c13d6cc-55af-4635-817f-a4bba1cb7b7c'
TARGET = np.array([2.2, 2.35, .6])


def components(vertices, indices):
    _, inverse = np.unique(np.rint(vertices[:, :3] / 1e-6).astype(np.int64), axis=0, return_inverse=True)
    parent = np.arange(inverse.max() + 1)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for face in inverse[indices]:
        first = find(face[0])
        for second in face[1:]:
            parent[find(second)] = first
    groups = {}
    for index, face in enumerate(inverse[indices]):
        groups.setdefault(find(face[0]), []).append(index)
    result = []
    for group in groups.values():
        points = vertices[np.unique(indices[group]), :3]
        result.append({'source_triangle_indices': group, 'triangles': len(group), 'min': points.min(0).tolist(), 'max': points.max(0).tolist()})
    return sorted(result, key=lambda item: -item['triangles'])


def outside_box(polygon, low, high):
    """Return actual source polygon fragments outside the specified volume."""
    positions = np.array(polygon)[:, :3]
    if np.any(positions.max(0) <= np.array(low)) or np.any(positions.min(0) >= np.array(high)):
        return [polygon], []
    kept = []
    current = polygon
    for axis in range(3):
        below, current = split_polygon(current, axis, low[axis])
        if below:
            kept.append(below)
        current, above = split_polygon(current, axis, high[axis])
        if above:
            kept.append(above)
        if not current:
            break
    return kept, current


def clean(source=SOURCE, output=OUTPUT, record_path=RECORD, qa_path=QA):
    require(source.resolve() != output.resolve(), 'Raw source cannot be overwritten')
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    original = Inspector(source, '06_showcase_zone', MANIFEST)
    source_qa = original.run()
    require(source_qa['status'] == 'passed_implemented_checks', 'Source GLB did not pass implemented checks')
    doc = original.doc
    require(len(doc['nodes']) == 1 and len(doc['meshes']) == 1 and len(doc['meshes'][0]['primitives']) == 1, 'Unexpected source structure')
    primitive = doc['meshes'][0]['primitives'][0]
    require(set(primitive['attributes']) == {'POSITION', 'NORMAL', 'TEXCOORD_0'}, 'Unsupported source attributes')
    require(not doc.get('skins') and not doc.get('animations'), 'Expected a static cabinet')
    attributes = primitive['attributes']
    positions = original.accessor(attributes['POSITION']).astype(np.float64)
    normals = original.accessor(attributes['NORMAL']).astype(np.float64)
    uv = original.accessor(attributes['TEXCOORD_0']).astype(np.float64)
    indices = original.accessor(primitive['indices']).ravel().astype(np.int64).reshape(-1, 3)
    matrix = original.local_matrix(doc['nodes'][0])
    turn = np.array([[0., 0., -1.], [0., 1., 0.], [1., 0., 0.]])
    rotated = (positions @ matrix[:3, :3].T + matrix[:3, 3]) @ turn.T
    low, high = rotated.min(0), rotated.max(0)
    scaling = TARGET / (high - low)
    normalized = (rotated - (low + high) / 2) * scaling + [0., TARGET[1] / 2, 0.]
    normal_matrix = np.linalg.inv(np.diag(scaling) @ turn @ matrix[:3, :3]).T
    normals = normals @ normal_matrix.T
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    vertices = np.column_stack((normalized, normals, uv))
    source_triangles = vertices[indices]
    source_components = components(vertices, indices)

    # Bounds follow the visible true cabinet apertures. Back panel, uprights,
    # shelf slabs and the bottom lockers remain outside these removal volumes.
    # Keep a margin around the generated uprights: their inner faces are
    # visibly warped, so the nominal aperture edges are not safe cut planes.
    columns = [(-.960, -.430), (-.250, .250), (.435, .960)]
    rows = [(.572, 1.035), (1.146, 1.560), (1.670, 2.255)]
    volumes = [{'low': [left, floor, -.078], 'high': [right, ceiling, .34], 'column': column, 'row': row}
               for row, (floor, ceiling) in enumerate(rows)
               for column, (left, right) in enumerate(columns)]
    # A narrow red generated prop sits outside the robot's main aperture crop.
    # Its front-only cut keeps the warped vertical divider behind it intact.
    volumes.append({'low': [.250, 1.665, 0.0], 'high': [.307, 1.89, .34], 'column': 1, 'row': 2, 'purpose': 'Remove narrow loose red prop beside upper middle divider'})
    detached_removed = set()
    for component in source_components[1:]:
        center = (np.array(component['min']) + component['max']) / 2
        if any(np.all(center > volume['low']) and np.all(center < volume['high']) for volume in volumes):
            detached_removed.update(component['source_triangle_indices'])

    kept, discarded = [], []
    errors = []
    affected_source = 0
    for index, triangle in enumerate(source_triangles):
        if index in detached_removed:
            discarded.append(triangle)
            affected_source += 1
            errors.append(0.)
            continue
        polygons = [list(triangle)]
        removed = []
        for volume in volumes:
            next_polygons = []
            for polygon in polygons:
                remaining, inside = outside_box(polygon, volume['low'], volume['high'])
                next_polygons.extend(remaining)
                if inside:
                    removed.extend(polygon_triangles(inside))
            polygons = next_polygons
        retained = [t for polygon in polygons for t in polygon_triangles(polygon)]
        if removed:
            affected_source += 1
        kept.extend(retained)
        discarded.extend(removed)
        errors.append(abs(area(triangle) - sum(area(t) for t in retained) - sum(area(t) for t in removed)))
    require(max(errors) < 1e-9, 'Clipping did not preserve source area accounting')
    require(kept and discarded, 'Cleanup unexpectedly kept or removed everything')
    caps, cap_report = make_caps(kept, [(1, floor, 1) for floor, _ in rows])

    result = copy.deepcopy(doc)
    binary = bytearray(original.buffers[0])
    result['nodes'] = [{'name': 'SHOWCASE_EMPTY_CABINET', 'mesh': 0,
                        'extras': {'sourceTaskId': TASK_ID, 'geometryOrigin': 'Retained and clipped original Tripo cabinet triangles', 'removedContents': 'Generated robots and loose shelf props', 'frontAxis': '+Z', 'qaStatus': 'See separate structural and browser review records'}}]
    result['scenes'] = [{'name': 'Techland actual empty showcase candidate', 'nodes': [0]}]
    result['scene'] = 0
    result['meshes'] = []

    def accessor(array, kind, component=5126):
        binary.extend(b'\0' * (-len(binary) % 4))
        payload = array.tobytes()
        view = len(result['bufferViews'])
        result['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(payload)})
        binary.extend(payload)
        item = {'bufferView': view, 'componentType': component, 'count': len(array), 'type': kind}
        if kind == 'VEC3':
            item.update(min=array.min(0).tolist(), max=array.max(0).tolist())
        result['accessors'].append(item)
        return len(result['accessors']) - 1

    def encode_primitive(triangles, material):
        lookup, unique, ix = {}, [], []
        for triangle in triangles:
            for value in triangle:
                vertex = value.copy()
                vertex[3:6] /= np.linalg.norm(vertex[3:6])
                vertex = vertex.astype('<f4')
                key = vertex.tobytes()
                if key not in lookup:
                    lookup[key] = len(unique)
                    unique.append(vertex)
                ix.append(lookup[key])
        data = np.array(unique, dtype='<f4')
        return {'attributes': {'POSITION': accessor(np.ascontiguousarray(data[:, :3]), 'VEC3'), 'NORMAL': accessor(np.ascontiguousarray(data[:, 3:6]), 'VEC3'), 'TEXCOORD_0': accessor(np.ascontiguousarray(data[:, 6:8]), 'VEC2')},
                'indices': accessor(np.array(ix, dtype='<u4'), 'SCALAR', 5125), 'material': material, 'mode': 4}

    primitives = [encode_primitive(kept, primitive.get('material', 0))]
    if caps:
        material = len(result['materials'])
        result['materials'].append({'name': 'LOCAL_OBJECT_FOOTPRINT_CUT_CAP', 'pbrMetallicRoughness': {'baseColorFactor': [.075, .055, .085, 1], 'roughnessFactor': .8, 'metallicFactor': .2}, 'extras': {'authorship': 'Local planar cap of actual removed-object cross section'}})
        primitives.append(encode_primitive(caps, material))
    result['meshes'].append({'name': 'SHOWCASE_RETAINED_SOURCE', 'primitives': primitives})
    result['buffers'][0]['byteLength'] = len(binary)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encode_glb(result, bytes(binary)))
    processed = Inspector(output, '06_showcase_zone', MANIFEST)
    qa = processed.run()
    require(qa['status'] == 'passed_implemented_checks', 'Processed structure validation failed')
    require(np.allclose(qa['world_bounds']['size_xyz'], TARGET, atol=2e-6), 'Cabinet exterior bounds changed')
    require(np.linalg.norm(qa['world_bounds']['ground_center_y_up']) < 2e-6, 'Cabinet bottom-center changed')
    require([image['sha256'] for image in qa['images']] == [image['sha256'] for image in source_qa['images']], 'Source image data changed')
    require(hashlib.sha256(source.read_bytes()).hexdigest() == source_hash, 'Raw GLB changed')
    summary = {'source_triangles': len(source_triangles), 'retained_clipped_triangles': len(kept), 'removed_clipped_triangles': len(discarded), 'affected_source_triangles': affected_source,
               'detached_prop_source_triangles_removed': len(detached_removed), 'local_footprint_cap_triangles': len(caps), 'maximum_source_triangle_area_accounting_error_m2': max(errors),
               'retained_source_area_m2': sum(area(t) for t in kept), 'removed_source_area_m2': sum(area(t) for t in discarded), 'source_texture_images_unchanged': True}
    qa['cleanup'] = summary
    qa['visual_review'] = 'PENDING_BROWSER_REVIEW'
    qa['qa_approved'] = False
    record = {'created_at_utc': datetime.now(timezone.utc).isoformat(), 'source_task_id': TASK_ID, 'source_file': str(source.resolve()), 'source_sha256': source_hash,
              'processed_file': str(output.resolve()), 'processed_sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'processor': 'tools/clean_showcase_asset.py', 'additional_paid_calls': 0,
              'operations': ['Bake source node transform', 'Rotate Y -90 degrees to front +Z', 'Fit actual cabinet to 2.2 x 2.35 x 0.6 meters and bottom-center', 'Remove actual source geometry inside measured open cabinet cells', 'Remove disconnected loose prop component', 'Preserve source UVs, material definitions and all embedded texture bytes', 'Cap safe actual object footprint cuts only'],
              'source_axis_scale_after_rotation': scaling.tolist(), 'source_components': [{key: value for key, value in component.items() if key != 'source_triangle_indices'} for component in source_components],
              'removal_volumes_m': volumes, 'geometry_accounting': summary, 'cut_caps': cap_report,
              'limitations': ['This is a geometrically edited real Tripo cabinet, not a new generated asset.', 'Textures may retain baked object shadows after geometry removal.', 'Small foot remnants or cut boundaries require front and oblique browser acceptance.', 'No watertightness claim; open or branched cut contours are recorded.'],
              'browser_review': 'pending', 'qa_approved': False}
    for path, value in [(record_path, record), (qa_path, qa)]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    return {'output': str(output.resolve()), 'status': 'CANDIDATE_REQUIRES_VISUAL_ACCEPTANCE', **summary, 'uncapped_contours': len(cap_report['uncapped_cut_contours'])}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--record', type=Path, default=RECORD)
    parser.add_argument('--qa', type=Path, default=QA)
    arguments = parser.parse_args()
    print(json.dumps(clean(arguments.source, arguments.output, arguments.record, arguments.qa), ensure_ascii=False))
