#!/usr/bin/env python3
"""Read-only GLB QA for Tripo outputs. Not a visual review or a Khronos validator.

Requires NumPy and Pillow. The source GLB and its images are never modified.
Exit codes: 0 = implemented checks passed, 1 = invalid, 2 = incomplete/unsupported.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import sys
from datetime import datetime, timezone
from urllib.parse import unquote, urlsplit
import warnings

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DTYPES = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}
SUPPORTED = {"KHR_texture_transform", "KHR_materials_unlit", "KHR_materials_emissive_strength", "KHR_mesh_quantization"}
COMPRESSION = {"KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"}


class Invalid(ValueError):
    pass


def integer(value, label, minimum=0):
    if type(value) is not int or value < minimum:
        raise Invalid(f"{label}: expected integer >= {minimum}, got {value!r}")
    return value


def at(items, index, label):
    integer(index, label)
    if index >= len(items):
        raise Invalid(f"{label}: index {index} exceeds collection length {len(items)}")
    return items[index]


def finite_vector(value, size, label):
    array = np.asarray(value, dtype=np.float64)
    if array.shape != (size,) or not np.isfinite(array).all():
        raise Invalid(f"{label}: expected {size} finite numbers")
    return array


class Inspector:
    def __init__(self, path, asset_id, manifest):
        self.path = path.resolve()
        self.asset_id = asset_id
        self.doc = {}
        self.buffers = []
        self.arrays = {}
        self.mesh_positions = {}
        self.mesh_skin_attributes = {}
        self.validated_skins = {}
        self.texture_uvs = {}
        self.report = {
            "schema_version": 1,
            "asset_id": asset_id,
            "source_file": str(self.path),
            "inspected_at_utc": datetime.now(timezone.utc).isoformat(),
            "tool": "tools/inspect_tripo_glb.py",
            "scope": "GLB structure, decoded accessor data, static scene bounds, material references, full image decoding",
            "visual_review": "NOT_PERFORMED",
            "qa_approved": False,
            "errors": [], "warnings": [], "unsupported": [],
            "limitations": [
                "This tool is not the Khronos glTF Validator and does not certify visual quality, topology, UV appearance, or animation behavior.",
                "Y-up is the glTF convention; the intended front (+Z), upright appearance, and functional pivot require visual inspection.",
                "Bounds describe stored static mesh positions with node transforms; skins, morph weights, animation, and GPU instancing are not evaluated.",
            ],
            "accessors": [], "images": [], "textures": [], "materials": [], "meshes": [], "nodes": [], "skins": [], "skin_instances": [],
        }
        source_manifest = json.loads(manifest.read_text(encoding="utf-8-sig"))
        matches = [a for a in source_manifest["assets"] if a["id"] == asset_id]
        if len(matches) != 1:
            raise Invalid(f"Expected one manifest entry for {asset_id}")
        self.target = matches[0]
        self.report["manifest"] = {
            "path": str(manifest.resolve()),
            "title": self.target.get("title"),
            "target_size_m_xyz": self.target.get("target_size_m_xyz"),
            "expected_nodes_after_blender": self.target.get("expected_nodes_after_blender", []),
        }

    def issue(self, message, kind="errors"):
        self.report[kind].append(message)

    def guarded(self, label, fn, *args):
        try:
            return fn(*args)
        except (Invalid, ValueError, KeyError, TypeError, IndexError, OSError, struct.error, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
            self.issue(f"{label}: {error}")
            return None

    def read_uri(self, uri):
        if not isinstance(uri, str):
            raise Invalid("URI must be a string")
        if uri.startswith("data:"):
            header, sep, payload = uri.partition(",")
            if not sep or ";base64" not in header:
                raise Invalid("Only base64 data URIs are supported")
            return base64.b64decode(payload, validate=True)
        parts = urlsplit(uri)
        if parts.scheme or parts.netloc or parts.query or parts.fragment:
            raise Invalid("Remote or non-file image/buffer URI is not fetched")
        resolved = (self.path.parent / unquote(parts.path)).resolve()
        if not resolved.is_relative_to(self.path.parent):
            raise Invalid("External URI escapes the source model directory")
        return resolved.read_bytes()

    def container(self):
        blob = self.path.read_bytes()
        self.report["file_bytes"] = len(blob)
        self.report["sha256"] = hashlib.sha256(blob).hexdigest()
        if len(blob) < 20:
            raise Invalid("File is too small for a GLB")
        magic, version, length = struct.unpack_from("<4sII", blob)
        if magic != b"glTF" or version != 2 or length != len(blob):
            raise Invalid("GLB magic/version/declared byte length mismatch")
        chunks, offset = [], 12
        while offset < len(blob):
            if offset + 8 > len(blob):
                raise Invalid("Truncated chunk header")
            size, kind = struct.unpack_from("<II", blob, offset)
            offset += 8
            if size % 4 or offset + size > len(blob):
                raise Invalid("Invalid chunk padding or chunk exceeds file")
            chunks.append((kind, blob[offset:offset + size]))
            offset += size
        if not chunks or chunks[0][0] != 0x4E4F534A:
            raise Invalid("The first GLB chunk must be JSON")
        if sum(k == 0x4E4F534A for k, _ in chunks) != 1 or sum(k == 0x004E4942 for k, _ in chunks) > 1:
            raise Invalid("Duplicate JSON or BIN chunk")
        self.doc = json.loads(chunks[0][1].decode("utf-8"), parse_constant=lambda value: (_ for _ in ()).throw(Invalid(f"Non-JSON constant {value}")))
        if not isinstance(self.doc, dict) or self.doc.get("asset", {}).get("version") != "2.0":
            raise Invalid("Expected a glTF 2.0 document")
        if self.doc.get("asset", {}).get("minVersion", "2.0") != "2.0":
            self.issue("asset.minVersion is not 2.0", "unsupported")
        binaries = [data for kind, data in chunks if kind == 0x004E4942]
        for kind, _ in chunks:
            if kind not in (0x4E4F534A, 0x004E4942):
                self.issue(f"Unknown GLB chunk type 0x{kind:08x} ignored", "warnings")
        for i, buffer in enumerate(self.doc.get("buffers", [])):
            length = integer(buffer.get("byteLength"), f"buffers[{i}].byteLength", 1)
            if "uri" in buffer:
                data = self.read_uri(buffer["uri"])
            elif i == 0 and binaries:
                data = binaries[0]
                if len(data) - length > 3:
                    raise Invalid("BIN chunk contains more than three padding bytes")
            else:
                raise Invalid(f"buffers[{i}] has no accessible data")
            if len(data) < length:
                raise Invalid(f"buffers[{i}] data is shorter than byteLength")
            self.buffers.append(data[:length])
        used, required = self.doc.get("extensionsUsed", []), self.doc.get("extensionsRequired", [])
        self.report["extensions_used"] = used
        self.report["extensions_required"] = required
        if not isinstance(used, list) or not isinstance(required, list) or any(not isinstance(x, str) for x in used + required):
            raise Invalid("Extension lists must contain strings")
        for name in required:
            if name not in used:
                self.issue(f"Required extension {name} is absent from extensionsUsed")
            if name not in SUPPORTED:
                self.issue(f"Required extension {name} is not implemented by this inspector", "unsupported")
        for name in sorted(set(used) & COMPRESSION):
            self.issue(f"{name}: compressed representations are not decoded by this basic inspector", "unsupported")
        for i in range(len(self.doc.get("bufferViews", []))):
            self.guarded(f"bufferView {i}", self.view, i)

    def view(self, index):
        view = at(self.doc.get("bufferViews", []), index, "bufferView")
        data = at(self.buffers, view.get("buffer"), "bufferView.buffer")
        start = integer(view.get("byteOffset", 0), "bufferView.byteOffset")
        length = integer(view.get("byteLength"), "bufferView.byteLength", 1)
        if start + length > len(data):
            raise Invalid("bufferView extends past its buffer")
        if "byteStride" in view:
            stride = integer(view["byteStride"], "bufferView.byteStride", 4)
            if stride > 252 or stride % 4:
                raise Invalid("bufferView.byteStride must be a multiple of 4 in [4,252]")
        if "target" in view and view["target"] not in (34962, 34963):
            raise Invalid("Invalid bufferView target")
        return view, memoryview(data)[start:start + length]

    @staticmethod
    def layout(accessor):
        dtype = np.dtype(DTYPES[accessor["componentType"]])
        kind = accessor["type"]
        width = WIDTHS[kind]
        if kind.startswith("MAT"):
            side = int(kind[-1])
            column_size = ((side * dtype.itemsize + 3) // 4) * 4
            offsets = [column * column_size + row * dtype.itemsize for column in range(side) for row in range(side)]
            size = side * column_size
        else:
            offsets = [i * dtype.itemsize for i in range(width)]
            size = width * dtype.itemsize
        return dtype, offsets, size

    def read_elements(self, view_index, offset, count, accessor, allow_stride=True):
        view, data = self.view(view_index)
        if "EXT_meshopt_compression" in view.get("extensions", {}):
            raise Invalid("meshopt bufferView cannot be decoded by this inspector")
        dtype, components, size = self.layout(accessor)
        offset = integer(offset, "accessor byteOffset")
        if offset % dtype.itemsize or (view.get("byteOffset", 0) + offset) % dtype.itemsize:
            raise Invalid("Accessor offset is not aligned to its component size")
        if not allow_stride and "byteStride" in view:
            raise Invalid("Sparse bufferViews cannot have byteStride")
        stride = view.get("byteStride", size) if allow_stride else size
        if stride < size or stride % dtype.itemsize:
            raise Invalid("Accessor stride is smaller than the element or is misaligned")
        if offset + (count - 1) * stride + size > len(data):
            raise Invalid("Accessor elements exceed their bufferView")
        return np.column_stack([np.ndarray((count,), dtype=dtype, buffer=data, offset=offset + part, strides=(stride,)) for part in components])

    def accessor(self, index):
        if index in self.arrays:
            return self.arrays[index]
        accessor = at(self.doc.get("accessors", []), index, "accessor")
        count = integer(accessor.get("count"), "accessor.count", 1)
        if accessor.get("componentType") not in DTYPES or accessor.get("type") not in WIDTHS:
            raise Invalid("Unsupported accessor componentType/type")
        if "normalized" in accessor and type(accessor["normalized"]) is not bool:
            raise Invalid("accessor.normalized must be boolean")
        if accessor.get("normalized") and accessor["componentType"] not in (5120, 5121, 5122, 5123):
            raise Invalid("Only byte/short accessors may be normalized")
        if "bufferView" in accessor:
            array = self.read_elements(accessor["bufferView"], accessor.get("byteOffset", 0), count, accessor)
        else:
            if accessor.get("byteOffset", 0):
                raise Invalid("Accessor without bufferView cannot have a nonzero byteOffset")
            array = np.zeros((count, WIDTHS[accessor["type"]]), dtype=np.dtype(DTYPES[accessor["componentType"]]))
        if "sparse" in accessor:
            sparse = accessor["sparse"]
            sparse_count = integer(sparse.get("count"), "sparse.count", 1)
            if sparse_count > count:
                raise Invalid("sparse.count exceeds accessor.count")
            indices = sparse["indices"]
            if indices.get("componentType") not in (5121, 5123, 5125):
                raise Invalid("Sparse indices must be unsigned integers")
            ix = self.read_elements(indices["bufferView"], indices.get("byteOffset", 0), sparse_count, {"componentType": indices["componentType"], "type": "SCALAR"}, False).ravel().astype(np.int64)
            if ix[-1] >= count or np.any(np.diff(ix) <= 0):
                raise Invalid("Sparse indices must increase strictly and remain in range")
            values = sparse["values"]
            array[ix] = self.read_elements(values["bufferView"], values.get("byteOffset", 0), sparse_count, accessor, False)
        if not np.isfinite(array).all():
            raise Invalid("Accessor contains NaN or infinity")
        actual_min, actual_max = array.min(axis=0), array.max(axis=0)
        for label, actual in (("min", actual_min), ("max", actual_max)):
            if label in accessor:
                declared = finite_vector(accessor[label], array.shape[1], f"accessor.{label}")
                if not np.allclose(declared, actual, rtol=1e-5, atol=1e-7):
                    raise Invalid(f"Declared accessor.{label} disagrees with decoded values")
        self.report["accessors"].append({"index": index, "type": accessor["type"], "component_type": accessor["componentType"], "count": count, "normalized": accessor.get("normalized", False), "finite": True, "decoded_min": actual_min.tolist(), "decoded_max": actual_max.tolist()})
        if accessor.get("normalized"):
            info = np.iinfo(array.dtype)
            array = np.maximum(array.astype(np.float64) / info.max, -1.0)
        self.arrays[index] = array
        return array

    def inspect_image(self, index):
        entry = self.doc["images"][index]
        if ("uri" in entry) == ("bufferView" in entry):
            raise Invalid("Image must have exactly one of uri or bufferView")
        if "bufferView" in entry:
            if "mimeType" not in entry:
                raise Invalid("Embedded image requires mimeType")
            _, view = self.view(entry["bufferView"])
            data = bytes(view)
        else:
            data = self.read_uri(entry["uri"])
        item = {"index": index, "name": entry.get("name"), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "declared_mime_type": entry.get("mimeType"), "decoded": False}
        self.report["images"].append(item)
        if entry.get("mimeType") == "image/ktx2" or data.startswith(b"\xabKTX"):
            self.issue(f"Image {index} is KTX/KTX2; a texture transcoder is required", "unsupported")
            return
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as probe:
                probe.verify()
            with Image.open(io.BytesIO(data)) as decoded:
                decoded.load()
                fmt, mode, size = decoded.format, decoded.mode, decoded.size
                pixels = np.asarray(decoded.convert("RGBA"))
        expected = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP", "image/avif": "AVIF"}
        if entry.get("mimeType") in expected and fmt != expected[entry["mimeType"]]:
            raise Invalid("Declared MIME type does not match decoded image format")
        item.update({"decoded": True, "format": fmt, "mode": mode, "size_px": list(size), "rgba_channel_min": pixels.min(axis=(0, 1)).tolist(), "rgba_channel_max": pixels.max(axis=(0, 1)).tolist()})

    def inspect_texture(self, index):
        texture = self.doc["textures"][index]
        sources = []
        if "source" in texture:
            sources.append(("core", texture["source"]))
        for extension, value in texture.get("extensions", {}).items():
            if isinstance(value, dict) and "source" in value:
                sources.append((extension, value["source"]))
        if not sources:
            raise Invalid("Texture has no image source")
        for _, source in sources:
            at(self.doc.get("images", []), source, "texture.source")
        if "sampler" in texture:
            sampler = at(self.doc.get("samplers", []), texture["sampler"], "texture.sampler")
            for key, allowed in {"magFilter": (9728, 9729), "minFilter": (9728, 9729, 9984, 9985, 9986, 9987), "wrapS": (33071, 33648, 10497), "wrapT": (33071, 33648, 10497)}.items():
                if key in sampler and sampler[key] not in allowed:
                    raise Invalid(f"Invalid sampler.{key}")
        self.report["textures"].append({"index": index, "sources": [{"kind": kind, "image": source} for kind, source in sources]})

    def inspect_material(self, index):
        material = self.doc["materials"][index]
        refs = []

        def walk(value, path=""):
            if not isinstance(value, dict):
                return
            for key, child in value.items():
                current = f"{path}.{key}" if path else key
                if key.endswith("Texture") and isinstance(child, dict):
                    at(self.doc.get("textures", []), child.get("index"), current)
                    texcoord = integer(child.get("texCoord", 0), current + ".texCoord")
                    transform = child.get("extensions", {}).get("KHR_texture_transform", {})
                    if "texCoord" in transform:
                        texcoord = integer(transform["texCoord"], current + ".transform.texCoord")
                    for k, count in (("offset", 2), ("scale", 2)):
                        if k in transform:
                            finite_vector(transform[k], count, current + ".transform." + k)
                    if "rotation" in transform and not math.isfinite(float(transform["rotation"])):
                        raise Invalid("Nonfinite texture transform rotation")
                    refs.append({"slot": current, "texture": child["index"], "texcoord": texcoord})
                else:
                    walk(child, current)

        walk(material)
        pbr = material.get("pbrMetallicRoughness", {})
        for key in ("metallicFactor", "roughnessFactor"):
            value = float(pbr.get(key, 1))
            if not math.isfinite(value) or not 0 <= value <= 1:
                raise Invalid(f"Invalid {key}")
        color = finite_vector(pbr.get("baseColorFactor", [1, 1, 1, 1]), 4, "baseColorFactor")
        if np.any(color < 0) or np.any(color > 1):
            raise Invalid("baseColorFactor components must be in [0,1]")
        emissive = finite_vector(material.get("emissiveFactor", [0, 0, 0]), 3, "emissiveFactor")
        if np.any(emissive < 0):
            raise Invalid("emissiveFactor cannot be negative")
        if material.get("alphaMode", "OPAQUE") not in ("OPAQUE", "MASK", "BLEND"):
            raise Invalid("Invalid material.alphaMode")
        self.texture_uvs[index] = {ref["texcoord"] for ref in refs}
        self.report["materials"].append({"index": index, "name": material.get("name"), "texture_slots": refs, "has_base_color_texture": "baseColorTexture" in pbr, "double_sided": material.get("doubleSided", False), "alpha_mode": material.get("alphaMode", "OPAQUE")})

    def inspect_skin_attributes(self, attributes):
        """Validate all influence sets, including data shared by multiple skin instances.

        Rules follow glTF 2.0 section 3.7.3 (not a full validator):
        https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
        """
        sets = {"JOINTS": {}, "WEIGHTS": {}}
        for semantic, ref in attributes.items():
            prefix, separator, suffix = semantic.partition("_")
            if prefix not in sets:
                continue
            if not separator or not suffix.isdigit() or str(int(suffix)) != suffix:
                raise Invalid(f"Invalid skin attribute semantic {semantic}")
            sets[prefix][int(suffix)] = ref
        if not sets["JOINTS"] and not sets["WEIGHTS"]:
            return None
        if set(sets["JOINTS"]) != set(sets["WEIGHTS"]):
            raise Invalid("JOINTS_n and WEIGHTS_n must be paired for every influence set")
        indices = sorted(sets["JOINTS"])
        if indices != list(range(len(indices))):
            raise Invalid("Skin attribute sets must start at zero and be consecutive")
        joints, weights, components = [], [], []
        for index in indices:
            ji, wi = sets["JOINTS"][index], sets["WEIGHTS"][index]
            jd, wd = self.doc["accessors"][ji], self.doc["accessors"][wi]
            if jd["type"] != "VEC4" or jd["componentType"] not in (5121, 5123) or jd.get("normalized", False):
                raise Invalid(f"JOINTS_{index} must be an unnormalized unsigned byte/short VEC4")
            if wd["type"] != "VEC4" or wd["componentType"] not in (5121, 5123, 5126):
                raise Invalid(f"WEIGHTS_{index} must be a float or normalized unsigned byte/short VEC4")
            if wd["componentType"] != 5126 and not wd.get("normalized", False):
                raise Invalid(f"Integer WEIGHTS_{index} must be normalized")
            j, w = self.accessor(ji), self.accessor(wi).astype(np.float64)
            if not np.isfinite(w).all() or np.any(w < 0):
                raise Invalid(f"WEIGHTS_{index} contains negative or nonfinite weights")
            joints.append(j)
            weights.append(w)
            components.append(wd["componentType"])
        joint_array, weight_array = np.concatenate(joints, axis=1), np.concatenate(weights, axis=1)
        total = weight_array.sum(axis=1)
        influences = np.count_nonzero(weight_array, axis=1)
        if np.any(influences == 0):
            raise Invalid("A skinned vertex has no positive joint weight")
        # The spec forbids a joint receiving two nonzero weights on one vertex.
        for column in range(joint_array.shape[1] - 1):
            repeats = joint_array[:, column, None] == joint_array[:, column + 1:]
            both_used = (weight_array[:, column, None] > 0) & (weight_array[:, column + 1:] > 0)
            if np.any(repeats & both_used):
                raise Invalid("A vertex assigns multiple nonzero weights to the same joint")
        tolerance = 2e-7 * influences if 5126 in components else np.full(len(total), 1e-12)
        normalization_errors = int(np.count_nonzero(np.abs(total - 1) > tolerance))
        if normalization_errors:
            message = f"{normalization_errors} vertices have joint-weight sums different from one"
            if 5126 not in components:
                raise Invalid(message + "; quantized weight sums must be exact before normalization")
            self.issue(message + "; float-weight normalization requires review", "warnings")
        return {
            "joints": joint_array,
            "weights": weight_array,
            "summary": {
                "influence_sets": indices,
                "weight_component_types": components,
                "weight_sum_min": float(total.min()), "weight_sum_max": float(total.max()),
                "positive_influences_min": int(influences.min()), "positive_influences_max": int(influences.max()),
                "vertices_with_weight_sum_warning": normalization_errors,
                "joint_index_min": int(joint_array.min()), "joint_index_max": int(joint_array.max()),
            },
        }

    def inspect_primitive(self, mesh_index, prim_index, primitive):
        attributes = primitive.get("attributes", {})
        if "POSITION" not in attributes:
            raise Invalid("Primitive has no POSITION accessor")
        position_ref = at(self.doc.get("accessors", []), attributes["POSITION"], "POSITION")
        if position_ref.get("type") != "VEC3":
            raise Invalid("POSITION must be VEC3")
        if "min" not in position_ref or "max" not in position_ref:
            raise Invalid("POSITION requires min and max")
        if position_ref.get("componentType") != 5126 and "KHR_mesh_quantization" not in self.doc.get("extensionsUsed", []):
            raise Invalid("Nonfloat POSITION requires KHR_mesh_quantization")
        position = self.accessor(attributes["POSITION"])
        vertices = len(position)
        uv_sets = {}
        for semantic, accessor_index in attributes.items():
            array = self.accessor(accessor_index)
            if len(array) != vertices:
                raise Invalid(f"{semantic} count differs from POSITION count")
            descriptor = self.doc["accessors"][accessor_index]
            if semantic.startswith("TEXCOORD_"):
                if descriptor["type"] != "VEC2":
                    raise Invalid("TEXCOORD must be VEC2")
                uv_sets[semantic] = {"min": array.min(axis=0).tolist(), "max": array.max(axis=0).tolist(), "outside_unit_square": bool(np.any((array < 0) | (array > 1)))}
            if semantic == "NORMAL" and descriptor["type"] != "VEC3":
                raise Invalid("NORMAL must be VEC3")
            if semantic == "NORMAL" and np.any(np.linalg.norm(array, axis=1) < 1e-8):
                self.issue(f"Mesh {mesh_index} primitive {prim_index} has zero-length normals", "warnings")
        skin_attributes = self.inspect_skin_attributes(attributes)
        if skin_attributes is not None:
            self.mesh_skin_attributes[(mesh_index, prim_index)] = skin_attributes
        if "indices" in primitive:
            descriptor = at(self.doc.get("accessors", []), primitive["indices"], "indices")
            if descriptor.get("type") != "SCALAR" or descriptor.get("componentType") not in (5121, 5123, 5125) or descriptor.get("normalized"):
                raise Invalid("Index accessor must contain unnormalized unsigned scalars")
            if "bufferView" in descriptor and "byteStride" in self.doc["bufferViews"][descriptor["bufferView"]]:
                raise Invalid("Index bufferView cannot have byteStride")
            indices = self.accessor(primitive["indices"]).ravel().astype(np.int64)
            if indices.max() >= vertices:
                raise Invalid("Primitive index exceeds vertex count")
        else:
            indices = np.arange(vertices, dtype=np.int64)
        mode = primitive.get("mode", 4)
        if type(mode) is not int or mode not in range(7):
            raise Invalid("Invalid primitive mode")
        count = len(indices)
        if mode == 4:
            if count % 3:
                raise Invalid("TRIANGLES index/vertex count is not divisible by three")
            triangles = indices.reshape((-1, 3))
        elif mode == 5:
            triangles = np.column_stack((indices[:-2], indices[1:-1], indices[2:])) if count >= 3 else np.empty((0, 3), dtype=int)
        elif mode == 6:
            triangles = np.column_stack((np.full(max(0, count - 2), indices[0]), indices[1:-1], indices[2:])) if count >= 3 else np.empty((0, 3), dtype=int)
        else:
            triangles = np.empty((0, 3), dtype=int)
            self.issue(f"Mesh {mesh_index} primitive {prim_index} is mode {mode}, not a triangle surface", "warnings")
        if len(triangles):
            points = position[triangles].astype(np.float64)
            twice_area = np.linalg.norm(np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0]), axis=1)
            degenerate = int(np.count_nonzero(twice_area <= 1e-14))
        else:
            degenerate = 0
        if "material" in primitive:
            material = primitive["material"]
            at(self.doc.get("materials", []), material, "primitive.material")
            if material not in self.texture_uvs:
                raise Invalid("Primitive material did not validate")
            for uv in self.texture_uvs[material]:
                if f"TEXCOORD_{uv}" not in attributes:
                    raise Invalid(f"Material uses TEXCOORD_{uv}, but primitive does not provide it")
        else:
            material = None
        if primitive.get("targets"):
            self.issue(f"Mesh {mesh_index} primitive {prim_index} morph targets are not evaluated in bounds", "unsupported")
            for target in primitive["targets"]:
                for ref in target.values():
                    if len(self.accessor(ref)) != vertices:
                        raise Invalid("Morph target count differs from POSITION")
        if "KHR_draco_mesh_compression" in primitive.get("extensions", {}):
            self.issue(f"Mesh {mesh_index} primitive {prim_index} Draco data has not been decoded", "unsupported")
        self.mesh_positions.setdefault(mesh_index, []).append(position[np.unique(indices)])
        return {"primitive": prim_index, "vertices": vertices, "index_count": count if "indices" in primitive else 0, "mode": mode, "triangles": len(triangles), "degenerate_triangles": degenerate, "material": material, "uv_sets": uv_sets, "skin_attributes": skin_attributes["summary"] if skin_attributes else None, "local_bounds_min": position.min(axis=0).tolist(), "local_bounds_max": position.max(axis=0).tolist()}

    def inspect_mesh(self, index):
        mesh = self.doc["meshes"][index]
        primitives = mesh.get("primitives", [])
        if not primitives:
            raise Invalid("Mesh contains no primitives")
        result = {"index": index, "name": mesh.get("name"), "primitives": []}
        self.report["meshes"].append(result)
        for pi, primitive in enumerate(primitives):
            item = self.guarded(f"mesh {index}, primitive {pi}", self.inspect_primitive, index, pi, primitive)
            if item is not None:
                result["primitives"].append(item)

    def local_matrix(self, node):
        if "matrix" in node:
            if any(x in node for x in ("translation", "rotation", "scale")):
                raise Invalid("Node cannot combine matrix and TRS")
            matrix = finite_vector(node["matrix"], 16, "node.matrix").reshape((4, 4), order="F")
            if not np.allclose(matrix[3], [0, 0, 0, 1], atol=1e-7):
                raise Invalid("Node matrix is not affine")
            return matrix
        translation = finite_vector(node.get("translation", [0, 0, 0]), 3, "node.translation")
        scale = finite_vector(node.get("scale", [1, 1, 1]), 3, "node.scale")
        x, y, z, w = finite_vector(node.get("rotation", [0, 0, 0, 1]), 4, "node.rotation")
        if not np.isclose(x*x + y*y + z*z + w*w, 1, atol=1e-4):
            raise Invalid("Node quaternion is not normalized")
        rotation = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
        matrix = np.eye(4)
        matrix[:3, :3] = rotation @ np.diag(scale)
        matrix[:3, 3] = translation
        return matrix

    def inspect_skin(self, index, parents):
        skin = self.doc["skins"][index]
        joints = skin.get("joints")
        if not isinstance(joints, list) or not joints:
            raise Invalid("skin.joints must be a nonempty array")
        for joint in joints:
            at(self.doc.get("nodes", []), joint, "skin.joints node")
        if len(set(joints)) != len(joints):
            raise Invalid("skin.joints contains duplicate nodes")
        common_ancestors = None
        for joint in joints:
            ancestors, cursor = {joint}, joint
            while cursor in parents:
                cursor = parents[cursor]
                ancestors.add(cursor)
            common_ancestors = ancestors if common_ancestors is None else common_ancestors & ancestors
        if not common_ancestors:
            raise Invalid("Skin joints have no common root node")
        if "skeleton" in skin:
            at(self.doc.get("nodes", []), skin["skeleton"], "skin.skeleton")
            if skin["skeleton"] not in common_ancestors:
                raise Invalid("skin.skeleton is not an ancestor of every joint")
        matrix_count = len(joints)
        if "inverseBindMatrices" in skin:
            ref = skin["inverseBindMatrices"]
            descriptor = at(self.doc.get("accessors", []), ref, "skin.inverseBindMatrices")
            if descriptor.get("type") != "MAT4" or descriptor.get("componentType") != 5126 or descriptor.get("normalized", False):
                raise Invalid("Inverse bind matrices must be unnormalized float MAT4 data")
            flat = self.accessor(ref)
            matrix_count = len(flat)
            if matrix_count < len(joints):
                raise Invalid("Inverse bind matrix count is smaller than skin.joints length")
            matrices = flat.reshape((-1, 4, 4)).transpose((0, 2, 1)).astype(np.float64)
            if not np.allclose(matrices[:, 3, :], [0, 0, 0, 1], rtol=0, atol=1e-7):
                raise Invalid("Inverse bind matrices must have affine fourth row [0,0,0,1]")
            determinant = np.linalg.det(matrices)
            if not np.isfinite(determinant).all() or np.any(determinant == 0):
                raise Invalid("Inverse bind matrix is nonfinite or singular")
            if matrix_count > len(joints):
                self.issue(f"Skin {index} has unused trailing inverse bind matrices", "warnings")
        item = {
            "index": index, "name": skin.get("name"), "joint_count": len(joints),
            "joints": joints, "skeleton": skin.get("skeleton"),
            "common_ancestor_nodes": sorted(common_ancestors),
            "inverse_bind_matrices_accessor": skin.get("inverseBindMatrices"),
            "inverse_bind_matrices_count": matrix_count,
            "inverse_bind_matrices_default_identity": "inverseBindMatrices" not in skin,
            "inverse_bind_matrices_finite_affine": True,
        }
        self.validated_skins[index] = item
        self.report["skins"].append(item)

    def inspect_skin_instance(self, node_index, node, scene_membership):
        skin_index, mesh_index = node["skin"], node["mesh"]
        if skin_index not in self.validated_skins:
            raise Invalid("Node references a skin that did not validate")
        skin = self.validated_skins[skin_index]
        for scene_index, members in scene_membership.items():
            if node_index in members and not set(skin["joints"]).issubset(members):
                raise Invalid(f"Skin joints are absent from scene {scene_index} containing the skinned mesh")
        mesh = self.doc["meshes"][mesh_index]
        for primitive_index, primitive in enumerate(mesh["primitives"]):
            attributes = primitive.get("attributes", {})
            if "JOINTS_0" not in attributes or "WEIGHTS_0" not in attributes:
                raise Invalid("Every primitive of a skinned node needs JOINTS_0 and WEIGHTS_0")
            data = self.mesh_skin_attributes.get((mesh_index, primitive_index))
            if data is None:
                raise Invalid("Skinned primitive attributes did not validate")
            # Validate zero-weight slots too; glTF requires every index in range.
            if np.any(data["joints"] >= skin["joint_count"]):
                raise Invalid(f"JOINTS index exceeds skin {skin_index} joint count {skin['joint_count']}")
        self.report["skin_instances"].append({"node": node_index, "mesh": mesh_index, "skin": skin_index, "joint_indices_in_range": True, "all_primitives_have_valid_joint_weight_pairs": True})

    def inspect_scene(self):
        nodes = self.doc.get("nodes", [])
        matrices, parents = {}, {}
        for ni, node in enumerate(nodes):
            matrices[ni] = self.local_matrix(node)
            if "mesh" in node:
                at(self.doc.get("meshes", []), node["mesh"], "node.mesh")
            if "skin" in node:
                at(self.doc.get("skins", []), node["skin"], "node.skin")
                if "mesh" not in node:
                    raise Invalid("A node with skin must also reference a mesh")
                self.issue(f"Node {ni} uses skinning; deformed bounds are not evaluated", "unsupported")
            children = node.get("children", [])
            if len(set(children)) != len(children):
                raise Invalid("Duplicate child in node.children")
            for child in children:
                at(nodes, child, "node.child")
                if child in parents:
                    raise Invalid("Node has more than one parent")
                parents[child] = ni
            self.report["nodes"].append({"index": ni, "name": node.get("name"), "mesh": node.get("mesh"), "children": children, "local_origin": matrices[ni][:3, 3].tolist(), "local_matrix_column_major": matrices[ni].flatten(order="F").tolist()})
        visited, active = set(), set()

        def check_cycle(index):
            if index in active:
                raise Invalid("Node hierarchy contains a cycle")
            if index in visited:
                return
            active.add(index)
            for child in nodes[index].get("children", []):
                check_cycle(child)
            active.remove(index)
            visited.add(index)

        for ni in range(len(nodes)):
            check_cycle(ni)
        for si in range(len(self.doc.get("skins", []))):
            self.guarded(f"skin {si}", self.inspect_skin, si, parents)
        scenes = self.doc.get("scenes", [])
        if not scenes:
            self.issue("No scene defined; scene bounds cannot be certified", "unsupported")
            return
        scene_membership = {}
        for si, scene in enumerate(scenes):
            if len(set(scene.get("nodes", []))) != len(scene.get("nodes", [])):
                raise Invalid("Scene contains duplicate root nodes")
            for root in scene.get("nodes", []):
                at(nodes, root, "scene.node")
                if root in parents:
                    raise Invalid("Scene root is also a child node")
            members, pending = set(), list(scene.get("nodes", []))
            while pending:
                current = pending.pop()
                members.add(current)
                pending.extend(nodes[current].get("children", []))
            scene_membership[si] = members
        for ni, node in enumerate(nodes):
            if "skin" in node:
                self.guarded(f"skin instance node {ni}", self.inspect_skin_instance, ni, node, scene_membership)
        scene_index = self.doc.get("scene", 0)
        scene = at(scenes, scene_index, "default scene")
        self.report["bounds_scene_index"] = scene_index
        if "scene" not in self.doc:
            self.issue("No default scene specified; bounds use scene 0", "warnings")
        minima, maxima, instance_count = [], [], 0

        def visit(index, parent):
            nonlocal instance_count
            node = nodes[index]
            world = parent @ matrices[index]
            self.report["nodes"][index]["world_origin"] = world[:3, 3].tolist()
            if "EXT_mesh_gpu_instancing" in node.get("extensions", {}):
                self.issue(f"Node {index} GPU instances are not evaluated", "unsupported")
            if "mesh" in node:
                instance_count += 1
                for position in self.mesh_positions.get(node["mesh"], []):
                    transformed = position.astype(np.float64) @ world[:3, :3].T + world[:3, 3]
                    if not np.isfinite(transformed).all():
                        raise Invalid("World-space vertices contain nonfinite values")
                    minima.append(transformed.min(axis=0))
                    maxima.append(transformed.max(axis=0))
            for child in node.get("children", []):
                visit(child, world)

        for root in scene.get("nodes", []):
            visit(root, np.eye(4))
        if not minima:
            raise Invalid("Selected scene contains no decoded mesh vertices")
        low, high = np.min(minima, axis=0), np.max(maxima, axis=0)
        size, center = high - low, (low + high) / 2
        ground_center = np.array([center[0], low[1], center[2]])
        target = finite_vector(self.target["target_size_m_xyz"], 3, "manifest target dimensions")
        self.report["world_bounds"] = {"min": low.tolist(), "max": high.tolist(), "size_xyz": size.tolist(), "center": center.tolist(), "ground_center_y_up": ground_center.tolist(), "mesh_instances": instance_count, "units": "glTF meters, without claiming generated scale is physically calibrated"}
        self.report["pivot_and_scale"] = {"scene_origin": [0, 0, 0], "origin_to_ground_center": ground_center.tolist(), "ground_centered_within_1mm": bool(np.linalg.norm(ground_center) <= .001), "target_size_m_xyz": target.tolist(), "target_over_raw_scale_xyz": [float(t/s) if s > 0 else None for t, s in zip(target, size)], "uniform_scale_to_target_height": float(target[1]/size[1]) if size[1] > 0 else None, "raw_axis_convention": "glTF Y-up; intended object front +Z is NOT VERIFIED"}
        names = {node.get("name", "") for node in nodes}
        self.report["manifest"]["expected_nodes_found_exactly"] = {name: name in names for name in self.target.get("expected_nodes_after_blender", [])}

    def run(self):
        self.guarded("container", self.container)
        if self.doc:
            for index in range(len(self.doc.get("accessors", []))):
                self.guarded(f"accessor {index}", self.accessor, index)
            for index in range(len(self.doc.get("images", []))):
                self.guarded(f"image {index}", self.inspect_image, index)
            for index in range(len(self.doc.get("textures", []))):
                self.guarded(f"texture {index}", self.inspect_texture, index)
            for index in range(len(self.doc.get("materials", []))):
                self.guarded(f"material {index}", self.inspect_material, index)
            for index in range(len(self.doc.get("meshes", []))):
                self.guarded(f"mesh {index}", self.inspect_mesh, index)
            if not self.doc.get("meshes"):
                self.issue("Document contains no meshes")
            self.guarded("scene", self.inspect_scene)
            if not self.report["images"]:
                self.issue("No images found; requested textured output is not demonstrated", "warnings")
            if not any(m["has_base_color_texture"] for m in self.report["materials"]):
                self.issue("No base-color texture is assigned to a material", "warnings")
            if self.doc.get("animations"):
                self.issue("Animation channels are not evaluated by this static inspector", "warnings")
        primitives = [p for mesh in self.report["meshes"] for p in mesh["primitives"]]
        self.report["summary"] = {"mesh_count": len(self.report["meshes"]), "primitive_count": len(primitives), "node_count": len(self.report["nodes"]), "skin_count": len(self.doc.get("skins", [])), "animation_count": len(self.doc.get("animations", [])), "vertex_count_sum_primitives": sum(p["vertices"] for p in primitives), "triangle_count_sum_primitives": sum(p["triangles"] for p in primitives), "degenerate_triangles": sum(p["degenerate_triangles"] for p in primitives), "material_count": len(self.report["materials"]), "image_count": len(self.report["images"]), "images_fully_decoded": sum(i["decoded"] for i in self.report["images"]), "accessors_decoded": len(self.arrays)}
        skin_node_count = sum("skin" in node for node in self.doc.get("nodes", []))
        self.report["skinning_data_validation"] = {
            "status": "not_present" if not self.doc.get("skins") and not skin_node_count else "passed" if len(self.validated_skins) == len(self.doc.get("skins", [])) and len(self.report["skin_instances"]) == skin_node_count else "failed",
            "skins_validated": len(self.validated_skins), "instances_validated": len(self.report["skin_instances"]),
            "deformation_evaluated": False, "animation_motion_verified": False,
        }
        self.report["status"] = "failed" if self.report["errors"] else "blocked_unsupported" if self.report["unsupported"] else "passed_implemented_checks"
        self.report["ready_for_visual_review"] = not self.report["errors"] and not self.report["unsupported"]
        return self.report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("--asset-id", required=True)
    parser.add_argument("--manifest", type=Path, default=ROOT / "PeterPansTechland_Tripo_Generation_Pack/manifest.json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not args.asset_id or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for c in args.asset_id):
        parser.error("--asset-id must contain only letters, numbers, underscore, or hyphen")
    destination = args.output or ROOT / "assets/tripo/records" / f"{args.asset_id}.qa.json"
    try:
        report = Inspector(args.model, args.asset_id, args.manifest).run()
    except (Invalid, OSError, ValueError, KeyError, TypeError) as error:
        report = {"schema_version": 1, "asset_id": args.asset_id, "source_file": str(args.model.resolve()), "status": "failed", "errors": [str(error)], "visual_review": "NOT_PERFORMED", "qa_approved": False}
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "report": str(destination.resolve()), "summary": report.get("summary"), "errors": report.get("errors", []), "unsupported": report.get("unsupported", [])}, ensure_ascii=False))
    return 1 if report["status"] == "failed" else 2 if report["status"] == "blocked_unsupported" else 0


if __name__ == "__main__":
    sys.exit(main())
