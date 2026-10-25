#!/usr/bin/env python3
"""Offline source/evidence applicability. Never fetches data or controls hardware."""
from __future__ import annotations

import argparse
from datetime import date, datetime, time, timedelta, timezone
import json
from pathlib import Path
import re
from typing import Any
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
OPERATIONS = ("irrigation", "fertilization", "pruning", "grooming", "pollination", "grafting", "pest_management", "harvest")
STAGES = ("germination", "seedling", "vegetative", "flowering", "fruit_development", "ripening", "harvest", "senescence", "dormant")
ENVIRONMENTS = ("indoor", "balcony", "greenhouse", "open_field")
SOURCE_KINDS = ("reference", "official_guidance", "software", "dataset", "ontology", "weather", "model", "record_system", "research")
ANCHORS = ("sowing", "planting", "transplanting", "emergence", "established")
HABITS = ("annual", "biennial", "perennial", "determinate", "indeterminate")
LEAVES = ("plant_id", "taxon", "cultivar", "region.country", "region.admin1", "region.city", "environment", "goal", "cycle_anchor.kind", "cycle_anchor.date", "growth_habit", "last_confirmed_stage")
PATHS = set(LEAVES)
IDENTIFIER = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,95}\Z")
TAXON = re.compile(r"[A-Z][a-z]+ [a-z][a-z .-]*\Z")
DOSE = re.compile(r"(?:\d+(?:\.\d+)?|[零一二三四五六七八九十百千万两半]+)\s*(?:ml|liters?|litres?|mm|kg|mg|g|l|毫升|升|毫米|公斤|千克|毫克|克|%)(?![A-Za-z])", re.I)


class ValidationError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def fields(value: Any, required: set[str], optional: set[str] = frozenset()) -> None:
    require(isinstance(value, dict), "Expected an object")
    require(required <= set(value) <= required | optional, "Missing or unknown fields; execution/dose fields are forbidden")


def text(value: Any, *, nullable: bool = False) -> None:
    require(nullable and value is None or isinstance(value, str) and 0 < len(value) <= 2000, "Expected a nonempty string or allowed null")


def choice(value: Any, choices: tuple | set, *, nullable: bool = False) -> None:
    require(nullable and value is None or isinstance(value, str) and value in choices, "Invalid enumeration value")


def calendar(value: str) -> date:
    require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) is not None, "Expected YYYY-MM-DD")
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError("Invalid calendar date") from None


def instant(value: str) -> datetime:
    text(value)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ValidationError("Invalid observation timestamp") from None
    require(parsed.tzinfo is not None and parsed.utcoffset() is not None, "Observation timestamp needs an explicit timezone")
    return parsed.astimezone(timezone.utc)


def unique_ids(items: list) -> None:
    require(isinstance(items, list) and len(items) <= 10000, "Expected a bounded list")
    seen = set()
    for item in items:
        require(isinstance(item, dict) and isinstance(item.get("id"), str) and IDENTIFIER.fullmatch(item["id"]) is not None, "Invalid record id")
        require(item["id"] not in seen, "Duplicate record id")
        seen.add(item["id"])


def string_list(values: Any) -> None:
    require(isinstance(values, list) and 0 < len(values) <= 100, "Expected a nonempty bounded list")
    for value in values:
        text(value)
    require(len(values) == len(set(values)), "Duplicate list value")


def validate_sources(document: dict) -> dict[str, dict]:
    fields(document, {"schema_version", "reviewed_on", "sources"})
    require(type(document["schema_version"]) is int and document["schema_version"] == 1, "Unsupported schema_version")
    calendar(document["reviewed_on"])
    unique_ids(document["sources"])
    for source in document["sources"]:
        fields(source, {"id", "title", "publisher", "url", "kind", "topics", "scope", "access", "license", "reuse_policy", "notes"})
        for key in ("title", "publisher", "url", "scope", "access", "license", "reuse_policy", "notes"):
            text(source[key])
        choice(source["kind"], SOURCE_KINDS)
        string_list(source["topics"])
        url = urlsplit(source["url"])
        require(url.scheme == "https" and bool(url.hostname) and url.username is None and url.password is None, "Source URLs must be HTTPS without credentials")
    return {item["id"]: item for item in document["sources"]}


