#!/usr/bin/env python3
"""Offline device contracts and local inventory. Never opens a device or network."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import tempfile
from typing import Any
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
MAX_DOCUMENT_BYTES = 256 * 1024
IDENTIFIER = re.compile(r"[a-z][a-z0-9-]{0,63}\Z")


class ContractError(ValueError):
    """Input is invalid; messages describe fields rather than supplied values."""


def _object(pairs: list[tuple[str, Any]]) -> dict:
    result: dict = {}
    for key, value in pairs:
        if key in result:
            raise ContractError("JSON contains a duplicate key")
        result[key] = value
    return result


def _constant(_: str) -> None:
    raise ContractError("JSON numbers must be finite")


def _float(value: str) -> float:
    result = float(value)
    if not math.isfinite(result):
        raise ContractError("JSON numbers must be finite")
    return result


def _finite(value: Any) -> bool:
    return type(value) is int or (type(value) is float and math.isfinite(value))


def read_json(path: Path) -> Any:
    with path.open("rb") as handle:
        data = handle.read(MAX_DOCUMENT_BYTES + 1)
    if len(data) > MAX_DOCUMENT_BYTES:
        raise ContractError("JSON document exceeds 256 KiB")
    try:
        return json.loads(data, object_pairs_hook=_object, parse_constant=_constant, parse_float=_float)
    except (ValueError, UnicodeError, RecursionError) as error:
        if isinstance(error, ContractError):
            raise
        raise ContractError("Invalid UTF-8 JSON document") from None


def check_schema(value: Any, schema: dict, *, root: dict | None = None, path: str = "$") -> None:
    """Validate the explicitly used JSON Schema subset, without third-party packages.

    profile.schema.json is also usable by a full Draft 2020-12 validator. This
    small validator intentionally fails on unsupported validation keywords.
    """
    root = schema if root is None else root
    if "$ref" in schema:
        reference = schema["$ref"]
        if not reference.startswith("#/$defs/"):
            raise ContractError("Schema contains an unsupported reference")
        return check_schema(value, root["$defs"][reference.split("/")[-1]], root=root, path=path)
    supported = {"$schema", "$id", "$defs", "title", "description", "type", "const", "enum",
                 "properties", "required", "additionalProperties", "items", "minItems", "maxItems",
                 "uniqueItems", "minLength", "maxLength", "pattern", "minimum", "maximum"}
    if set(schema) - supported:
        raise ContractError("Schema contains unsupported validation keywords")
    types = {"object": lambda x: isinstance(x, dict), "array": lambda x: isinstance(x, list),
             "string": lambda x: isinstance(x, str), "integer": lambda x: type(x) is int,
             "number": _finite,
             "boolean": lambda x: type(x) is bool, "null": lambda x: x is None}
    expected = schema.get("type")
    if expected is not None:
        names = expected if isinstance(expected, list) else [expected]
        if not any(types[name](value) for name in names):
            raise ContractError(f"{path}: wrong type")
    if "const" in schema and (type(value) is not type(schema["const"]) or value != schema["const"]):
        raise ContractError(f"{path}: invalid fixed value")
    if "enum" in schema and value not in schema["enum"]:
        raise ContractError(f"{path}: unsupported value")
    if isinstance(value, dict):
        properties = schema.get("properties", {})
        if any(key not in value for key in schema.get("required", [])):
            raise ContractError(f"{path}: missing required field")
        if schema.get("additionalProperties") is False and set(value) - set(properties):
            raise ContractError(f"{path}: unknown fields are forbidden (including inline credentials)")
        for key, item in value.items():
            if key in properties:
                check_schema(item, properties[key], root=root, path=f"{path}.{key}")
    if isinstance(value, list):
        if not schema.get("minItems", 0) <= len(value) <= schema.get("maxItems", MAX_DOCUMENT_BYTES):
            raise ContractError(f"{path}: invalid item count")
        if schema.get("uniqueItems") and len({json.dumps(x, sort_keys=True) for x in value}) != len(value):
            raise ContractError(f"{path}: duplicate items")
        for index, item in enumerate(value):
            if "items" in schema:
                check_schema(item, schema["items"], root=root, path=f"{path}[{index}]")
    if isinstance(value, str):
        if not schema.get("minLength", 0) <= len(value) <= schema.get("maxLength", MAX_DOCUMENT_BYTES):
            raise ContractError(f"{path}: invalid string length")
        if "pattern" in schema and re.search(schema["pattern"], value) is None:
            raise ContractError(f"{path}: invalid string format")
    if type(value) in (int, float):
        if not _finite(value):
            raise ContractError(f"{path}: number must be finite")
        if value < schema.get("minimum", -math.inf) or value > schema.get("maximum", math.inf):
            raise ContractError(f"{path}: number outside allowed range")


def digest(document: dict) -> str:
    return hashlib.sha256(json.dumps(document, sort_keys=True, ensure_ascii=False,
                                    separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def validate_profile(profile: Any) -> dict:
    check_schema(profile, read_json(HERE / "profile.schema.json"))
    transports = {item["id"]: item for item in profile["transports"]}
    if len(transports) != len(profile["transports"]):
        raise ContractError("transports: duplicate id")
    capabilities = {item["id"]: item for item in profile["capabilities"]}
    if len(capabilities) != len(profile["capabilities"]):
        raise ContractError("capabilities: duplicate id")
    if profile["status"] == "supported" and not profile["adapter"]["runtime_available"]:
        raise ContractError("supported profiles require an existing runtime adapter")
    if profile["status"] == "supported" and not any(item["status"] == "supported" for item in transports.values()):
        raise ContractError("supported profiles require a supported transport")
    for transport in transports.values():
        if transport["origin"] is not None:
            parsed = urlsplit(transport["origin"])
            try:
                port = parsed.port
            except ValueError:
                raise ContractError("transport origin has an invalid port") from None
            if (transport["kind"] != "http" or parsed.scheme not in ("http", "https") or
                    not parsed.hostname or parsed.username is not None or parsed.password is not None or
                    parsed.path not in ("", "/") or parsed.query or parsed.fragment or port == 0):
                raise ContractError("transport origin must be a fixed HTTP(S) origin without credentials")
        if transport["kind"] == "ble" and transport["status"] == "supported" and (
                not transport["service_uuid"] or not transport["characteristic_uuid"] or
                not profile["adapter"]["runtime_available"]):
            raise ContractError("supported BLE requires UUIDs and an existing runtime adapter")
    for capability in capabilities.values():
        if "effects" in capability and (capability["id"] != "light" or capability["kind"] != "actuator" or
                                        not capability["writable"] or "solid" not in capability["effects"]):
            raise ContractError("light effects require a writable light actuator and the solid default")
        mapping_ids = [item["transport_id"] for item in capability["mappings"]]
        if len(mapping_ids) != len(set(mapping_ids)) or any(item not in transports for item in mapping_ids):
            raise ContractError("capability mappings require unique, declared transport ids")
        if capability["status"] == "supported" and (not profile["adapter"]["runtime_available"] or
                not any(transports[item]["status"] == "supported" for item in mapping_ids)):
            raise ContractError("supported capability requires an existing adapter and supported mapping")
        if capability["kind"] == "measurement" and capability["sample"] is None:
            raise ContractError("measurement capabilities require sample field mappings")
        if capability["kind"] != "measurement" and capability["sample"] is not None:
            raise ContractError("only measurements may have sample field mappings")
        limits = capability["limits"]
        if limits["minimum"] is not None and limits["maximum"] is not None and limits["minimum"] > limits["maximum"]:
            raise ContractError("capability limits are inverted")
        if capability["writable"]:
            if capability["risk"] == "none" or not capability["interlocks"]:
                raise ContractError("writable capabilities require risk and interlocks")
            if not any(item["write"] is not None for item in capability["mappings"]):
                raise ContractError("writable capability requires a declared write mapping")
            if capability["id"] in {"water", "irrigation-zone"} and limits["max_duration_ms"] is None:
                raise ContractError("water capabilities require a finite local duration bound")
        elif any(item["write"] is not None for item in capability["mappings"]):
            raise ContractError("read-only capability cannot have a write mapping")
    return profile


def load_profile(path: Path) -> dict:
    return validate_profile(read_json(path))


def _field(document: dict, path: str) -> Any:
    value: Any = document
    for key in path.split("."):
        if not isinstance(value, dict) or key not in value:
            raise ContractError(f"fixture: required field {path} is missing")
        value = value[key]
    return value


def mock_check(profile: dict, fixture: Any) -> dict:
    """Check supplied telemetry bytes only; no adapter or credential is loaded."""
    validate_profile(profile)
    if not isinstance(fixture, dict) or type(fixture.get("schema_version")) is not int or fixture["schema_version"] != 1:
        raise ContractError("fixture: schema_version must be integer 1")
    if not isinstance(fixture.get("device_id"), str) or not fixture["device_id"] or len(fixture["device_id"]) > 128:
        raise ContractError("fixture: device_id is required")
    age = fixture.get("sample_age_ms")
    if type(age) is not int or age < 0:
        raise ContractError("fixture: sample_age_ms must be a nonnegative integer")
    observations = []
    for capability in profile["capabilities"]:
        sample = capability["sample"]
        if sample is None:
            continue
        value, valid = _field(fixture, sample["value_path"]), _field(fixture, sample["valid_path"])
        if type(valid) is not bool or (value is not None and not _finite(value)):
            raise ContractError("fixture: readings require finite numeric/null value and boolean valid")
        calibrated = _field(fixture, sample["calibrated_path"]) if sample["calibrated_path"] else None
        if sample["calibrated_path"] and type(calibrated) is not bool:
            raise ContractError("fixture: calibrated must be boolean")
        if valid and value is None:
            raise ContractError("fixture: a valid reading cannot be null")
        limits = capability["limits"]
        if value is not None and ((limits["minimum"] is not None and value < limits["minimum"]) or
                                  (limits["maximum"] is not None and value > limits["maximum"])):
            raise ContractError("fixture: reading outside declared limits")
        reasons = []
        if not valid:
            reasons.append("invalid")
        if value is None:
            reasons.append("unknown")
        if calibrated is False:
            reasons.append("uncalibrated")
        if age > profile["max_sample_age_ms"]:
            reasons.append("stale")
        observations.append({"capability_id": capability["id"], "value": value,
                             "unit": capability["unit"], "usable": not reasons, "reasons": reasons})
    return {"ok": True, "scope": "offline_fixture_only", "profile_id": profile["profile_id"],
            "profile_status": profile["status"], "fixture_device_id": fixture["device_id"],
            "hardware_verified": False, "yoyo_bound": False, "execution_enabled": False,
            "observations": observations}


def load_registry(path: Path) -> dict:
    registry = read_json(path) if path.exists() else {"schema_version": 1, "devices": []}
    if (not isinstance(registry, dict) or set(registry) != {"schema_version", "devices"} or
            type(registry["schema_version"]) is not int or registry["schema_version"] != 1 or
            not isinstance(registry["devices"], list)):
        raise ContractError("invalid local registry")
    fields = {"device_id", "hardware_id", "label", "profile_id", "profile_sha256", "transport_id", "profile_status",
              "stage", "registered_at", "last_mock_check"}
    seen = set()
    for entry in registry["devices"]:
        if (not isinstance(entry, dict) or set(entry) != fields or
                not isinstance(entry["device_id"], str) or not IDENTIFIER.fullmatch(entry["device_id"]) or
                entry["device_id"] in seen or not isinstance(entry["stage"], str) or
                entry["stage"] not in {"registered_offline", "offline_checked", "retired"} or
                not isinstance(entry["profile_status"], str) or entry["profile_status"] not in {"supported", "experimental", "planned"} or
                not isinstance(entry["profile_sha256"], str) or re.fullmatch(r"[0-9a-f]{64}", entry["profile_sha256"]) is None or
                any(not isinstance(entry[field], str) for field in ("hardware_id", "label", "profile_id", "transport_id", "registered_at")) or
                (entry["last_mock_check"] is not None and (not isinstance(entry["last_mock_check"], dict) or
                 set(entry["last_mock_check"]) != {"checked_at", "fixture_sha256", "scope"} or
                 entry["last_mock_check"]["scope"] != "offline_fixture_only"))):
            raise ContractError("invalid local registry entry")
        seen.add(entry["device_id"])
    return registry


def save_registry(path: Path, registry: dict) -> None:
    """Atomic replace; a local inventory, intended for one writer at a time."""
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
            name = handle.name
            json.dump(registry, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
    finally:
        if name and os.path.exists(name):
            os.unlink(name)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def register(path: Path, profile: dict, device_id: str, label: str, transport_id: str,
             hardware_id: str | None = None) -> dict:
    validate_profile(profile)
    hardware_id = device_id if hardware_id is None else hardware_id
    if IDENTIFIER.fullmatch(device_id) is None or not 1 <= len(label) <= 80 or any(ord(c) < 32 for c in label):
        raise ContractError("device id or label has invalid format")
    if not 1 <= len(hardware_id) <= 128 or any(ord(c) < 32 for c in hardware_id):
        raise ContractError("hardware id has invalid format")
    if transport_id not in {transport["id"] for transport in profile["transports"]}:
        raise ContractError("transport id is not declared by profile")
    registry = load_registry(path)
    if any(entry["device_id"] == device_id for entry in registry["devices"]):
        raise ContractError("device id is already registered; overwrite is forbidden")
    entry = {"device_id": device_id, "hardware_id": hardware_id, "label": label, "profile_id": profile["profile_id"],
             "profile_sha256": digest(profile), "transport_id": transport_id, "profile_status": profile["status"],
             "stage": "registered_offline", "registered_at": utc_now(), "last_mock_check": None}
    registry["devices"].append(entry)
    save_registry(path, registry)
    return entry


def record_mock(path: Path, device_id: str, profile: dict, fixture: dict) -> None:
    mock_check(profile, fixture)
    registry = load_registry(path)
    entry = next((entry for entry in registry["devices"] if entry["device_id"] == device_id), None)
    if entry is None or entry["stage"] == "retired":
        raise ContractError("device is absent or retired")
    if entry["profile_sha256"] != digest(profile):
        raise ContractError("profile changed since registration; create a new version and device registration")
    if fixture["device_id"] != entry["hardware_id"]:
        raise ContractError("fixture device_id does not match registered hardware_id")
    entry["stage"] = "offline_checked"
    entry["last_mock_check"] = {"checked_at": utc_now(), "fixture_sha256": digest(fixture),
                                "scope": "offline_fixture_only"}
    save_registry(path, registry)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate", help="validate one or more profile manifests")
    validate.add_argument("profiles", type=Path, nargs="+")
    mock = commands.add_parser("mock-check", help="check a supplied fixture, with no network or device calls")
    mock.add_argument("--profile", type=Path, required=True)
    mock.add_argument("--fixture", type=Path, required=True)
    mock.add_argument("--registry", type=Path)
    mock.add_argument("--device-id")
    add = commands.add_parser("register", help="add an offline inventory record; does not pair or activate hardware")
    add.add_argument("--profile", type=Path, required=True)
    add.add_argument("--registry", type=Path, required=True)
    add.add_argument("--device-id", required=True)
    add.add_argument("--label", required=True)
    add.add_argument("--transport", required=True)
    add.add_argument("--hardware-id", help="exact device-reported identity; defaults to local device-id")
    listing = commands.add_parser("list", help="read the local inventory")
    listing.add_argument("--registry", type=Path, required=True)
    retire = commands.add_parser("retire", help="retire a local record; does not revoke real device credentials")
    retire.add_argument("--registry", type=Path, required=True)
    retire.add_argument("--device-id", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "validate":
            output = [{"profile_id": profile["profile_id"], "status": profile["status"], "sha256": digest(profile),
                       "runtime_available": profile["adapter"]["runtime_available"], "execution_enabled": False}
                      for profile in (load_profile(path) for path in args.profiles)]
        elif args.command == "register":
            output = register(args.registry, load_profile(args.profile), args.device_id, args.label, args.transport, args.hardware_id)
        elif args.command == "mock-check":
            if bool(args.registry) != bool(args.device_id):
                raise ContractError("--registry and --device-id must be supplied together")
            profile, fixture = load_profile(args.profile), read_json(args.fixture)
            output = mock_check(profile, fixture)
            if args.registry:
                record_mock(args.registry, args.device_id, profile, fixture)
        else:
            output = load_registry(args.registry)
            if args.command == "retire":
                entry = next((item for item in output["devices"] if item["device_id"] == args.device_id), None)
                if entry is None:
                    raise ContractError("device id is not registered")
                entry["stage"] = "retired"
                save_registry(args.registry, output)
        print(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False))
        return 0
    except (ContractError, OSError) as error:
        # Never print document contents or arbitrary exception messages from IO.
        message = str(error) if isinstance(error, ContractError) else "Could not read or write local file"
        print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
