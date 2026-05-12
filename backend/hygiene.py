from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from backend.config import DATA_DIR

HYGIENE_DOMAIN = "employee_security_hygiene"


@lru_cache(maxsize=1)
def load_employee_hygiene_checklist() -> list[dict[str, Any]]:
    with open(DATA_DIR / "employee_security_hygiene_checklist.json", "r", encoding="utf-8") as f:
        return json.load(f)


def build_employee_hygiene_checklist(
    answer_records: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    items = []
    for item in load_employee_hygiene_checklist():
        record = answer_records.get(item["id"], {})
        answer = record.get("answer")
        status = _status_from_answer(answer)
        items.append(
            {
                **item,
                "answer": answer,
                "details": record.get("details", ""),
                "status": status,
            }
        )
    return {
        "domain": HYGIENE_DOMAIN,
        "type": "optional_advisory_checklist",
        "scoring_impact": "none",
        "items": items,
    }


def build_employee_hygiene_actions(
    answer_records: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    checklist = build_employee_hygiene_checklist(answer_records)
    weak_items = [
        item
        for item in checklist["items"]
        if item.get("answer") in {"partial", "no", "unsure"} or item.get("answer") is None
    ]
    if not weak_items:
        return []

    actions = []
    for item in weak_items[:3]:
        actions.append(
            {
                "title": item.get("recommendation", "Review employee security hygiene").rstrip("."),
                "priority": "Medium" if item.get("answer") in {"no", "unsure"} else "Low",
                "domain": HYGIENE_DOMAIN,
                "owner_suggestion": "All employees",
                "deadline": "30 days",
                "effort": "Low",
                "evidence_required": item.get("evidence", []),
                "based_on_skill": "employee-security-hygiene",
                "scoring_impact": "none",
            }
        )
    return actions


def _status_from_answer(answer: Any) -> str:
    if answer == "yes":
        return "in_place"
    if answer == "partial":
        return "partially_in_place"
    if answer in {"no", "unsure"}:
        return "needs_attention"
    return "not_assessed"
