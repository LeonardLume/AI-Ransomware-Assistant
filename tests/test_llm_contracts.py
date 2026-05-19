import os

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

from fastapi.testclient import TestClient

import pytest

import backend.chat_interview as chat_interview
from backend.llm_client import LLMResult
from backend.llm_contracts import (
    validate_extracted_answer,
    validate_grounded_answer_quality,
    validate_intent_decision,
)
from backend.main import app
from backend.security import RATE_LIMITER

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_runtime_env(monkeypatch: pytest.MonkeyPatch):
    RATE_LIMITER.clear()
    yield
    RATE_LIMITER.clear()


def _start_chat() -> dict:
    response = client.post("/chat", json={"message": ""})
    assert response.status_code == 200
    return response.json()


def _chat(session_id: str, message: str) -> dict:
    response = client.post("/chat", json={"session_id": session_id, "message": message})
    assert response.status_code == 200
    return response.json()


def _saved_base_answers(session_id: str) -> dict[str, str]:
    response = client.get(f"/session/{session_id}")
    assert response.status_code == 200
    answers = response.json()["answers"]
    return {
        qid: record["answer"]
        for qid, record in answers.items()
        if not qid.startswith("followup__")
    }


def test_validate_intent_decision_accepts_valid_payload():
    decision = validate_intent_decision(
        {
            "intent": "interview_answer",
            "should_save_answer": True,
            "question_id": "backups_exist",
            "answer": "yes",
            "confidence": 0.92,
            "reason": "clear direct answer",
            "needs_knowledge": False,
        }
    )

    assert decision is not None
    assert decision.intent == "interview_answer"
    assert decision.answer == "yes"


def test_validate_intent_decision_rejects_invalid_answer():
    decision = validate_intent_decision(
        {
            "intent": "interview_answer",
            "should_save_answer": True,
            "question_id": "backups_exist",
            "answer": "banana",
            "confidence": 0.5,
            "reason": "",
            "needs_knowledge": False,
        }
    )

    assert decision is None


def test_validate_extracted_answer_and_grounded_quality_contracts():
    extracted = validate_extracted_answer(
        {
            "question_id": "restore_tested",
            "answer": "partial",
            "confidence": 0.61,
            "details": "Only one file restore was tested.",
            "should_advance": False,
        }
    )
    quality = validate_grounded_answer_quality(
        {
            "used_knowledge": True,
            "source_count": 2,
            "missing_context": False,
            "safety_blocked": False,
            "answer_language": "English",
        }
    )

    assert extracted is not None
    assert extracted.answer == "partial"
    assert quality is not None
    assert quality.used_knowledge is True


def test_invalid_llm_json_falls_back_without_crashing(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat_interview, "get_llm_settings", lambda: {"provider": "openai"})
    monkeypatch.setattr(
        chat_interview,
        "generate_text",
        lambda **kwargs: LLMResult(
            text="not-json-at-all",
            provider="openai",
            model="test-model",
            used_real_llm=True,
        ),
    )

    start = _start_chat()
    data = _chat(start["session_id"], "jah")

    assert data["intent"] == "answer"
    assert data["extracted_answers"] == {"org_critical_systems_known": "yes"}
    assert data["provider"] == "fallback"
    assert _saved_base_answers(start["session_id"]) == {"org_critical_systems_known": "yes"}


def test_invalid_llm_fields_cannot_corrupt_assessment_state(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat_interview, "get_llm_settings", lambda: {"provider": "openai"})
    monkeypatch.setattr(
        chat_interview,
        "generate_text",
        lambda **kwargs: LLMResult(
            text='{"intent":"answer","extracted_answers":{"org_critical_systems_known":"banana"},"confidence":{"org_critical_systems_known":0.88}}',
            provider="openai",
            model="test-model",
            used_real_llm=True,
        ),
    )

    start = _start_chat()
    data = _chat(start["session_id"], "jah")

    assert data["intent"] == "answer"
    assert data["extracted_answers"] == {"org_critical_systems_known": "yes"}
    assert data["provider"] == "fallback"
    assert _saved_base_answers(start["session_id"]) == {"org_critical_systems_known": "yes"}
