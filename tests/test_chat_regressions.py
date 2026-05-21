import hashlib
import os
from pathlib import Path
from typing import Any

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

import pytest
from fastapi.testclient import TestClient

import backend.main as main_module
from backend.main import app
from backend.security import RATE_LIMITER

client = TestClient(app)

QUESTIONS_SHA256 = "762e3355ca9bc1544b002d374152961e72de3bf3abc139aa1559c57cbfe7468f"
SCORING_RULES_SHA256 = "66474a6efd86cd9bd13d619f296c7211af02cc6bbde4613490d3980111f09a85"


@pytest.fixture(autouse=True)
def reset_runtime_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("LLM_PROVIDER", "fallback")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOW_SCRIPTED_AI_FALLBACK", "0")
    monkeypatch.setenv("AI_FALLBACK_USER_VISIBLE", "0")
    RATE_LIMITER.clear()
    yield
    RATE_LIMITER.clear()


def _start_chat() -> dict[str, Any]:
    response = client.post("/chat", json={"message": ""})
    assert response.status_code == 200
    return response.json()


def _chat(session_id: str, message: str, **payload: str) -> dict[str, Any]:
    response = client.post("/chat", json={"session_id": session_id, "message": message, **payload})
    assert response.status_code == 200
    return response.json()


def _score(session_id: str) -> dict[str, Any]:
    response = client.get(f"/score/{session_id}")
    assert response.status_code == 200
    return response.json()


def test_official_score_changes_only_after_validated_answer_save(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        main_module,
        "decide_chat_turn_with_llm",
        lambda **_: {
            "available": True,
            "provider": "openai",
            "used_fallback": False,
            "decision": {
                "action": "keep_context",
                "normalized_answer": None,
                "confidence": 0.6,
                "reason": "context only",
                "user_visible_response": "Keeping that as context.",
                "should_advance_question": False,
                "should_save_answer": False,
            },
            "llm_error": None,
        },
    )

    start = _start_chat()
    sid = start["session_id"]
    score_before = _score(sid)["overall_score"]

    keep_context = _chat(sid, "Our provider handles this.")
    assert keep_context["response_type"] == "context_note"
    assert _score(sid)["overall_score"] == score_before

    saved = _chat(sid, "yes", intent_mode="direct_answer", selected_answer="yes")
    assert saved["response_type"] == "interview_answer"
    assert _score(sid)["overall_score"] != score_before


def test_generate_report_action_uses_deterministic_score(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        main_module,
        "decide_chat_turn_with_llm",
        lambda **_: {
            "available": True,
            "provider": "openai",
            "used_fallback": False,
            "decision": {
                "action": "generate_report",
                "normalized_answer": None,
                "confidence": 0.95,
                "reason": "explicit report request",
                "user_visible_response": "",
                "should_advance_question": True,
                "should_save_answer": False,
            },
            "llm_error": None,
        },
    )

    sid = client.post("/session", json={"organization_name": "Test"}).json()["session_id"]
    for question_id, answer in [
        ("org_critical_systems_known", "yes"),
        ("backups_exist", "yes"),
        ("mfa_admin", "partial"),
        ("patching_process_exists", "partial"),
        ("least_privilege", "no"),
        ("logs_centralized", "partial"),
    ]:
        response = client.post("/answer", json={"session_id": sid, "question_id": question_id, "answer": answer})
        assert response.status_code == 200

    score_before = _score(sid)
    data = _chat(sid, "Generate report")

    assert data["response_type"] == "report"
    assert data["report"]["action_plan"]
    assert data["report"]["evidence_checklist"]
    assert data["score"]["overall_score"] == score_before["overall_score"]
    assert data["score"]["domain_scores"] == score_before["domain_scores"]


def test_questions_json_is_unchanged():
    digest = hashlib.sha256(Path("data/questions.json").read_bytes()).hexdigest()
    assert digest == QUESTIONS_SHA256


def test_scoring_rules_json_is_unchanged():
    digest = hashlib.sha256(Path("data/scoring_rules.json").read_bytes()).hexdigest()
    assert digest == SCORING_RULES_SHA256