def validate_cards(document: dict, sources: dict[str, dict]) -> list[dict]:
    fields(document, {"schema_version", "cards"})
    require(type(document["schema_version"]) is int and document["schema_version"] == 1, "Unsupported schema_version")
    unique_ids(document["cards"])
    for card in document["cards"]:
        fields(card, {"id", "source_ids", "operation", "taxa", "countries", "environments", "stages", "required_fields", "summary"}, {"admin1"})
        for key in ("source_ids", "taxa", "countries", "environments", "stages"):
            string_list(card[key])
        require(set(card["source_ids"]) <= set(sources), "Card references a missing source")
        choice(card["operation"], OPERATIONS)
        require(all(TAXON.fullmatch(item) for item in card["taxa"]), "Cards require explicit Latin taxa, not wildcard species")
        require(all(item == "ANY" or re.fullmatch(r"[A-Z]{2}", item) for item in card["countries"]), "Invalid country code shape")
        if "admin1" in card:
            string_list(card["admin1"])
            require(all(item == "ANY" or re.fullmatch(r"[A-Z]{2}-[A-Z0-9]{1,3}", item) for item in card["admin1"]), "Invalid administrative subdivision code")
            require(all(item == "ANY" or "ANY" in card["countries"] or item[:2] in card["countries"] for item in card["admin1"]), "Subdivision country conflicts with card countries")
        for key, allowed in (("environments", ENVIRONMENTS), ("stages", STAGES)):
            require(set(card[key]) <= set(allowed) | {"ANY"}, "Invalid applicability enumeration")
        require(isinstance(card["required_fields"], list) and all(isinstance(item, str) and item in PATHS for item in card["required_fields"]), "Unknown required field path")
        require(len(card["required_fields"]) == len(set(card["required_fields"])), "Duplicate required field path")
        text(card["summary"])
        require(DOSE.search(card["summary"]) is None, "Quantified dose text is not allowed in reference cards")
    return document["cards"]


def validate_context(context: dict) -> dict:
    fields(context, {"plant_id", "taxon", "cultivar", "region", "environment", "goal", "cycle_anchor", "growth_habit", "observations"}, {"synthetic"})
    if "synthetic" in context:
        require(context["synthetic"] is True, "Example marker must be synthetic=true")
    for key in ("plant_id", "taxon", "cultivar", "goal"):
        text(context[key], nullable=True)
    if context["taxon"] is not None:
        require(TAXON.fullmatch(context["taxon"]) is not None, "Expected a Latin taxon")
    choice(context["environment"], ENVIRONMENTS, nullable=True)
    choice(context["growth_habit"], HABITS, nullable=True)
    if context["region"] is not None:
        fields(context["region"], {"country", "admin1", "city"})
        for value in context["region"].values():
            text(value, nullable=True)
        country = context["region"]["country"]
        require(country is None or re.fullmatch(r"[A-Z]{2}", country) is not None, "Country needs a two-letter code")
        admin1 = context["region"]["admin1"]
        require(admin1 is None or re.fullmatch(r"[A-Z]{2}-[A-Z0-9]{1,3}", admin1) is not None, "admin1 needs an ISO-shaped subdivision code")
        require(admin1 is None or country is None or admin1[:2] == country, "Context country and subdivision conflict")
    if context["cycle_anchor"] is not None:
        fields(context["cycle_anchor"], {"kind", "date"})
        choice(context["cycle_anchor"]["kind"], ANCHORS, nullable=True)
        if context["cycle_anchor"]["date"] is not None:
            calendar(context["cycle_anchor"]["date"])
    observations = context["observations"] if context["observations"] is not None else []
    unique_ids(observations)
    for observation in observations:
        fields(observation, {"id", "plant_id", "observed_at", "stage", "confirmed_by", "kind"})
        text(observation["plant_id"], nullable=True)
        choice(observation["stage"], STAGES, nullable=True)
        choice(observation["confirmed_by"], ("grower", "agronomist"), nullable=True)
        choice(observation["kind"], ("observed", "predicted"), nullable=True)
        if observation["observed_at"] is not None:
            instant(observation["observed_at"])
    return context


def value_at(context: dict, path: str) -> Any:
    value: Any = context
    for key in path.split("."):
        value = value.get(key) if isinstance(value, dict) else None
    return value


def envelope(**values: Any) -> dict:
    return {**values, "automatic_action": False, "mode": "offline_reference"}


