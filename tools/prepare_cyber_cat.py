#!/usr/bin/env python3
"""Prepare the approved Tripo rig and add a locally authored beckoning clip.

No network calls. Original GLB buffers, nodes, skins, materials, and textures are
preserved; a common wrapper node and new animation data are appended. NumPy and
Pillow are supplied by the Codex bundled Python runtime.
"""
from __future__ import annotations

import argparse
import copy
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import struct

import numpy as np

from inspect_tripo_glb import Inspector, ROOT


SOURCE_TASK = "36e3dca6-efcb-428b-a335-ef2058d6786f"
RIG_TASK = "9c588a0c-d933-4d60-908a-b8ad5a5c1b72"
SOURCE = ROOT / "assets/tripo/raw/tripo-out/04-cyber-lucky-cat-blue-v6-rig-9c588a0c/model.glb"
OUTPUT = ROOT / "assets/tripo/processed/04_cyber_lucky_cat.glb"
MANIFEST = ROOT / "PeterPansTechland_Tripo_Generation_Pack/manifest.json"
RECORD = ROOT / "assets/tripo/records/04_cyber_lucky_cat.processed.record.json"
QA = ROOT / "assets/tripo/records/04_cyber_lucky_cat.processed.qa.json"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def quat_product(a, b):
    x, y, z, w = a
    u, v, s, t = b
    result = np.array([w*u + x*t + y*s - z*v,
                       w*v - x*s + y*t + z*u,
                       w*s + x*v - y*u + z*t,
                       w*t - x*u - y*v - z*s], dtype=np.float64)
    return result / np.linalg.norm(result)


def slerp(a, b, fraction):
    a, b = a.astype(np.float64), b.astype(np.float64)
    a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
    dot = float(a @ b)
    if dot < 0:
        b, dot = -b, -dot
    if dot > .9995:
        value = a + fraction * (b - a)
    else:
        theta = math.acos(max(-1., min(1., dot)))
        value = (math.sin((1-fraction)*theta)*a + math.sin(fraction*theta)*b) / math.sin(theta)
    return value / np.linalg.norm(value)


def evaluated_vertices(inspector, rotations=None):
    """CPU linear-blend skinning in scene world coordinates, including wrappers."""
    doc = inspector.doc
    nodes = doc["nodes"]
    parents = {child: ni for ni, node in enumerate(nodes) for child in node.get("children", [])}
    world = {}

    def matrix(ni):
        if ni not in world:
            node = nodes[ni]
            if rotations and ni in rotations:
                node = dict(node, rotation=rotations[ni].tolist())
            world[ni] = (matrix(parents[ni]) if ni in parents else np.eye(4)) @ inspector.local_matrix(node)
        return world[ni]

    scene = doc["scenes"][doc.get("scene", 0)]
    active, pending = set(), list(scene.get("nodes", []))
    while pending:
        ni = pending.pop()
        active.add(ni)
        pending.extend(nodes[ni].get("children", []))
    result = []
    for ni in sorted(active):
        node = nodes[ni]
        if "mesh" not in node:
            continue
        skin = doc["skins"][node["skin"]] if "skin" in node else None
        if skin:
            inverse = inspector.accessor(skin["inverseBindMatrices"]).reshape((-1, 4, 4)).transpose((0, 2, 1)).astype(np.float64) if "inverseBindMatrices" in skin else np.tile(np.eye(4), (len(skin["joints"]), 1, 1))
            palette = np.stack([matrix(joint) @ inverse[k] for k, joint in enumerate(skin["joints"])])
        for primitive in doc["meshes"][node["mesh"]]["primitives"]:
            attributes = primitive["attributes"]
            position = inspector.accessor(attributes["POSITION"]).astype(np.float64)
            homogeneous = np.column_stack((position, np.ones(len(position))))
            if skin:
                posed = np.zeros_like(homogeneous)
                total = np.zeros(len(position))
                index = 0
                while f"JOINTS_{index}" in attributes:
                    joints = inspector.accessor(attributes[f"JOINTS_{index}"]).astype(np.int64)
                    weights = inspector.accessor(attributes[f"WEIGHTS_{index}"]).astype(np.float64)
                    for component in range(4):
                        posed += np.einsum("nij,nj->ni", palette[joints[:, component]], homogeneous) * weights[:, component, None]
                    total += weights.sum(axis=1)
                    index += 1
                require(np.all(total > 0), "Cannot pose vertices without joint weights")
                xyz = posed[:, :3] / total[:, None]
            else:
                xyz = (homogeneous @ matrix(ni).T)[:, :3]
            if "indices" in primitive:
                drawn = np.unique(inspector.accessor(primitive["indices"]).ravel().astype(np.int64))
                xyz = xyz[drawn]
            require(np.isfinite(xyz).all(), "Nonfinite posed vertex")
            result.append(xyz)
    require(bool(result), "Scene has no evaluated geometry")
    return np.concatenate(result)


