import os

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

import pytest
from fastapi.testclient import TestClient

from backend.dialog_intent import classify_dialog_intent
from backend.main import app
from backend.security import RATE_LIMITER
from backend.storage import load_session

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_runtime_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("LLM_PROVIDER", "fallback")
    monkeypatch.delenv("USE_LANGGRAPH_DIALOG", raising=False)
    RATE_LIMITER.clear()
    yield
    RATE_LIMITER.clear()


def _start_chat() -> dict:
    response = client.post("/chat", json={"message": ""})
    assert response.status_code == 200
    return response.json()


def _chat(session_id: str, message: str, **payload: str) -> dict:
    response = client.post("/chat", json={"session_id": session_id, "message": message, **payload})
    assert response.status_code == 200
    return response.json()


@pytest.mark.parametrize("answer", ["yes", "partial", "no", "unsure"])
def test_direct_answer_metadata_saves_and_advances(answer: str):
    start = _start_chat()
    sid = start["session_id"]
    current_q = start["current_question_id"]

    data = _chat(
        sid,
        answer,
        intent_mode="direct_answer",
        selected_answer=answer,
    )

    assert data["intent"] == "answer"
    assert data["response_type"] == "interview_answer"
    assert data["extracted_answers"] == {current_q: answer}
    assert data["current_question_id"] != current_q

    session = client.get(f"/session/{sid}").json()
    assert session["answers"][current_q]["answer"] == answer


def test_clarification_mode_never_saves_or_advances():
    start = _start_chat()
    sid = start["session_id"]
    current_q = start["current_question_id"]

    data = _chat(sid, "Can you explain this in simpler words?", intent_mode="clarification")

    assert data["extracted_answers"] == {}
    assert data["current_question_id"] == current_q
    assert data["response_type"] == "client_question"
    assert client.get(f"/session/{sid}").json()["answers"] == {}


def test_context_note_mode_records_non_scoring_context_without_advancing():
    start = _start_chat()
    sid = start["session_id"]
    current_q = start["current_question_id"]
    score_before = client.get(f"/score/{sid}").json()["overall_score"]

    data = _chat(
        sid,
        "Our MSP manages this, and I do not know the details yet.",
        intent_mode="context_note",
    )

    assert data["intent"] == "context_note"
    assert data["extracted_answers"] == {}
    assert data["current_question_id"] == current_q
    assert data["context_notes"]

    session = client.get(f"/session/{sid}").json()
    assert session["answers"] == {}
    assert session["current_question_id"] == current_q
    assert session["context_notes"][0]["question_id"] == current_q
    assert client.get(f"/score/{sid}").json()["overall_score"] == score_before


def test_advisory_mode_never_saves_or_advances():
    start = _start_chat()
    sid = start["session_id"]
    current_q = start["current_question_id"]

    data = _chat(sid, "What is the safest backup strategy?", intent_mode="advisory")

    assert data["intent"] in {"general_advisory_chat", "knowledge_grounded_answer"}
    assert data["extracted_answers"] == {}
    assert data["current_question_id"] == current_q
    assert client.get(f"/session/{sid}").json()["answers"] == {}


def test_clear_free_text_direct_answers_still_save():
    start = _start_chat()
    sid = start["session_id"]

    yes_turn = _chat(sid, "yes")
    assert yes_turn["extracted_answers"] == {"org_critical_systems_known": "yes"}

    partial_turn = _chat(sid, "Partial, backups exist but are not checked every day.")
    assert partial_turn["extracted_answers"] == {"backups_exist": "partial"}

    no_turn = _chat(sid, "No, restore tests are not done.", intent_mode="direct_answer")
    assert no_turn["extracted_answers"] == {"backup_frequency_defined": "no"}


@pytest.mark.parametrize(
    "message",
    [
        "What does this question mean?",
        "Can you explain this?",
        "Объясни проще",
        "Selgita lihtsamalt",
    ],
)
def test_free_text_clarification_does_not_save(message: str):
    start = _start_chat()
    sid = start["session_id"]
    current_q = start["current_question_id"]

    data = _chat(sid, message)

    assert data["extracted_answers"] == {}
    assert data["current_question_id"] == current_q
    assert load_session(sid).answers == {}


@pytest.mark.parametrize(
    "message",
    [
        "Our external IT provider handles this, I do not know the details.",
        "I want to explain our situation first.",
        "У нас этим занимается внешний IT.",
    ],
)
def test_free_text_context_does_not_save_automatically(message: str):
    start = _start_chat()
    sid = start["session_id"]
    current_q = start["current_question_id"]

    data = _chat(sid, message)

    assert data["extracted_answers"] == {}
    assert data["current_question_id"] == current_q
    assert load_session(sid).answers == {}


def test_ambiguous_answer_requires_confirmation_and_keeps_question():
    start = _start_chat()
    sid = start["session_id"]
    _chat(sid, "yes")
    current_q = client.get(f"/session/{sid}").json()["current_question_id"]

    data = _chat(sid, "We have backups but I am not sure if they are protected.")

    assert data["response_type"] == "pending_answer_confirmation"
    assert data["extracted_answers"] == {}
    assert data["current_question_id"] == current_q
    session = client.get(f"/session/{sid}").json()
    assert session["answers"].keys() == {"org_critical_systems_known"}
    assert session["pending_answer"]


def test_unrelated_free_text_request_does_not_score_current_question():
    start = _start_chat()
    sid = start["session_id"]
    _chat(sid, "jah")
    current_q = client.get(f"/session/{sid}").json()["current_question_id"]

    data = _chat(sid, "напиши java код")

    assert data["extracted_answers"] == {}
    assert data["current_question_id"] == current_q
    assert "backups_exist" not in client.get(f"/session/{sid}").json()["answers"]


def test_router_is_conservative_for_answer_mode_with_unclear_text():
    decision = classify_dialog_intent(
        "write a short java example",
        {"id": "backups_exist", "question": "Kas kriitilistest andmetest tehakse regulaarsed varukoopiad?"},
        intent_mode="direct_answer",
    )

    assert decision.route == "ambiguous_needs_confirmation"
    assert decision.should_save_answer is False
