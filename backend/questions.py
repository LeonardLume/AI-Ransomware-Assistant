import json
from functools import lru_cache
from typing import Any

from backend.config import DATA_DIR


@lru_cache(maxsize=1)
def load_questions() -> list[dict[str, Any]]:
    with open(DATA_DIR / "questions.json", "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_scoring_rules() -> dict[str, dict[str, int]]:
    with open(DATA_DIR / "scoring_rules.json", "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_domain_metadata() -> dict[str, dict[str, str]]:
    with open(DATA_DIR / "domain_metadata.json", "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_source_notes() -> list[dict[str, str]]:
    with open(DATA_DIR / "source_notes.json", "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_source_registry() -> list[dict[str, Any]]:
    with open(DATA_DIR / "source_registry.json", "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_assessment_methodology() -> dict[str, Any]:
    with open(DATA_DIR / "assessment_methodology.json", "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_scoring_rationale() -> dict[str, dict[str, dict[str, str]]]:
    with open(DATA_DIR / "scoring_rationale.json", "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_threat_overlay_notes() -> dict[str, Any]:
    with open(DATA_DIR / "threat_overlay_notes.json", "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_demo_profiles() -> dict[str, Any]:
    with open(DATA_DIR / "demo_profiles.json", "r", encoding="utf-8") as f:
        return json.load(f)


def question_map() -> dict[str, dict[str, Any]]:
    return {q["id"]: q for q in load_questions()}


def source_registry_map() -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in load_source_registry()}


def resolve_source_refs(source_ref_ids: list[str] | None) -> list[dict[str, Any]]:
    registry = source_registry_map()
    resolved: list[dict[str, Any]] = []
    for ref_id in source_ref_ids or []:
        item = registry.get(ref_id)
        if item:
            resolved.append(item)
    return resolved


def grouped_questions() -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for q in load_questions():
        grouped.setdefault(q["domain"], []).append(q)
    return grouped
