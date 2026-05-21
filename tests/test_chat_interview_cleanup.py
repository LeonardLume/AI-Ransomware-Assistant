import os
from types import SimpleNamespace

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

import pytest
from fastapi.testclient import TestClient

import backend.chat_interview as chat_interview
import backend.main as main_module
from backend.chat.transparency import build_assistant_transparency
from backend.main import app
from backend.security import RATE_LIMITER

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_runtime_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("LLM_PROVIDER", "fallback")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOW_SCRIPTED_AI_FALLBACK", "0")
    monkeypatch.setenv("AI_FALLBACK_USER_VISIBLE", "0")
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


def test_production_free_text_does_not_use_legacy_infer_answer(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        chat_interview,
        "infer_answer",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("legacy infer_answer should not run")),
    )
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
                "confidence": 0.62,
                "reason": "context only",
                "user_visible_response": "Keeping that as context.",
                "should_advance_question": False,
                "should_save_answer": False,
            },
            "llm_error": None,
        },
    )

    start = _start_chat()
    data = _chat(start["session_id"], "Our MSP handles this and I do not know the details.")

    assert data["response_type"] == "context_note"


def test_production_free_text_calls_llm_router(monkeypatch: pytest.MonkeyPatch):
    called = {"count": 0}

    def _router(**_kwargs):
        called["count"] += 1
        return {
            "available": True,
            "provider": "openai",
            "used_fallback": False,
            "decision": {
                "action": "keep_context",
                "normalized_answer": None,
                "confidence": 0.55,
                "reason": "context only",
                "user_visible_response": "",
                "should_advance_question": False,
                "should_save_answer": False,
            },
            "llm_error": None,
        }

    monkeypatch.setattr(main_module, "decide_chat_turn_with_llm", _router)

    start = _start_chat()
    _chat(start["session_id"], "We outsource this.")

    assert called["count"] == 1


def test_decide_chat_turn_returns_unavailable_without_real_llm_in_production(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat_interview, "is_real_llm_configured", lambda: False)
    monkeypatch.setattr(chat_interview, "get_app_env", lambda: "production")
    monkeypatch.setattr(chat_interview, "allow_scripted_ai_fallback", lambda: False)
    monkeypatch.setattr(chat_interview, "ai_fallback_user_visible", lambda: False)

    result = chat_interview.decide_chat_turn_with_llm(
        user_message="What does this question mean?",
        current_question={"id": "backups_exist", "question": "Do backups exist?", "domain": "backups"},
        current_answers={},
    )

    assert result["available"] is False
    assert result["decision"] is None


def test_decide_chat_turn_allows_fallback_only_in_test_mode(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat_interview, "is_real_llm_configured", lambda: False)
    monkeypatch.setattr(chat_interview, "get_app_env", lambda: "test")
    monkeypatch.setattr(chat_interview, "ai_fallback_user_visible", lambda: True)
    monkeypatch.setattr(chat_interview, "allow_scripted_ai_fallback", lambda: False)

    result = chat_interview.decide_chat_turn_with_llm(
        user_message="yes",
        current_question={"id": "backups_exist", "question": "Do backups exist?", "domain": "backups"},
        current_answers={},
    )

    assert result["available"] is True
    assert result["used_fallback"] is True


@pytest.mark.parametrize(
    ("action", "response_type", "patch_target", "message"),
    [
        ("answer_clarification", "client_question", "answer_client_question_with_llm", "Clarified."),
        ("answer_advisory", "general_advisory_chat", "answer_general_advisory_with_llm", "Advisory."),
    ],
)
def test_normal_clarification_and_advisory_do_not_expose_sources(
    monkeypatch: pytest.MonkeyPatch,
    action: str,
    response_type: str,
    patch_target: str,
    message: str,
):
    monkeypatch.setattr(
        main_module,
        "decide_chat_turn_with_llm",
        lambda **_: {
            "available": True,
            "provider": "openai",
            "used_fallback": False,
            "decision": {
                "action": action,
                "normalized_answer": None,
                "confidence": 0.88,
                "reason": "mocked",
                "user_visible_response": "",
                "should_advance_question": False,
                "should_save_answer": False,
            },
            "llm_error": None,
        },
    )
    monkeypatch.setattr(
        main_module,
        patch_target,
        lambda **_: {
            "message": message,
            "provider": "openai",
            "used_fallback": False,
            "grounded_answer_quality": {"used_knowledge": False, "source_count": 0},
        },
    )

    start = _start_chat()
    data = _chat(start["session_id"], "Explain this.")

    assert data["response_type"] == response_type
    assert data["knowledge_sources"] == []
    assert data["assistant_transparency"]["sources"] == []
    assert "JÃ" not in data["assistant_message"]
    assert "Ãµ" not in data["assistant_message"]