def assess(context: dict, cards: list[dict], sources: dict[str, dict], as_of: str) -> dict:
    validate_context(context)
    validate_cards({"schema_version": 1, "cards": cards}, sources)
    cutoff = datetime.combine(calendar(as_of) + timedelta(days=1), time(), timezone.utc)
    candidates, ignored = [], []
    for item in context["observations"] or []:
        reason = ("different_plant" if context["plant_id"] is None or item["plant_id"] != context["plant_id"] else
                  "not_observed" if item["kind"] != "observed" else
                  "unconfirmed" if item["confirmed_by"] is None else
                  "unknown_stage_or_time" if item["stage"] is None or item["observed_at"] is None else
                  "after_as_of" if instant(item["observed_at"]) >= cutoff else None)
        if reason:
            ignored.append({"id": item["id"], "reason": reason})
        else:
            candidates.append(item)
    candidates.sort(key=lambda item: (instant(item["observed_at"]), item["id"]))
    latest = candidates[-1] if candidates else None
    if latest and len({item["stage"] for item in candidates if instant(item["observed_at"]) == instant(latest["observed_at"])}) > 1:
        latest = None
        ignored.append({"id": None, "reason": "multiple_stages_at_latest_time"})
    stage = latest["stage"] if latest else None
    view = {**context, "last_confirmed_stage": stage}
    missing = [path for path in LEAVES if value_at(view, path) is None]
    if context["observations"] is None:
        missing.append("observations")
    applicable, excluded = [], []
    for card in cards:
        reasons = []
        for field, allowed, reason in (("taxon", card["taxa"], "taxon_mismatch"),
                                       ("region.country", card["countries"], "country_mismatch"),
                                       ("environment", card["environments"], "environment_mismatch"),
                                       ("last_confirmed_stage", card["stages"], "stage_mismatch")):
            value = value_at(view, field)
            if "ANY" not in allowed and value not in allowed:
                reasons.append(reason)
        if "admin1" in card and "ANY" not in card["admin1"] and value_at(view, "region.admin1") not in card["admin1"]:
            reasons.append("admin1_mismatch")
        reasons += ["missing:" + path for path in card["required_fields"] if value_at(view, path) is None]
        if reasons:
            excluded.append({"id": card["id"], "operation": card["operation"], "reasons": reasons})
        else:
            applicable.append({"id": card["id"], "operation": card["operation"], "summary": card["summary"],
                               "sources": [sources[source_id] for source_id in card["source_ids"]]})
    return envelope(plant_id=context["plant_id"], synthetic=context.get("synthetic", False), as_of=as_of,
                    cutoff_timezone="UTC", last_confirmed_stage=stage,
                    stage_summary_note="Single-stage summary only; simultaneous stages return unknown here, not a biological contradiction. Future records need organ, inflorescence and cycle scope.",
                    stage_observation_id=latest["id"] if latest else None, missing=missing,
                    matched_references=applicable, excluded_cards=excluded, ignored_observations=ignored,
                    unsupported_operations=[operation for operation in OPERATIONS if not any(card["operation"] == operation for card in applicable)])


def read_json(path: Path) -> Any:
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "Duplicate JSON key")
            result[key] = value
        return result
    with path.open("rb") as handle:
        data = handle.read(1024 * 1024 + 1)
    require(len(data) <= 1024 * 1024, "JSON document exceeds 1 MiB")
    try:
        return json.loads(data, object_pairs_hook=pairs, parse_constant=lambda _: require(False, "Nonfinite JSON is forbidden"))
    except (UnicodeError, ValueError, RecursionError) as error:
        if isinstance(error, ValidationError):
            raise
        raise ValidationError("Invalid JSON") from None


def main(argv: list[str] | None = None) -> int:
    class Parser(argparse.ArgumentParser):
        def error(self, message):
            raise ValidationError("Invalid command line arguments")
    parser = Parser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=HERE / "sources.json")
    parser.add_argument("--evidence", type=Path, default=HERE / "evidence.json")
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate")
    validate.add_argument("--context", type=Path)
    search = commands.add_parser("sources")
    search.add_argument("--topic")
    run = commands.add_parser("assess")
    run.add_argument("--context", type=Path, required=True)
    run.add_argument("--as-of", required=True)
    try:
        args = parser.parse_args(argv)
        sources = validate_sources(read_json(args.sources))
        cards = validate_cards(read_json(args.evidence), sources)
        if args.command == "validate":
            if args.context:
                validate_context(read_json(args.context))
            output = envelope(ok=True, source_count=len(sources), card_count=len(cards))
        elif args.command == "sources":
            output = envelope(sources=[item for item in sources.values() if args.topic is None or any(args.topic.casefold() in topic.casefold() for topic in item["topics"])])
        else:
            output = assess(read_json(args.context), cards, sources, args.as_of)
        print(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False))
        return 0
    except (ValidationError, OSError, ValueError, OverflowError) as error:
        message = str(error) if isinstance(error, ValidationError) else "Invalid input or unreadable local file"
        print(json.dumps(envelope(ok=False, error=message), ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
