#!/usr/bin/env python3
"""Remove the isolated unwanted sign from the real Tripo tree, without remeshing.

The raw GLB is immutable. The isolated sign component includes a touching leaf
cluster, which is preserved by a face-graph partition using verified spatial
seeds and source texture colours. Only original triangle indices are removed.
No new tree geometry, UVs, texture pixels, or cut surfaces are invented.
"""
from __future__ import annotations

import argparse
from collections import deque
import copy
from datetime import datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import struct

import numpy as np
from PIL import Image

from inspect_tripo_glb import Inspector, ROOT


SOURCE = ROOT / "assets/tripo/raw/tripo-out/11-tree-f83af78c/model.glb"
SOURCE_SHA256 = "2b96429f4aca028b01c8375d124734a64d78ca80b612a09da46d3717399f56b1"
TASK_ID = "f83af78c-7c37-48c0-8de7-e2706f983982"
OUTPUT = ROOT / "assets/tripo/processed/11_tree.glb"
RECORD = ROOT / "assets/tripo/records/11_tree.processed.record.json"
QA = ROOT / "assets/tripo/records/11_tree.processed.qa.json"
DIAGNOSTICS = ROOT / "assets/tripo/preview/models"
MANIFEST = ROOT / "PeterPansTechland_Tripo_Generation_Pack/manifest.json"
TARGET_HEIGHT = 2.2
WELD_DECIMALS = 6
ROTATION = np.array([[0., 0., -1.], [0., 1., 0.], [1., 0., 0.]])


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def components(positions, faces):
    """Find shared-position connected components; UV seams are not cuts."""
    _, inverse = np.unique(np.round(positions, WELD_DECIMALS), axis=0, return_inverse=True)
    parent = np.arange(int(inverse.max()) + 1)

    def root(value):
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    for a, b, c in inverse[faces]:
        for other in (b, c):
            left, right = root(a), root(other)
            if left != right:
                parent[right] = left
    labels = np.array([root(int(value)) for value in inverse[faces[:, 0]]])
    result = []
    for label in np.unique(labels):
        indices = np.flatnonzero(labels == label)
        points = positions[faces[indices]].reshape(-1, 3)
        result.append({
            "component_label": int(label),
            "face_indices": indices,
            "triangle_count": len(indices),
            "min": points.min(axis=0).tolist(),
            "max": points.max(axis=0).tolist(),
        })
    return sorted(result, key=lambda item: -item["triangle_count"])


