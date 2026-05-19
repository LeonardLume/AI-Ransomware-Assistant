import json
import os
from pathlib import Path

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

import pytest
from fastapi.testclient import TestClient

import backend.ai_trace as ai_trace
from backend.main import app
from backend.security import RATE_LIMITER

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_trace_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    RATE_LIMITER.clear()
    monkeypatch.setenv("AI_TRACE_ENABLED", "true")
    monkeypatch.setenv("AI_TRACE_INCLUDE_TEXT", "false")
    monkeypatch.setattr(ai_trace, "TRACE_PATH", tmp_path / "data_runtime" / "ai_traces.jsonl")
    yield
    RATE_LIMITER.clear()


def _read_traces() -> list[dict]:
    return [
        json.loads(line)
        for line in ai_trace.TRACE_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def test_chat_tracing_creates_local_jsonl_without_raw_text():
    start = client.post("/chat", json={"message": ""})
    assert start.status_code == 200
    session_id = start.json()["session_id"]

    response = client.post("/chat", json={"session_id": session_id, "message": "jah"})
    assert response.status_code == 200

    assert ai_trace.TRACE_PATH.exists()
    events = _read_traces()
    event_types = {event["event_type"] for event in events}

    assert "intent_decision" in event_types
    assert "answer_saved" in event_types
    assert "llm_call" in event_types
    assert all("message_text" not in event for event in events)
    assert all(event["session_id"] == session_id for event in events)
    assert any(event["should_save_answer"] is True for event in events)


def test_retrieval_trace_captures_knowledge_metadata():
    start = client.post("/chat", json={"message": ""})
    assert start.status_code == 200
    session_id = start.json()["session_id"]

    response = client.post(
        "/chat",
        json={"session_id": session_id, "message": "Is MFA enough to stop ransomware?"},
    )
    assert response.status_code == 200

    retrieval_events = [event for event in _read_traces() if event["event_type"] == "retrieval"]
    assert retrieval_events
    retrieval = retrieval_events[-1]
    assert retrieval["intent"] == "general_advisory_chat"
    assert retrieval["retrieved_source_count"] >= 1
    assert retrieval["knowledge_source_ids"]
    assert retrieval["current_question_id"] == "org_critical_systems_known"


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
