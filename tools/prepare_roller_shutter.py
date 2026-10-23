#!/usr/bin/env python3
"""Cut the real Tripo shutter mesh into fixed hardware and movable slats.

The source is immutable. Triangle/plane intersections interpolate the source
UVs and normals. Only exposed planar cut caps are locally authored. No paid
service is called and no animation is baked into this GLB.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import struct

import numpy as np

from inspect_tripo_glb import Inspector, ROOT


SOURCE = ROOT / "assets/tripo/raw/tripo-out/02-roller-shutter-60038920/model.glb"
OUTPUT = ROOT / "assets/tripo/processed/02_roller_shutter.glb"
RECORD = ROOT / "assets/tripo/records/02_roller_shutter.processed.record.json"
QA = ROOT / "assets/tripo/records/02_roller_shutter.processed.qa.json"
MANIFEST = ROOT / "PeterPansTechland_Tripo_Generation_Pack/manifest.json"
TASK_ID = "60038920-5601-4de0-9202-b4620bd5b1c8"
TARGET = np.array([3.8, 2.55, .16], dtype=np.float64)
CLIP_EPSILON = 1e-11
WELD_EPSILON = 1e-6


def require(condition, message):
    if not condition:
        raise ValueError(message)


def area(triangle):
    return .5 * np.linalg.norm(np.cross(triangle[1, :3]-triangle[0, :3], triangle[2, :3]-triangle[0, :3]))


def split_polygon(polygon, axis, coordinate):
    """Partition a convex polygon with interpolated complete vertex attributes."""
    if not polygon:
        return [], []
    distances = np.array([v[axis]-coordinate for v in polygon])
    if np.max(distances) <= CLIP_EPSILON:
        return polygon, []  # Coplanar polygons are owned by one side only.
    if np.min(distances) >= -CLIP_EPSILON:
        return [], polygon

    def half(below):
        result = []
        for a, b in zip(polygon, polygon[1:]+polygon[:1]):
            da, db = a[axis]-coordinate, b[axis]-coordinate
            inside_a = da <= 0 if below else da >= 0
            inside_b = db <= 0 if below else db >= 0
            if inside_a:
                result.append(a)
            if inside_a != inside_b:
                value = a + (b-a) * (da/(da-db))
                value[axis] = coordinate
                result.append(value)
        clean = []
        for value in result:
            if not clean or np.linalg.norm(value[:3]-clean[-1][:3]) > 1e-12:
                clean.append(value)
        if len(clean) > 1 and np.linalg.norm(clean[0][:3]-clean[-1][:3]) <= 1e-12:
            clean.pop()
        return clean if len(clean) >= 3 else []

    return half(True), half(False)


def polygon_triangles(polygon):
    for index in range(1, len(polygon)-1):
        triangle = np.array([polygon[0], polygon[index], polygon[index+1]])
        if area(triangle) > 1e-13:
            yield triangle


def geometric_key(position):
    return tuple(np.rint(position/WELD_EPSILON).astype(np.int64))


def boundary_edges(triangles):
    edges, vertices = defaultdict(list), {}
    for triangle in triangles:
        keys = [geometric_key(v[:3]) for v in triangle]
        for key, vertex in zip(keys, triangle):
            vertices.setdefault(key, vertex)
        for a, b in ((0, 1), (1, 2), (2, 0)):
            if keys[a] != keys[b]:
                edges[tuple(sorted((keys[a], keys[b])))].append((keys[a], keys[b]))
    return [edge for edge, occurrences in edges.items() if len(occurrences) == 1], vertices, sum(len(v)>2 for v in edges.values())


def cross2(a, b):
    return a[0]*b[1]-a[1]*b[0]


def contains(point, polygon):
    result = False
    for a, b in zip(polygon, np.roll(polygon, -1, axis=0)):
        if (a[1] > point[1]) != (b[1] > point[1]):
            x = (b[0]-a[0]) * (point[1]-a[1]) / (b[1]-a[1]) + a[0]
            if point[0] < x:
                result = not result
    return result


def triangulate_loop(loop, axis, outward):
    """Ear-clip a simple contour; return no partial cap if it cannot be solved."""
    dimensions = [i for i in range(3) if i != axis]
    points = np.array([v[:3] for v in loop])[:, dimensions]
    signed = sum(cross2(a, b) for a, b in zip(points, np.roll(points, -1, axis=0))) / 2
    if abs(signed) <= 1e-12:
        return None
    remaining = list(range(len(loop)))
    if signed < 0:
        remaining.reverse()
    result = []
    while len(remaining) > 3:
        found = False
        for k, middle in enumerate(remaining):
            left, right = remaining[k-1], remaining[(k+1) % len(remaining)]
            a, b, c = points[left], points[middle], points[right]
            if cross2(b-a, c-b) <= 1e-13:
                continue
            other = [i for i in remaining if i not in (left, middle, right)]
            p = points[other]
            e0, e1, e2 = b-a, c-b, a-c
            q0, q1, q2 = p-a, p-b, p-c
            inside = ((e0[0]*q0[:, 1]-e0[1]*q0[:, 0] >= -1e-12)
                      & (e1[0]*q1[:, 1]-e1[1]*q1[:, 0] >= -1e-12)
                      & (e2[0]*q2[:, 1]-e2[1]*q2[:, 0] >= -1e-12))
            if np.any(inside):
                continue
            result.append([left, middle, right])
            remaining.pop(k)
            found = True
            break
        if not found:
            return None
    result.append(remaining)
    cap = []
    for indices in result:
        triangle = np.array([loop[i].copy() for i in indices])
        normal = np.zeros(3)
        normal[axis] = outward
        if np.dot(np.cross(triangle[1, :3]-triangle[0, :3], triangle[2, :3]-triangle[0, :3]), normal) < 0:
            triangle = triangle[[0, 2, 1]]
        triangle[:, 3:6] = normal
        # Caps use a separate untextured metal material; source surface UVs are untouched.
        triangle[:, 6:8] = 0
        if area(triangle) > 1e-13:
            cap.append(triangle)
    return cap


def make_caps(triangles, planes):
    boundary, vertices, nonmanifold = boundary_edges(triangles)
    caps, notes, contours = [], [], []
    for axis, coordinate, outward in planes:
        edges = [edge for edge in boundary if all(abs(vertices[key][axis]-coordinate) <= WELD_EPSILON*2 for key in edge)]
        if not edges:
            continue
        adjacency = defaultdict(list)
        for a, b in edges:
            adjacency[a].append(b)
            adjacency[b].append(a)
        unseen, loops = set(adjacency), []
        while unseen:
            start = next(iter(unseen))
            component, pending = set(), [start]
            while pending:
                key = pending.pop()
                if key in component:
                    continue
                component.add(key)
                pending.extend(adjacency[key])
            unseen -= component
            if any(len(adjacency[key]) != 2 for key in component):
                notes.append({"axis": axis, "coordinate": coordinate, "reason": "Open/branched contour left uncapped", "boundary_vertices": len(component)})
                continue
            keys, previous, current = [], None, start
            while True:
                keys.append(current)
                candidates = adjacency[current]
                following = candidates[0] if candidates[0] != previous else candidates[1]
                previous, current = current, following
                if current == start:
                    break
                if len(keys) > len(component):
                    raise ValueError("Unexpected cap contour cycle")
            loops.append([vertices[key] for key in keys])
        dimensions = [i for i in range(3) if i != axis]
        polygons = [np.array([v[:3] for v in loop])[:, dimensions] for loop in loops]
        nested = any(contains(polygon[0], other) for i, polygon in enumerate(polygons) for j, other in enumerate(polygons) if i != j)
        if nested:
            notes.append({"axis": axis, "coordinate": coordinate, "reason": "Nested contours need hole-aware triangulation; left uncapped", "contours": len(loops)})
            continue
        for loop in loops:
            result = triangulate_loop(loop, axis, outward)
            if result is None:
                notes.append({"axis": axis, "coordinate": coordinate, "reason": "Ear clipping could not safely close contour", "boundary_vertices": len(loop)})
            else:
                caps.extend(result)
                contours.append({"axis": axis, "coordinate": coordinate, "boundary_vertices": len(loop), "triangles": len(result)})
    return caps, {"source_surface_boundary_edges": len(boundary), "source_surface_nonmanifold_edges": nonmanifold, "caps": contours, "uncapped_cut_contours": notes}


def encode_glb(doc, binary):
    payload = json.dumps(doc, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
    payload += b" " * (-len(payload) % 4)
    binary += b"\0" * (-len(binary) % 4)
    return struct.pack("<4sII", b"glTF", 2, 28+len(payload)+len(binary)) + struct.pack("<II", len(payload), 0x4E4F534A) + payload + struct.pack("<II", len(binary), 0x004E4942) + binary


def verify_clipping_math():
    # The attributes are deliberately linear functions of position, making
    # incorrect intersection interpolation observable independently of output.
    points = np.array([[-1., -.4, 0.], [1., -.2, .2], [.2, 1., -.1]])
    normals = np.tile([0., 0., 1.], (3, 1))
    attributes = np.column_stack((points, normals, points[:, :2]*.3+.5))
    original_area = area(attributes)
    polygons = [list(attributes)]
    for axis, coordinate in [(0, -.3), (0, .6), (1, .1), (1, .7)]:
        polygons = [half for polygon in polygons for half in split_polygon(polygon, axis, coordinate) if half]
    triangles = [triangle for polygon in polygons for triangle in polygon_triangles(polygon)]
    require(abs(sum(area(t) for t in triangles)-original_area)<1e-12, "Clipping fixture lost or duplicated area")
    for triangle in triangles:
        require(np.allclose(triangle[:, 6:8], triangle[:, :2]*.3+.5, atol=1e-12), "Clipping fixture UV interpolation failed")
    plane_triangle = attributes.copy()
    plane_triangle[:, 0] = 0.
    below, above = split_polygon(list(plane_triangle), 0, 0.)
    require(bool(below) != bool(above), "Coplanar source is assigned more than once")
    rectangle = [np.array([x, y, 0., 0., 0., 1., 0., 0.]) for x, y in [(0., 0.), (2., 0.), (2., 1.), (0., 1.)]]
    cap = triangulate_loop(rectangle, 2, 1)
    require(cap is not None and abs(sum(area(t) for t in cap)-2.)<1e-12, "Planar cap fixture area failed")
    require(all(np.cross(t[1, :3]-t[0, :3], t[2, :3]-t[0, :3])[2]>0 for t in cap), "Planar cap fixture orientation failed")
    return {"status": "passed", "cases": ["Successive triangle cuts preserve total area", "Intersection UVs match independent linear attribute function", "Coplanar triangle has one owner", "Planar cap preserves area and requested outward winding"]}


def verify_runtime_path(inspection, contract):
    """Exercise the exact browser contract without changing vertex geometry."""
    components = []
    for node in inspection.doc["nodes"]:
        if "mesh" not in node:
            continue
        local_points = np.concatenate([inspection.accessor(p["attributes"]["POSITION"]) for p in inspection.doc["meshes"][node["mesh"]]["primitives"]]).astype(np.float64)
        components.append((node, local_points))
    samples = []
    for progress in np.linspace(0., 1., 9):
        all_points, moving_points, angles = [], [], []
        for node, points in components:
            pivot = np.array(node["translation"], dtype=np.float64)
            extras = node["extras"]
            if extras["fixed"]:
                transformed = points+pivot
            else:
                c = extras["closedY"]+contract["travel"]*progress
                theta = max(0., (c-contract["top"])/contract["radius"])
                pivot[1] = c if theta == 0 else contract["top"]+contract["radius"]*np.sin(theta)
                pivot[2] = extras["closedZ"]-contract["radius"]*(1-np.cos(theta))
                co, si = np.cos(-theta), np.sin(-theta)
                rotation = np.array([[1., 0., 0.], [0., co, -si], [0., si, co]])
                require(np.allclose(rotation.T@rotation, np.eye(3), atol=1e-12) and abs(np.linalg.det(rotation)-1)<1e-12, "Runtime rotation scales or mirrors a slat")
                transformed = points@rotation.T+pivot
                moving_points.append(transformed)
                angles.append(float(-theta))
            require(np.all(np.isfinite(transformed)), "Runtime produced non-finite positions")
            all_points.append(transformed)
        assembly, moving = np.concatenate(all_points), np.concatenate(moving_points)
        samples.append({"progress": float(progress), "assembly_min": assembly.min(axis=0).tolist(), "assembly_max": assembly.max(axis=0).tolist(), "moving_min": moving.min(axis=0).tolist(), "moving_max": moving.max(axis=0).tolist(), "rotation_x_range_radians": [min(angles), max(angles)]})
    return {"status": "passed_cpu_rigid_transform_checks", "sample_count": len(samples), "source_meshes_not_scaled_during_motion": True, "fixed_parts_not_transformed": True, "samples": samples, "collision_validation": "Not performed; bounds alone do not establish collision-free motion", "visual_review": "Pending browser opening and closing"}


def prepare(source, output, record_path, qa_path, slat_count):
    math_check = verify_clipping_math()
    require(24 <= slat_count <= 28, "Expected 24 to 28 real mesh slats")
    require(source.resolve() != output.resolve(), "Raw source cannot be overwritten")
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    original = Inspector(source, "02_roller_shutter", MANIFEST)
    source_qa = original.run()
    require(source_qa["status"] == "passed_implemented_checks", "Raw shutter did not pass implemented checks")
    doc = original.doc
    require(len(doc["meshes"]) == len(doc["nodes"]) == 1 and len(doc["meshes"][0]["primitives"]) == 1, "Expected approved single static source mesh")
    primitive = doc["meshes"][0]["primitives"][0]
    attributes = primitive["attributes"]
    require(set(attributes) == {"POSITION", "NORMAL", "TEXCOORD_0"}, "Unexpected source attributes would need explicit interpolation support")
    require(primitive.get("mode", 4) == 4 and not doc.get("skins") and not doc.get("animations"), "Expected static triangle geometry")
    positions = original.accessor(attributes["POSITION"]).astype(np.float64)
    normals = original.accessor(attributes["NORMAL"]).astype(np.float64)
    uv = original.accessor(attributes["TEXCOORD_0"]).astype(np.float64)
    indices = original.accessor(primitive["indices"]).ravel().astype(np.int64).reshape((-1, 3))
    node_matrix = original.local_matrix(doc["nodes"][0])
    turn = np.array([[0., 0., -1.], [0., 1., 0.], [1., 0., 0.]])
    source_world = positions @ node_matrix[:3, :3].T + node_matrix[:3, 3]
    rotated = source_world @ turn.T
    low, high = rotated.min(axis=0), rotated.max(axis=0)
    scaling = TARGET/(high-low)
    center = (low+high)/2
    normalized = (rotated-center)*scaling
    normalized[:, 1] += TARGET[1]/2
    linear = np.diag(scaling) @ turn @ node_matrix[:3, :3]
    normal_transform = np.linalg.inv(linear).T
    normals = normals @ normal_transform.T
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    vertices = np.column_stack((normalized, normals, uv))
    source_triangles = vertices[indices]
    source_areas = np.array([area(triangle) for triangle in source_triangles])
    require(np.all(source_areas > 0), "Source contains degenerate triangles")
    raw_boundary, _, raw_nonmanifold = boundary_edges(source_triangles)

    guide_inner_x = 1.62
    opening_bottom, opening_top = 0., 2.20
    slat_height = (opening_top-opening_bottom)/slat_count
    cuts = np.linspace(opening_bottom, opening_top, slat_count+1)
    names = ["SHUTTER_GUIDE_LEFT", "SHUTTER_GUIDE_RIGHT", "SHUTTER_HOUSING"] + [f"SHUTTER_SLAT_{i:02d}" for i in range(slat_count)]
    parts = {name: [] for name in names}
    central_surface = []
    covered = np.zeros(len(source_triangles))

    def emit(name, polygon, source_index):
        for triangle in polygon_triangles(polygon):
            parts[name].append(triangle)
            covered[source_index] += area(triangle)

    for source_index, triangle in enumerate(source_triangles):
        left, rest = split_polygon(list(triangle), 0, -guide_inner_x)
        emit("SHUTTER_GUIDE_LEFT", left, source_index)
        middle, right = split_polygon(rest, 0, guide_inner_x)
        emit("SHUTTER_GUIDE_RIGHT", right, source_index)
        central_surface.extend(polygon_triangles(middle))
        curtain, housing = split_polygon(middle, 1, opening_top)
        emit("SHUTTER_HOUSING", housing, source_index)
        for index in range(slat_count):
            piece, curtain = split_polygon(curtain, 1, cuts[index+1])
            emit(f"SHUTTER_SLAT_{index:02d}", piece, source_index)
        require(not curtain, "Unallocated curtain polygon")
    area_errors = np.abs(covered-source_areas)
    require(np.all(area_errors <= np.maximum(1e-10, source_areas*1e-7)), "Partition lost or duplicated source triangle area")
    require(all(parts[name] for name in names), "A required hardware or slat component is empty")

    # Close the entire central slab's vertical cuts first. These real cross
    # sections are subsequently clipped along with the slats. Trying to cap
    # each final part directly leaves open chains at intersecting cut planes.
    side_caps, side_cap_record = make_caps(central_surface, [(0, -guide_inner_x, -1), (0, guide_inner_x, 1)])
    inherited_caps = {name: [] for name in names}
    for triangle in side_caps:
        curtain, housing = split_polygon(list(triangle), 1, opening_top)
        inherited_caps["SHUTTER_HOUSING"].extend(polygon_triangles(housing))
        for index in range(slat_count):
            piece, curtain = split_polygon(curtain, 1, cuts[index+1])
            inherited_caps[f"SHUTTER_SLAT_{index:02d}"].extend(polygon_triangles(piece))
        require(not curtain, "Unallocated inherited side cap")

    caps, cap_records = {}, {}
    for name in names:
        if name == "SHUTTER_GUIDE_LEFT":
            planes = [(0, -guide_inner_x, 1)]
        elif name == "SHUTTER_GUIDE_RIGHT":
            planes = [(0, guide_inner_x, -1)]
        elif name == "SHUTTER_HOUSING":
            planes = [(1, opening_top, -1)]
        else:
            index = int(name.rsplit("_", 1)[1])
            planes = []
            if index > 0:
                planes.append((1, cuts[index], -1))
            planes.append((1, cuts[index+1], 1))
        caps[name], cap_records[name] = make_caps(parts[name]+inherited_caps[name], planes)
        caps[name] = inherited_caps[name]+caps[name]
        cap_records[name]["inherited_side_cap_triangles"] = len(inherited_caps[name])

    processed = copy.deepcopy(doc)
    binary = bytearray(original.buffers[0])
    processed["nodes"], processed["meshes"] = [], []
    processed.pop("animations", None)
    processed["scenes"] = [{"name": "Techland Roller Shutter", "nodes": [0]}]
    processed["scene"] = 0
    radius = .38
    tangent_top = opening_top+radius
    root = {"name": "ROLLER_SHUTTER_ROOT", "children": [], "extras": {"sourceTaskId": TASK_ID, "shutter": {
        "top": tangent_top, "openingTop": opening_top, "bottom": opening_bottom, "radius": radius,
        "travel": tangent_top-opening_bottom, "slatCount": slat_count, "slatHeight": slat_height,
        "curtainWidth": 2*guide_inner_x, "frontAxis": "+Z", "rollAxis": "X", "rollRotationSign": -1,
        "topMeaning": "Front vertical tangent height of the rearward roll; coil minimum Y equals openingTop",
        "runtimePath": "For c=closedY+travel*open: if c<=top use Y=c and Z=closedZ; otherwise theta=(c-top)/radius, Y=top+radius*sin(theta), Z=closedZ-radius*(1-cos(theta)), rotationX=-theta. Preserve closedX. No Y scaling.",
        "closedBounds": {"min": [-1.9, 0., -.08], "max": [1.9, 2.55, .08]}}}}
    processed["nodes"].append(root)
    cap_material = len(processed["materials"])
    processed["materials"].append({"name": "TECHLAND_LOCAL_CUT_CAP_METAL", "pbrMetallicRoughness": {"baseColorFactor": [.055, .045, .065, 1], "metallicFactor": .7, "roughnessFactor": .7},
                                   "extras": {"authorship": "Local planar closure of actual cut geometry"}})

    def accessor(array, kind, component=5126):
        binary.extend(b"\0"*(-len(binary) % 4))
        view_index = len(processed["bufferViews"])
        payload = array.tobytes()
        processed["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(payload)})
        binary.extend(payload)
        entry = {"bufferView": view_index, "componentType": component, "count": len(array), "type": kind}
        if kind == "VEC3":
            entry.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
        index = len(processed["accessors"])
        processed["accessors"].append(entry)
        return index

    def mesh_primitive(triangles, pivot, material):
        unique, lookup, ix = [], {}, []
        for triangle in triangles:
            for vertex in triangle:
                vertex = vertex.copy()
                vertex[:3] -= pivot
                length = np.linalg.norm(vertex[3:6])
                require(length > 1e-12, "Interpolated normal vanished")
                vertex[3:6] /= length
                item = vertex.astype("<f4")
                key = item.tobytes()
                if key not in lookup:
                    lookup[key] = len(unique)
                    unique.append(item)
                ix.append(lookup[key])
        data = np.array(unique, dtype="<f4")
        return {"attributes": {"POSITION": accessor(np.ascontiguousarray(data[:, :3]), "VEC3"),
                               "NORMAL": accessor(np.ascontiguousarray(data[:, 3:6]), "VEC3"),
                               "TEXCOORD_0": accessor(np.ascontiguousarray(data[:, 6:8]), "VEC2")},
                "indices": accessor(np.array(ix, dtype="<u4"), "SCALAR", 5125), "material": material, "mode": 4}

    component_records = []
    for name in names:
        points = np.concatenate(parts[name])[:, :3]
        lo, hi = points.min(axis=0), points.max(axis=0)
        pivot = (lo+hi)/2
        primitive_list = [mesh_primitive(parts[name], pivot, primitive.get("material", 0))]
        if caps[name]:
            primitive_list.append(mesh_primitive(caps[name], pivot, cap_material))
        mesh_index = len(processed["meshes"])
        processed["meshes"].append({"name": name, "primitives": primitive_list})
        node = {"name": name, "mesh": mesh_index, "translation": pivot.tolist(), "extras": {"sourceTaskId": TASK_ID, "geometryOrigin": "Clipped original Tripo triangles", "fixed": not name.startswith("SHUTTER_SLAT_")}}
        if name.startswith("SHUTTER_SLAT_"):
            index = int(name.rsplit("_", 1)[1])
            node["extras"].update(slatIndex=index, closedX=float(pivot[0]), closedY=float(pivot[1]), closedZ=float(pivot[2]), slatHeight=slat_height, closedHeight=float(hi[1]-lo[1]))
        node_index = len(processed["nodes"])
        root["children"].append(node_index)
        processed["nodes"].append(node)
        component_records.append({"name": name, "node": node_index, "source_surface_triangles": len(parts[name]), "local_cap_triangles": len(caps[name]), "closed_bounds": {"min": lo.tolist(), "max": hi.tolist()}, "pivot": pivot.tolist(), "cut_caps": cap_records[name]})
    processed["buffers"][0]["byteLength"] = len(binary)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encode_glb(processed, bytes(binary)))

    inspection = Inspector(output, "02_roller_shutter", MANIFEST)
    qa = inspection.run()
    require(qa["status"] == "passed_implemented_checks", f"Processed structural inspection failed: {qa['errors']}")
    require(np.allclose(qa["world_bounds"]["size_xyz"], TARGET, rtol=0, atol=2e-6), "Closed assembly no longer matches target bounds")
    require(np.linalg.norm(qa["world_bounds"]["ground_center_y_up"]) < 2e-6, "Closed assembly bottom center moved")
    require(len(inspection.doc["nodes"])-1 == slat_count+3, "Part count mismatch")
    require(not inspection.doc.get("animations"), "Runtime-driven shutter must not have baked clips")
    require(inspection.buffers[0][:len(original.buffers[0])] == original.buffers[0], "Original buffer data was overwritten")
    texture_preserved = [x["sha256"] for x in source_qa["images"]] == [x["sha256"] for x in qa["images"]]
    require(texture_preserved, "Original embedded textures changed")
    require(inspection.doc["materials"][:len(doc["materials"])] == doc["materials"], "Original material definitions changed")
    require(hashlib.sha256(source.read_bytes()).hexdigest() == source_hash, "Raw source changed")
    runtime_check = verify_runtime_path(inspection, root["extras"]["shutter"])
    uncapped = [{"part": "CENTRAL_SLAB_BEFORE_HORIZONTAL_CUTS", **note} for note in side_cap_record["uncapped_cut_contours"]]
    uncapped += [{"part": name, **note} for name in names for note in cap_records[name]["uncapped_cut_contours"]]
    partition = {"source_triangles": len(indices), "clipped_source_surface_triangles": sum(len(t) for t in parts.values()), "local_cap_triangles": sum(len(t) for t in caps.values()),
                 "source_surface_area_m2": float(source_areas.sum()), "partition_surface_area_m2": float(covered.sum()), "max_per_source_triangle_area_error_m2": float(area_errors.max()),
                 "all_source_triangle_areas_preserved": True, "unallocated_source_triangles": int(np.count_nonzero(covered == 0)), "embedded_texture_bytes_unchanged": texture_preserved,
                 "source_boundary_edges_after_position_weld": len(raw_boundary), "source_nonmanifold_edges_after_position_weld": raw_nonmanifold, "position_weld_tolerance_m": WELD_EPSILON,
                 "uv_method": "Source UV values interpolated linearly at every plane intersection; original material and all source images preserved", "central_side_caps": side_cap_record, "uncapped_cut_contours": uncapped}
    qa["shutter_partition_validation"] = partition
    qa["runtime_path_validation"] = runtime_check
    qa["clipping_math_fixtures"] = math_check
    qa["visual_review"] = "PENDING_BROWSER_CLOSED_AND_OPEN_REVIEW"
    qa["qa_approved"] = False
    record = {"created_at_utc": datetime.now(timezone.utc).isoformat(), "source_task_id": TASK_ID, "source_file": str(source.resolve()), "source_sha256": source_hash,
              "processed_file": str(output.resolve()), "processed_sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "processor": "tools/prepare_roller_shutter.py",
              "operations": ["Bake original node transform", "Rotate Y -90 degrees: source +X forward to +Z", "Normalize full real mesh to 3.8 x 2.55 x 0.16 meters and bottom center", "Partition every source triangle with linear UV/normal interpolation", "Close safe simple cut contours using locally authored planar caps", "Center each part pivot and publish runtime roll metadata"],
              "source_to_target_axis_scale_after_rotation": scaling.tolist(), "source_forward_evidence": "Raw X is the thin axis and provider preview shows a frontal shutter; final orientation awaits browser check",
              "animation_source": "No animation baked; intended opening is runtime rigid transforms of real separated slat meshes", "runtime_contract": root["extras"]["shutter"],
              "partition_validation": partition, "runtime_path_validation": runtime_check, "clipping_math_fixtures": math_check, "components": component_records, "additional_paid_calls": 0,
              "limitations": ["Generated colored graffiti patches are retained; exact branding is not yet applied.", "Cuts follow geometric planes rather than semantic fabrication joints.", "Caps are local closure geometry, not Tripo-generated replacements.", "Uncapped or branched cut contours, if listed, remain open and require browser review.", "The rearward coil extends above and behind the original housing; runtime placement must allow clearance."],
              "browser_review": "pending", "qa_file": str(qa_path.resolve())}
    for path, data in ((record_path, record), (qa_path, qa)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False)+"\n", encoding="utf-8")
    return {"output": str(output.resolve()), "slats": slat_count, "fixed_parts": 3, "source_triangles": len(indices), "processed_triangles": qa["summary"]["triangle_count_sum_primitives"], "caps": partition["local_cap_triangles"], "uncapped_cut_contours": len(uncapped), "closed_bounds": qa["world_bounds"], "status": "STRUCTURE_AND_PARTITION_CHECKED_BROWSER_REVIEW_PENDING"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--record", type=Path, default=RECORD)
    parser.add_argument("--qa", type=Path, default=QA)
    parser.add_argument("--slats", type=int, default=26)
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.output, args.record, args.qa, args.slats), ensure_ascii=False))


if __name__ == "__main__":
    main()