def partition_sign_component(source, positions, uv, faces, group):
    """Separate the attached leaves at their narrow connection to the sign."""
    original_indices = group["face_indices"]
    selected = faces[original_indices]
    centers = positions[selected].mean(axis=1)
    image = np.asarray(Image.open(io.BytesIO(bytes(source.view(source.doc["images"][0]["bufferView"])[1]))).convert("RGB")).astype(float)
    sample_uv = uv[selected].mean(axis=1)
    colours = image[
        np.minimum((sample_uv[:, 1] * image.shape[0]).astype(int), image.shape[0] - 1),
        np.minimum((sample_uv[:, 0] * image.shape[1]).astype(int), image.shape[1] - 1),
    ]
    _, welded = np.unique(np.round(positions, WELD_DECIMALS), axis=0, return_inverse=True)
    count = len(selected)
    start, end = count, count + 1
    graph = [[] for _ in range(count + 2)]
    edge_faces, adjacency = {}, []

    def add_edge(a, b, capacity):
        graph[a].append([b, float(capacity), len(graph[b])])
        graph[b].append([a, 0., len(graph[a]) - 1])

    for index, face in enumerate(welded[selected]):
        for a, b in ((0, 1), (1, 2), (2, 0)):
            key = tuple(sorted((int(face[a]), int(face[b]))))
            length = float(np.linalg.norm(positions[selected[index, a]] - positions[selected[index, b]]))
            if key in edge_faces:
                other = edge_faces[key]
                difference = np.linalg.norm(colours[index] - colours[other]) / 255
                capacity = max(.00001, length * math.exp(-difference * 5))
                add_edge(index, other, capacity)
                add_edge(other, index, capacity)
                adjacency.append((index, other, length))
            else:
                edge_faces[key] = index
    # These source-object-space seed regions were checked in separate GLB views.
    leaf = ((centers[:, 0] < .24) & (centers[:, 1] > .04)) | (centers[:, 1] > .165)
    metal = (centers[:, 1] < .04) | (centers[:, 2] > .06)
    require(not np.any(leaf & metal), "Ambiguous semantic seeds")
    for index in range(count):
        if leaf[index]:
            add_edge(start, index, 1000000)
        if metal[index]:
            add_edge(index, end, 1000000)
    while True:
        level = [-1] * len(graph)
        level[start] = 0
        queue = deque([start])
        while queue:
            a = queue.popleft()
            for b, capacity, _ in graph[a]:
                if capacity > 1e-12 and level[b] < 0:
                    level[b] = level[a] + 1
                    queue.append(b)
        if level[end] < 0:
            break
        pointer = [0] * len(graph)

        def push(a, flow):
            if a == end:
                return flow
            while pointer[a] < len(graph[a]):
                edge = graph[a][pointer[a]]
                b, capacity, reverse = edge
                if capacity > 1e-12 and level[b] == level[a] + 1:
                    amount = push(b, min(flow, capacity))
                    if amount > 1e-12:
                        edge[1] -= amount
                        graph[b][reverse][1] += amount
                        return amount
                pointer[a] += 1
            return 0

        while push(start, 1000000) > 1e-12:
            pass
    reachable = {start}
    queue = deque([start])
    while queue:
        for b, capacity, _ in graph[queue.popleft()]:
            if capacity > 1e-12 and b not in reachable:
                reachable.add(b)
                queue.append(b)
    preserve = np.array([index in reachable for index in range(count)])
    require(int(preserve.sum()) == 243, "Partition changed from the visually checked 243-face leaf cluster")
    cut_lengths = [length for a, b, length in adjacency if preserve[a] != preserve[b]]
    metadata = {
        "source_component_triangles": count,
        "preserved_attached_leaf_triangles": int(preserve.sum()),
        "removed_sign_triangles": int((~preserve).sum()),
        "leaf_seed_faces": int(leaf.sum()),
        "sign_seed_faces": int(metal.sum()),
        "leaf_seed_region": "(centroid.x < 0.24 and centroid.y > 0.04) or centroid.y > 0.165",
        "sign_seed_region": "centroid.y < 0.04 or centroid.z > 0.06",
        "seed_coordinate_space": "Original unscaled mesh coordinates",
        "graph_cost": "max(0.00001, shared-edge length * exp(-5 * RGB-distance/255)); exact source base-colour samples at UV centroids",
        "cut_shared_edges": len(cut_lengths),
        "cut_edge_total_length_source_units": sum(cut_lengths),
        "preserved_leaf_original_face_indices": original_indices[preserve].tolist(),
        "removed_sign_original_face_indices": original_indices[~preserve].tolist(),
    }
    return original_indices[~preserve], metadata


def inspect_source():
    require(sha256(SOURCE.read_bytes()) == SOURCE_SHA256, "Source differs from the visually reviewed Tripo output")
    source = Inspector(SOURCE, "11_tree", MANIFEST)
    source.container()
    doc = source.doc
    require(len(doc["meshes"]) == len(doc["nodes"]) == 1, "Expected a single static source mesh/node")
    require(not doc.get("skins") and not doc.get("animations"), "Unexpected skin or animation")
    require(len(doc["meshes"][0]["primitives"]) == 1, "Expected one source primitive")
    primitive = doc["meshes"][0]["primitives"][0]
    require(primitive.get("mode", 4) == 4 and not primitive.get("targets"), "Expected plain triangles")
    require(set(primitive["attributes"]) == {"POSITION", "NORMAL", "TEXCOORD_0"}, "Unexpected source vertex attributes")
    positions = source.accessor(primitive["attributes"]["POSITION"]).astype(np.float64)
    normals = source.accessor(primitive["attributes"]["NORMAL"]).astype(np.float64)
    uv = source.accessor(primitive["attributes"]["TEXCOORD_0"]).copy()
    faces = source.accessor(primitive["indices"]).astype(np.int64).reshape(-1, 3)
    matrix = np.array(doc["nodes"][0]["matrix"]).reshape(4, 4).T
    require(np.allclose(matrix, np.diag([1.2000000476837158] * 3 + [1.])), "Unexpected source node transform")
    groups = components(positions, faces)
    require(len(groups) == 7 and len(faces) == 9311, "Source component topology changed")
    candidates = [
        group for group in groups
        if group["triangle_count"] == 825
        and np.allclose(group["min"], [.13541, -.48211, -.24676], atol=1e-5)
        and np.allclose(group["max"], [.30171, .20536, .20699], atol=1e-5)
    ]
    require(len(candidates) == 1, "The visually selected sign component is not unique")
    removed, separation = partition_sign_component(source, positions, uv, faces, candidates[0])
    keep = np.ones(len(faces), dtype=bool)
    keep[removed] = False
    require(keep.sum() == 8729, "Unexpected retained triangle count")
    return source, positions, normals, uv, faces, matrix, groups, candidates[0], keep, separation


