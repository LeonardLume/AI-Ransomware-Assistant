import hashlib
import json
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

QUESTIONS_CORE_SHA256 = "540bc81d56c8eb668b532b3755ea18de45b7b47b99bbb31b19a54147096f11fb"
SCORING_RULES_SHA256 = "fc30779212d14e30f7c3e20fa0882a1c085b6fe4ed08e5f48351321cf200925a"


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


def test_questions_json_core_fields_are_unchanged():
    questions = json.loads(Path("data/questions.json").read_text(encoding="utf-8"))
    core = [
        {
            "id": question["id"],
            "domain": question["domain"],
            "question": question["question"],
            "help": question.get("help"),
            "options": question.get("options"),
            "required": question.get("required"),
        }
        for question in questions
    ]
    blob = json.dumps(core, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    digest = hashlib.sha256(blob).hexdigest()
    assert digest == QUESTIONS_CORE_SHA256


def test_scoring_rules_json_is_unchanged():
    rules = json.loads(Path("data/scoring_rules.json").read_text(encoding="utf-8"))
    blob = json.dumps(rules, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    digest = hashlib.sha256(blob).hexdigest()
    assert digest == SCORING_RULES_SHA256
