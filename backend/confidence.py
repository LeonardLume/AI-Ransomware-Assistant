from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from typing import Any

from backend.questions import question_map

EVIDENCE_HINTS = [
    "date",
    "kuupaev",
    "percentage",
    "percent",
    "protsent",
    "documented",
    "dokumenteeritud",
    "tested",
    "testitud",
    "report",
    "raport",
    "policy",
    "poliitika",
    "screenshot",
    "kuvatomm",
    "log",
    "audit",
    "ticket",
]
DATE_RE = re.compile(r"\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b")
PERCENT_RE = re.compile(r"\b\d{1,3}\s?%\b")


def calculate_domain_confidence(answer_records: dict[str, dict[str, Any]]) -> dict[str, str]:
    grouped: dict[str, list[str]] = defaultdict(list)
    qmap = question_map()

    for qid, record in answer_records.items():
        if qid.startswith("followup__") or qid not in qmap:
            continue
        grouped[qmap[qid]["domain"]].append(_record_confidence(record))

    return {domain: _combine_confidence(values) for domain, values in grouped.items()}


def calculate_overall_confidence(answer_records: dict[str, dict[str, Any]]) -> str:
    domain_values = list(calculate_domain_confidence(answer_records).values())
    if not domain_values:
        return "Low"
    return _combine_confidence(domain_values)


def _record_confidence(record: dict[str, Any]) -> str:
    answer = str(record.get("answer", "")).strip().lower()
    details = _normalize(str(record.get("details", "")))

    if answer == "unsure":
        return "Low"

    explicit_numeric = _numeric_confidence(record)
    if explicit_numeric is not None:
        return _label_from_score(explicit_numeric)

    if _has_evidence_indicator(details):
        return "High"

    source = str(record.get("source", "")).strip().lower()
    if source in {"quick_answer", "direct_button", "manual"}:
        return "High"
    if source == "ai_interview":
        return "Medium"
    if source == "router":
        return "High"

    if answer in {"yes", "partial", "no"}:
        return "Medium"
    return "Low"


def _numeric_confidence(record: dict[str, Any]) -> float | None:
    for key in ("confidence", "confidence_score", "source_confidence"):
        value = record.get(key)
        if value is None or value == "":
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue
        return max(0.0, min(1.0, numeric))
    return None


def _label_from_score(score: float) -> str:
    if score >= 0.85:
        return "High"
    if score >= 0.60:
        return "Medium"
    return "Low"


def _combine_confidence(values: list[str]) -> str:
    total = len(values)
    if not total:
        return "Low"
    lows = values.count("Low")
    highs = values.count("High")
    if lows / total >= 0.4:
        return "Low"
    if highs / total >= 0.5 and lows == 0:
        return "High"
    return "Medium"


def _has_evidence_indicator(text: str) -> bool:
    return any(hint in text for hint in EVIDENCE_HINTS) or bool(DATE_RE.search(text)) or bool(PERCENT_RE.search(text))


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))
