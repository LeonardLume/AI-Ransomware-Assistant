from __future__ import annotations

import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
CASES_PATH = BASE_DIR / "tests" / "ai_eval_cases.json"


def test_ai_eval_cases_cover_required_categories_and_languages():
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))

    assert isinstance(cases, list)
    assert len(cases) >= 35

    categories = {case["category"] for case in cases}
    assert categories >= {
        "direct_assessment_answer",
        "clarification",
        "general_advisory",
        "knowledge_grounded_answer",
        "report_request",
        "prompt_injection",
        "offensive_request_refusal",
    }

    languages = {case["language"] for case in cases}
    assert languages >= {"et", "en", "ru"}


def test_ai_eval_cases_have_minimum_shape():
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))

    for case in cases:
        assert case["id"]
        assert case["category"]
        assert case["language"]
        assert "message" in case
        assert isinstance(case.get("expect"), dict)
