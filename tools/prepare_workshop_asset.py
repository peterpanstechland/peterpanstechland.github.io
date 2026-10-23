"""Fit a verified Tripo GLB to a workshop display envelope; retain the raw file.

Only adds a parent transform and provenance metadata. Meshes and embedded image
bytes are copied unchanged. The result is a display asset, not mechanical CAD.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

import numpy as np
from inspect_tripo_glb import Inspector


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--asset-id', required=True)
    parser.add_argument('--task-id', required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--front-rotation', type=float, default=-math.pi / 2)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        raise SystemExit('The source GLB must be preserved; use a separate output path.')
    inspector = Inspector(args.source, args.asset_id, args.manifest)
    report = inspector.run()
    if not report['ready_for_visual_review']:
        raise SystemExit('Source failed structural checks; no output written.')
    raw = args.source.read_bytes()
    offset, chunks = 12, []
    while offset < len(raw):
        length, kind = struct.unpack_from('<II', raw, offset)
        chunks.append((kind, raw[offset + 8: offset + 8 + length]))
        offset += 8 + length
    doc = inspector.doc
    low = np.array(report['world_bounds']['min'])
    high = np.array(report['world_bounds']['max'])
    angle = args.front_rotation
    rotation = np.array([[math.cos(angle), 0, math.sin(angle)], [0, 1, 0], [-math.sin(angle), 0, math.cos(angle)]])
    corners = np.array([[x, y, z] for x in [low[0], high[0]] for y in [low[1], high[1]] for z in [low[2], high[2]]]) @ rotation.T
    oriented_low, oriented_high = corners.min(axis=0), corners.max(axis=0)
    target = np.array(inspector.target['target_size_m_xyz'])
    scale = target / (oriented_high - oriented_low)
    center_bottom = (oriented_low + oriented_high) / 2
    center_bottom[1] = oriented_low[1]
    matrix = np.eye(4)
    matrix[:3, :3] = np.diag(scale) @ rotation
    matrix[:3, 3] = -center_bottom * scale
    scene = doc['scenes'][doc.get('scene', 0)]
    root_index = len(doc['nodes'])
    provenance = {'source': 'Tripo', 'task_id': args.task_id, 'raw_sha256': hashlib.sha256(raw).hexdigest(), 'postprocess': 'local root transform only', 'front_rotation_y': angle, 'display_envelope_m_xyz': target.tolist(), 'pivot': 'bottom centre', 'axis': 'Y up, +Z front', 'mechanical_cad': False}
    doc['nodes'].append({'name': args.asset_id + '_DISPLAY_ROOT', 'matrix': matrix.T.flatten().tolist(), 'children': scene['nodes'], 'extras': provenance})
    scene['nodes'] = [root_index]
    doc.setdefault('asset', {}).setdefault('extras', {})['workshop_provenance'] = provenance
    json_bytes = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf8')
    json_bytes += b' ' * (-len(json_bytes) % 4)
    packed = [(0x4E4F534A, json_bytes)] + [(kind, data) for kind, data in chunks if kind != 0x4E4F534A]
    body = b''.join(struct.pack('<II', len(data), kind) + data for kind, data in packed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body)
    result = Inspector(args.output, args.asset_id, args.manifest).run()
    if not result['ready_for_visual_review']:
        raise SystemExit('Output failed structural validation.')
    print(json.dumps({'asset_id': args.asset_id, 'output': str(args.output), 'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest(), 'size': result['world_bounds']['size_xyz'], 'bottom_center': result['world_bounds']['ground_center_y_up'], 'raw_mesh_and_images_unchanged': True}))


if __name__ == '__main__':
    main()
