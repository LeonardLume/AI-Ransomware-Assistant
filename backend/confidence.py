from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from typing import Any

from backend.questions import question_map

EVIDENCE_HINTS = [
    "date",
    "kuupaev",
    "kuupäev",
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
    "kuvatõmm",
    "log",
    "audit",
    "ticket",
]
UNCERTAIN_HINTS = [
    "vist",
    "maybe",
    "ei tea",
    "not sure",
    "unknown",
    "pole kindel",
    "unsure",
    "võib olla",
    "voib olla",
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
    answer = str(record.get("answer", "")).lower()
    details = _normalize(str(record.get("details", "")))

    if answer in {"no", "unsure"} or any(hint in details for hint in UNCERTAIN_HINTS):
        return "Low"
    if _has_evidence_indicator(details):
        return "High"
    if answer in {"yes", "partial"}:
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
    return (
        any(hint in text for hint in EVIDENCE_HINTS)
        or bool(DATE_RE.search(text))
        or bool(PERCENT_RE.search(text))
    )


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))
