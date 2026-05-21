import json
import os
from pathlib import Path
from typing import Any

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

import pytest
from fastapi.testclient import TestClient

import backend.ai_trace as ai_trace
import backend.main as main_module
from backend.main import app
from backend.security import RATE_LIMITER

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_trace_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    RATE_LIMITER.clear()
    monkeypatch.setenv("AI_TRACE_ENABLED", "true")
    monkeypatch.setenv("AI_TRACE_INCLUDE_TEXT", "false")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOW_SCRIPTED_AI_FALLBACK", "0")
    monkeypatch.setenv("AI_FALLBACK_USER_VISIBLE", "0")
    monkeypatch.setattr(ai_trace, "TRACE_PATH", tmp_path / "data_runtime" / "ai_traces.jsonl")
    yield
    RATE_LIMITER.clear()


def _read_traces() -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in ai_trace.TRACE_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def test_free_text_save_answer_traces_intent_llm_and_saved_answer(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        main_module,
        "decide_chat_turn_with_llm",
        lambda **_: {
            "available": True,
            "provider": "openai",
            "used_fallback": False,
            "decision": {
                "action": "save_answer",
                "normalized_answer": "yes",
                "confidence": 0.94,
                "reason": "clear answer",
                "user_visible_response": "",
                "should_advance_question": True,
                "should_save_answer": True,
            },
            "llm_error": None,
        },
    )

    start = client.post("/chat", json={"message": ""})
    assert start.status_code == 200
    session_id = start.json()["session_id"]

    response = client.post("/chat", json={"session_id": session_id, "message": "yes"})
    assert response.status_code == 200

    events = _read_traces()
    event_types = {event["event_type"] for event in events}

    assert ai_trace.TRACE_PATH.exists()
    assert "intent_decision" in event_types
    assert "answer_saved" in event_types
    assert all("message_text" not in event for event in events)
    assert all(event["session_id"] == session_id for event in events)
    assert any(event.get("should_save_answer") is True for event in events)


def test_trace_include_text_logs_only_redacted_text(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AI_TRACE_INCLUDE_TEXT", "true")

    ai_trace.trace_intent_decision(
        session_id="session-1",
        request_id="req-1",
        intent="clarification",
        response_type="client_question",
        provider="router",
        used_fallback=False,
        current_question_id="backups_exist",
        current_domain="backups",
        user_message="Contact me at admin@example.com api_key=sk-secret-value-1234567890",
        should_save_answer=False,
        confidence="high",
    )

    event = _read_traces()[-1]
    assert event["message_text"] != "Contact me at admin@example.com api_key=sk-secret-value-1234567890"
    assert "[EMAIL]" in event["message_text"]
    assert "[SECRET]" in event["message_text"]
    assert "admin@example.com" not in event["message_text"]


def test_trace_failures_are_best_effort(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(ai_trace, "_append_jsonl", lambda payload: (_ for _ in ()).throw(OSError("disk full")))

    ai_trace.trace_ai_event(
        {
            "session_id": "session-1",
            "request_id": "req-1",
            "event_type": "intent_decision",
            "intent": "smalltalk",
            "message_length": 2,
        }
    )