def bounds(vertices):
    low, high = vertices.min(axis=0), vertices.max(axis=0)
    return {"min": low.tolist(), "max": high.tolist(), "size_xyz": (high-low).tolist(),
            "ground_center_y_up": [float((low[0]+high[0])/2), float(low[1]), float((low[2]+high[2])/2)]}


def pack_glb(doc, binary):
    payload = json.dumps(doc, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    payload += b" " * (-len(payload) % 4)
    binary += b"\0" * (-len(binary) % 4)
    return (struct.pack("<4sII", b"glTF", 2, 28+len(payload)+len(binary))
            + struct.pack("<II", len(payload), 0x4E4F534A) + payload
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def prepare(source, output, record_path, qa_path, height):
    require(source.resolve() != output.resolve(), "Output must not overwrite raw source")
    original_bytes = source.read_bytes()
    original_hash = sha256(original_bytes)
    source_inspector = Inspector(source, "04_lucky_cat", MANIFEST)
    source_qa = source_inspector.run()
    require(not source_qa["errors"], f"Source failed inspection: {source_qa['errors']}")
    require(source_qa["skinning_data_validation"]["status"] == "passed", "Source must have validated skinning")
    require(all("uses skinning; deformed bounds are not evaluated" in item for item in source_qa["unsupported"]), "Source uses unsupported features beyond skin bounds")
    original = source_inspector.doc
    require(len(original.get("buffers", [])) == 1 and "uri" not in original["buffers"][0], "Expected one embedded source BIN buffer")
    require(len(original.get("scenes", [])) == 1, "Expected the approved single-scene rig")
    require(original["nodes"][18].get("name") == "bone_21", "Approved beckoning bone node 18 is not bone_21")
    require("matrix" not in original["nodes"][18], "Animation target must use TRS")
    require(not any(a.get("name") == "Techland_Beckon" for a in original.get("animations", [])), "Source already contains Techland_Beckon")

    raw_vertices = evaluated_vertices(source_inspector)
    raw_bounds = bounds(raw_vertices)
    require(height > 0 and math.isfinite(height), "Target height must be positive and finite")
    scale = height / raw_bounds["size_xyz"][1]
    root_quaternion = np.array([0., -math.sqrt(.5), 0., math.sqrt(.5)])
    rotation = source_inspector.local_matrix({"rotation": root_quaternion.tolist()})[:3, :3]
    # The browser established that source forward is +X. -90 degrees about Y maps it to +Z.
    translation = -(rotation @ np.asarray(raw_bounds["ground_center_y_up"])) * scale
    doc = copy.deepcopy(original)
    scene_index = doc.get("scene", 0)
    root_index = len(doc["nodes"])
    root_node = {"name": "TECHLAND_CYBER_CAT_ROOT", "children": list(doc["scenes"][scene_index]["nodes"]),
                 "translation": translation.tolist(), "rotation": root_quaternion.tolist(), "scale": [scale]*3}
    doc["nodes"].append(root_node)
    doc["scenes"][scene_index]["nodes"] = [root_index]

    base_quaternion = np.asarray(doc["nodes"][18]["rotation"], dtype=np.float64)
    base_quaternion /= np.linalg.norm(base_quaternion)
    times = np.array([0., .5, 1., 1.5, 2.], dtype="<f4")
    angles = [0., 12., 0., 12., 0.]
    quaternions = np.asarray([quat_product(base_quaternion, [0., 0., math.sin(math.radians(angle)/2), math.cos(math.radians(angle)/2)]) for angle in angles], dtype="<f4")
    binary = bytearray(source_inspector.buffers[0])

    def append_accessor(array, kind, extrema=False):
        binary.extend(b"\0" * (-len(binary) % 4))
        view_index = len(doc.setdefault("bufferViews", []))
        raw = array.tobytes()
        doc["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(raw)})
        binary.extend(raw)
        accessor = {"bufferView": view_index, "componentType": 5126, "count": len(array), "type": kind}
        if extrema:
            accessor.update(min=[float(array.min())], max=[float(array.max())])
        index = len(doc.setdefault("accessors", []))
        doc["accessors"].append(accessor)
        return index

    time_accessor = append_accessor(times, "SCALAR", True)
    quaternion_accessor = append_accessor(quaternions, "VEC4")
    animation = {"name": "Techland_Beckon", "samplers": [{"input": time_accessor, "output": quaternion_accessor, "interpolation": "LINEAR"}],
                 "channels": [{"sampler": 0, "target": {"node": 18, "path": "rotation"}}],
                 "extras": {"authorship": "Locally authored in tools/prepare_cyber_cat.py", "source_rig_provider": "Tripo", "source_rig_task_id": RIG_TASK,
                            "motion": "Original bone quaternion multiplied by local Z rotations 0,12,0,12,0 degrees", "loop_duration_seconds": 2.0}}
    doc.setdefault("animations", []).append(animation)
    doc["buffers"][0]["byteLength"] = len(binary)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(pack_glb(doc, bytes(binary)))

    processed = Inspector(output, "04_lucky_cat", MANIFEST)
    qa = processed.run()
    require(not qa["errors"], f"Processed GLB failed implemented checks: {qa['errors']}")
    require(qa["skinning_data_validation"]["status"] == "passed", "Processed skin data did not validate")
    require(all("uses skinning; deformed bounds are not evaluated" in item for item in qa["unsupported"]), "Processed GLB has unexpected unsupported features")
    pd = processed.doc
    require(pd["nodes"][:root_index] == original["nodes"], "Original nodes were changed")
    for collection in ("skins", "meshes", "materials", "textures", "images", "samplers"):
        require(pd.get(collection) == original.get(collection), f"Original {collection} changed")
    require(pd["bufferViews"][:len(original["bufferViews"])] == original["bufferViews"], "Original buffer views changed")
    require(pd["accessors"][:len(original["accessors"])] == original["accessors"], "Original accessors changed")
    require(processed.buffers[0][:len(source_inspector.buffers[0])] == source_inspector.buffers[0], "Source binary data was modified")
    require([item["sha256"] for item in source_qa["images"]] == [item["sha256"] for item in qa["images"]], "Embedded texture bytes changed")
    uv_checks = []
    for mi, mesh in enumerate(original["meshes"]):
        for pi, primitive in enumerate(mesh["primitives"]):
            for semantic, ref in primitive["attributes"].items():
                if semantic.startswith("TEXCOORD_"):
                    unchanged = np.array_equal(source_inspector.accessor(ref), processed.accessor(ref))
                    require(unchanged, "UV accessor changed")
                    uv_checks.append({"mesh": mi, "primitive": pi, "semantic": semantic, "accessor": ref, "unchanged": unchanged})

    stored_times = processed.accessor(time_accessor).ravel()
    stored_quaternions = processed.accessor(quaternion_accessor)
    norms = np.linalg.norm(stored_quaternions.astype(np.float64), axis=1)
    require(len(stored_times) == len(stored_quaternions) == 5, "Animation input/output count mismatch")
    require(np.isfinite(stored_times).all() and np.all(np.diff(stored_times) > 0), "Animation times must increase strictly")
    require(stored_times[0] == 0 and stored_times[-1] == 2, "Animation duration changed")
    require(np.isfinite(stored_quaternions).all() and np.allclose(norms, 1, rtol=0, atol=1e-6), "Animation quaternion is not finite/unit length")
    require(np.array_equal(stored_quaternions[0], stored_quaternions[-1]), "Loop endpoints do not match")
    require(np.allclose(stored_quaternions[0], base_quaternion, atol=1e-7), "Animation does not start at original pose")
    require(np.all(np.sum(stored_quaternions[:-1]*stored_quaternions[1:], axis=1) > 0), "Quaternion sign discontinuity")
    reference = evaluated_vertices(processed, {18: stored_quaternions[0]})
    actual_bounds = bounds(reference)
    require(abs(actual_bounds["size_xyz"][1] - height) < 1e-6, "Processed height misses target")
    require(np.linalg.norm(actual_bounds["ground_center_y_up"]) < 1e-6, "Processed bottom center misses origin")
    samples = []
    for time in np.linspace(0, 2, 9):
        interval = min(int(np.searchsorted(stored_times, time, side="right")) - 1, len(stored_times)-2)
        interval = max(interval, 0)
        fraction = float((time-stored_times[interval]) / (stored_times[interval+1]-stored_times[interval]))
        quaternion = slerp(stored_quaternions[interval], stored_quaternions[interval+1], fraction)
        vertices = evaluated_vertices(processed, {18: quaternion})
        delta = np.linalg.norm(vertices-reference, axis=1)
        samples.append({"time_seconds": float(time), "finite": bool(np.isfinite(vertices).all()),
                        "vertices_moved_over_10um": int(np.count_nonzero(delta > 1e-5)), "max_displacement_m": float(delta.max()), "bounds": bounds(vertices)})
    require(max(sample["max_displacement_m"] for sample in samples) > .001, "Animation does not move the mesh")
    require(sha256(source.read_bytes()) == original_hash, "Raw source was unexpectedly modified")
    qa["processed_cpu_verification"] = {"status": "passed", "bind_pose_world_bounds": actual_bounds, "forward_mapping": {"source": "+X", "processed": "+Z", "basis_vector_result": (rotation @ np.array([1., 0., 0.])).tolist()},
                                         "uv_accessors": uv_checks, "texture_bytes_unchanged": True, "original_nodes_and_skin_unchanged": True,
                                         "animation": {"name": "Techland_Beckon", "target_node": 18, "target_name": "bone_21", "target_path": "rotation", "input_accessor": time_accessor, "output_accessor": quaternion_accessor,
                                                       "keyframe_count": 5, "times_seconds": stored_times.tolist(), "quaternion_norms": norms.tolist(), "matching_loop_endpoints": True, "samples": samples},
                                         "visual_animation_review": "PENDING_BROWSER_PLAYBACK"}
    qa["status_explanation"] = "The generic inspector's blocked_unsupported flag concerns its static bounds only. Additional CPU skinning and animation-sample checks passed; browser playback remains pending."
    record = {"created_at_utc": datetime.now(timezone.utc).isoformat(), "asset_id": "04_lucky_cat", "source_generation_task_id": SOURCE_TASK, "source_rig_task_id": RIG_TASK,
              "source_file": str(source.resolve()), "source_sha256": original_hash, "processed_file": str(output.resolve()), "processed_sha256": sha256(output.read_bytes()),
              "processor": "tools/prepare_cyber_cat.py", "provider_processing": "Tripo generated and rigged the source GLB", "local_processing": "Common parent normalization and locally authored quaternion beckoning clip",
              "additional_tripo_tasks": 0, "additional_credits": 0, "source_bind_pose_bounds": raw_bounds,
              "wrapper_node_index": root_index, "wrapper_node": root_node, "target_height_m": height, "processed_bind_pose_bounds": actual_bounds,
              "animation": {"name": "Techland_Beckon", "authoring_method": "Local bone18 rest quaternion multiplied by local-Z delta quaternion; LINEAR rotation keys", "times_seconds": times.tolist(), "local_z_degrees": angles,
                            "source_rest_quaternion_xyzw": base_quaternion.tolist(), "duration_seconds": 2, "repeat_behavior": "Clip endpoints match; set the viewer AnimationAction to LoopRepeat", "source": "Locally authored, not a Tripo retarget result"},
              "preserved": ["raw source GLB", "all original nodes and skin references", "original binary prefix", "materials and embedded texture bytes", "UV accessors"],
              "qa_report": str(qa_path.resolve()), "cpu_validation": "passed", "browser_playback_review": "pending"}
    for destination, data in ((qa_path, qa), (record_path, record)):
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return {"model": str(output.resolve()), "record": str(record_path.resolve()), "qa": str(qa_path.resolve()), "height_m": actual_bounds["size_xyz"][1],
            "animation": "Techland_Beckon", "keyframes": 5, "max_sampled_displacement_m": max(sample["max_displacement_m"] for sample in samples), "status": "CPU_VALIDATED_BROWSER_PLAYBACK_PENDING"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--record", type=Path, default=RECORD)
    parser.add_argument("--qa", type=Path, default=QA)
    parser.add_argument("--height", type=float, default=.8)
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.output, args.record, args.qa, args.height), ensure_ascii=False))


if __name__ == "__main__":
    main()