def test_knowledge_grounded_answer_is_only_normal_path_with_sources():
    transparency = build_assistant_transparency(
        response_type="knowledge_grounded_answer",
        current_question=None,
        current_question_id=None,
        extracted_answers={},
        knowledge_sources=[{"name": "CISA StopRansomware Guide", "url": "https://www.cisa.gov/"}],
        report=None,
        prompt_injection_blocked=False,
    )

    assert transparency["sources"] == [
        {
            "label": "CISA StopRansomware Guide",
            "kind": "knowledge_source",
            "url": "https://www.cisa.gov/",
        }
    ]


def test_manual_answer_endpoint_saves_source_and_confidence():
    session_id = client.post("/session", json={"organization_name": "Test"}).json()["session_id"]

    response = client.post(
        "/answer",
        json={"session_id": session_id, "question_id": "backups_exist", "answer": "yes", "details": "Checked"},
    )

    assert response.status_code == 200
    session = client.get(f"/session/{session_id}").json()
    assert session["answers"]["backups_exist"]["source"] == "manual"
    assert session["answers"]["backups_exist"]["confidence"] == 1.0


def test_normalize_assistant_text_does_not_force_return_to_question():
    text = chat_interview.normalize_assistant_text(
        "Here is what this question means.",
        "English",
        {"id": "backups_exist", "question": "Do backups exist?"},
    )

    assert text == "Here is what this question means."
    assert "current question" not in text.lower()


def test_normal_clarification_quality_is_not_marked_grounded(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat_interview, "is_real_llm_configured", lambda: True)
    monkeypatch.setattr(
        chat_interview,
        "generate_text",
        lambda **_: SimpleNamespace(
            used_real_llm=True,
            text="This asks whether reliable backups exist.",
            provider="openai",
            model="gpt-test",
            error=None,
        ),
    )

    result = chat_interview.answer_client_question_with_llm(
        user_message="What does this question mean?",
        current_question={"id": "backups_exist", "question": "Do backups exist?", "domain": "backups"},
        current_answers={},
    )

    assert result["grounded_answer_quality"]["used_knowledge"] is False
    assert result["grounded_answer_quality"]["source_count"] == 0


def test_general_advisory_acknowledges_topic_mismatch(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat_interview, "is_real_llm_configured", lambda: True)
    monkeypatch.setattr(
        chat_interview,
        "generate_text",
        lambda **_: SimpleNamespace(
            used_real_llm=True,
            text="Varukoopiaid tasub teha iga päev.",
            provider="openai",
            model="gpt-test",
            error=None,
        ),
    )

    result = chat_interview.answer_general_advisory_with_llm(
        user_message="ei tea me teeme varukoopiad aga nagu kui tihti peab neid tegema",
        current_question={
            "id": "org_critical_systems_known",
            "question": "Kas organisatsioon teab, millised süsteemid ja andmed on töö jätkumiseks kõige kriitilisemad?",
            "domain": "incident_response",
        },
        current_answers={},
    )

    assert "erinev teema" in result["message"]
    assert "Varukoopiaid tasub teha iga päev." in result["message"]


def test_report_request_blocked_is_localized_and_does_not_repeat_question(monkeypatch: pytest.MonkeyPatch):
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
                "confidence": 0.93,
                "reason": "report request",
                "user_visible_response": "",
                "should_advance_question": False,
                "should_save_answer": False,
            },
            "llm_error": None,
        },
    )

    start = _start_chat()
    data = _chat(start["session_id"], "tee raport")

    assert data["response_type"] == "report_request_blocked"
    assert data["assistant_message"].startswith("Raporti koostamiseks on veel liiga vara.")
    assert data["current_question"]["question"] not in data["assistant_message"]


def test_acknowledgement_turn_does_not_restart_conversation(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, object] = {}

    def _fake_generate_text(**kwargs):
        captured["prompt"] = kwargs["prompt"]
        return SimpleNamespace(
            used_real_llm=True,
            text="Tere! Räägime edasi.\n\nTuleme nüüd tagasi praeguse küsimuse juurde: Kas varukoopiad on olemas?",
            provider="openai",
            model="gpt-test",
            error=None,
        )

    monkeypatch.setattr(chat_interview, "is_real_llm_configured", lambda: True)
    monkeypatch.setattr(chat_interview, "generate_text", _fake_generate_text)

    result = chat_interview.answer_smalltalk_with_llm(
        "sain aru",
        {"id": "backups_exist", "question": "Kas varukoopiad on olemas?", "domain": "backups"},
        current_answers={},
        chat_history=[
            {"role": "assistant", "content": "Kas varukoopiad on olemas?"},
            {"role": "user", "content": "mida see tähendab"},
        ],
        is_new_session=False,
    )

    assert '"is_new_session": false' in str(captured["prompt"]).lower()
    assert '"recent_chat_history"' in str(captured["prompt"])
    assert "Tere!" not in result["message"]
    assert "Räägime edasi" not in result["message"]
    assert "Tuleme nüüd tagasi praeguse küsimuse juurde" not in result["message"]