def encode_glb(document, binary):
    data = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    data += b" " * (-len(data) % 4)
    binary += b"\0" * (-len(binary) % 4)
    size = 12 + 8 + len(data) + 8 + len(binary)
    return struct.pack("<4sII", b"glTF", 2, size) + struct.pack("<II", len(data), 0x4E4F534A) + data + struct.pack("<II", len(binary), 0x004E4942) + binary


def export_subset(source, positions, normals, uv, selected_faces, matrix, output, name):
    used, remapped = np.unique(selected_faces.reshape(-1), return_inverse=True)
    original_positions = positions[used]
    world_positions = (matrix[:3, :3] @ original_positions.T).T + matrix[:3, 3]
    rotated = world_positions @ ROTATION.T
    low, high = rotated.min(axis=0), rotated.max(axis=0)
    ground_center = np.array([(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2])
    factor = TARGET_HEIGHT / (high[1] - low[1])
    transformed = ((rotated - ground_center) * factor).astype("<f4")
    transformed_normals = (normals[used] @ ROTATION.T).astype("<f4")
    source_doc = source.doc
    doc = copy.deepcopy(source_doc)
    doc["asset"]["generator"] = "Techland connected-component cleanup of an actual Tripo GLB"
    doc["bufferViews"], doc["accessors"] = [], []
    binary = bytearray()

    def add_view(payload, target=None):
        binary.extend(b"\0" * (-len(binary) % 4))
        index = len(doc["bufferViews"])
        view = {"buffer": 0, "byteOffset": len(binary), "byteLength": len(payload)}
        if target is not None:
            view["target"] = target
        doc["bufferViews"].append(view)
        binary.extend(payload)
        return index

    image_hashes = []
    for image in doc.get("images", []):
        require("bufferView" in image and "uri" not in image, "Expected embedded source textures")
        payload = bytes(source.view(image["bufferView"])[1])
        image_hashes.append(sha256(payload))
        image["bufferView"] = add_view(payload)

    def add_accessor(values, kind, component, target):
        values = np.ascontiguousarray(values)
        index = len(doc["accessors"])
        accessor = {"bufferView": add_view(values.tobytes(), target), "componentType": component, "count": len(values), "type": kind}
        if kind == "VEC3" and component == 5126:
            accessor["min"] = values.min(axis=0).tolist()
            accessor["max"] = values.max(axis=0).tolist()
        doc["accessors"].append(accessor)
        return index

    attributes = {
        "POSITION": add_accessor(transformed, "VEC3", 5126, 34962),
        "NORMAL": add_accessor(transformed_normals, "VEC3", 5126, 34962),
        "TEXCOORD_0": add_accessor(uv[used].astype("<f4"), "VEC2", 5126, 34962),
    }
    indices = add_accessor(remapped.astype("<u4"), "SCALAR", 5125, 34963)
    original_primitive = source_doc["meshes"][0]["primitives"][0]
    doc["meshes"] = [{"name": name, "primitives": [{"attributes": attributes, "indices": indices, "mode": 4, "material": original_primitive["material"]}]}]
    doc["nodes"] = [{"name": name, "mesh": 0}]
    doc["scenes"] = [{"name": name, "nodes": [0]}]
    doc["scene"] = 0
    doc["buffers"] = [{"byteLength": len(binary)}]
    doc["extras"] = {"source_task_id": TASK_ID, "local_postprocess": "Original triangle subset only; sign removed while preserving attached leaf cluster"}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encode_glb(doc, bytes(binary)))
    return {
        "output": str(output),
        "triangles": len(selected_faces),
        "vertices": len(used),
        "rotation_y_radians": -np.pi / 2,
        "source_node_matrix_column_major": matrix.T.reshape(-1).tolist(),
        "rotated_world_ground_center": ground_center.tolist(),
        "uniform_scale_after_source_node_transform": float(factor),
        "final_size_xyz_m": (transformed.max(axis=0) - transformed.min(axis=0)).tolist(),
        "final_ground_center": [float((transformed[:, 0].max() + transformed[:, 0].min()) / 2), float(transformed[:, 1].min()), float((transformed[:, 2].max() + transformed[:, 2].min()) / 2)],
        "embedded_image_sha256": image_hashes,
        "uv_values_preserved_exactly": bool(np.array_equal(uv[used], uv[used].astype("<f4"))),
        "materials_preserved_exactly": doc["materials"] == source_doc["materials"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--diagnostics", action="store_true", help="Export sign-only and retained-tree candidates for visual confirmation")
    parser.add_argument("--apply", action="store_true", help="Write the approved connected-component cleanup and QA record")
    args = parser.parse_args()
    source, positions, normals, uv, faces, matrix, groups, removed, keep, separation = inspect_source()
    record = {
        "asset_id": "11_tree",
        "source_task_id": TASK_ID,
        "source": str(SOURCE),
        "source_sha256": SOURCE_SHA256,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "Identify the sign-plus-leaves connected component after position welding to 6 decimals. Partition its face adjacency graph using visually checked geometric seeds and source texture-colour edge weights. Remove 582 sign faces and preserve the attached 243-face leaf cluster, all six other components, original UVs and all original textures. No replacement geometry.",
        "source_components": [{key: value for key, value in group.items() if key != "face_indices"} for group in groups],
        "source_sign_and_leaf_component": {key: value for key, value in removed.items() if key != "face_indices"},
        "face_graph_partition": separation,
        "removed_original_face_index_sha256": sha256(np.flatnonzero(~keep).astype("<u4").tobytes()),
        "retained_original_face_index_sha256": sha256(np.flatnonzero(keep).astype("<u4").tobytes()),
        "source_triangles": len(faces),
        "removed_triangles": int((~keep).sum()),
        "retained_triangles": int(keep.sum()),
        "original_triangle_partition_exact": len(faces) == int(keep.sum()) + int((~keep).sum()),
        "removed_sign_raw_object_bounds": {"min": positions[faces[~keep]].reshape(-1, 3).min(axis=0).tolist(), "max": positions[faces[~keep]].reshape(-1, 3).max(axis=0).tolist()},
        "raw_front_direction": "+X, visually checked",
        "output_front_direction": "+Z",
        "target_height_m": TARGET_HEIGHT,
        "texture_method": "Original embedded images copied byte-for-byte; original UV values and material definitions retained",
        "limitations": ["Source leaf clusters remain stylized, rather than botanically reconstructed.", "The tree is uniformly scaled to 2.2 m height; its width/depth retain the source proportions and need scene placement clearance.", "The nine-edge face-graph separation at the leaf/sign contact is not capped; this is a rendering asset, not a certified watertight print mesh."],
    }
    if args.diagnostics:
        record["diagnostics"] = [
            export_subset(source, positions, normals, uv, faces[~keep], matrix, DIAGNOSTICS / "11-tree-removed-sign.glb", "REMOVED_SIGN_ONLY"),
            export_subset(source, positions, normals, uv, faces[keep], matrix, DIAGNOSTICS / "11-tree-cleaned-candidate.glb", "TREE_CLEANED_CANDIDATE"),
        ]
    if args.apply:
        record["processed"] = export_subset(source, positions, normals, uv, faces[keep], matrix, OUTPUT, "TREE_WITH_PLANTER")
        qa = Inspector(OUTPUT, "11_tree", MANIFEST).run()
        require(qa["status"] == "passed_implemented_checks", "Processed GLB failed structure QA")
        require(qa["summary"]["triangle_count_sum_primitives"] == 8729, "Wrong processed triangle count")
        require(record["processed"]["embedded_image_sha256"] == [image["sha256"] for image in qa["images"]], "Embedded texture bytes changed")
        require(record["processed"]["materials_preserved_exactly"] and record["processed"]["uv_values_preserved_exactly"], "Source materials or UVs changed")
        require(np.allclose(record["processed"]["final_ground_center"], [0, 0, 0], atol=1e-6), "Output pivot is not bottom centered")
        require(abs(qa["world_bounds"]["size_xyz"][1] - TARGET_HEIGHT) < 1e-6, "Output height differs from 2.2 m")
        require(sha256(SOURCE.read_bytes()) == SOURCE_SHA256, "Raw source was modified")
        QA.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        record["qa_report"] = str(QA)
        record["qa_status"] = qa["status"]
        record["raw_unchanged"] = True
    RECORD.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"record": str(RECORD), "applied": args.apply, "removed_triangles": record["removed_triangles"], "retained_triangles": record["retained_triangles"], "output": str(OUTPUT) if args.apply else None}))


if __name__ == "__main__":
    main()
