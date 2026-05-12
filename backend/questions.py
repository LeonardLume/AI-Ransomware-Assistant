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
def load_demo_profiles() -> dict[str, Any]:
    with open(DATA_DIR / "demo_profiles.json", "r", encoding="utf-8") as f:
        return json.load(f)


def question_map() -> dict[str, dict[str, Any]]:
    return {q["id"]: q for q in load_questions()}


def grouped_questions() -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for q in load_questions():
        grouped.setdefault(q["domain"], []).append(q)
    return grouped
