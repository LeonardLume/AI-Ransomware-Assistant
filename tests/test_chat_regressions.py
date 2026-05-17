import os

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

from typing import Any

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.security import RATE_LIMITER

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_runtime_env(monkeypatch: pytest.MonkeyPatch):
    for key in [
        "API_AUTH_TOKEN",
        "RATE_LIMIT_CHAT_PER_MINUTE",
        "RATE_LIMIT_REPORT_PER_MINUTE",
        "RATE_LIMIT_DEMO_PER_MINUTE",
        "TRUST_PROXY_HEADERS",
    ]:
        monkeypatch.delenv(key, raising=False)
    RATE_LIMITER.clear()
    yield
    RATE_LIMITER.clear()


def _start_chat() -> dict[str, Any]:
    response = client.post("/chat", json={"message": ""})
    assert response.status_code == 200
    return response.json()


def _chat(session_id: str, message: str) -> dict[str, Any]:
    response = client.post("/chat", json={"session_id": session_id, "message": message})
    assert response.status_code == 200
    return response.json()


def _session(session_id: str) -> dict[str, Any]:
    response = client.get(f"/session/{session_id}")
    assert response.status_code == 200
    return response.json()


def _saved_base_answers(session_id: str) -> dict[str, str]:
    answers = _session(session_id)["answers"]
    return {
        qid: record["answer"]
        for qid, record in answers.items()
        if not qid.startswith("followup__")
    }


def _assert_turn_matches(turn: dict[str, Any], expected: dict[str, Any]) -> None:
    for key, value in expected.items():
        assert turn[key] == value


SCENARIOS: list[dict[str, Any]] = [
    {
        "id": "greeting_example_contextual_answer",
        "steps": [
            {
                "message": "tere",
                "expect": {
                    "intent": "smalltalk",
                    "current_question_id": "org_critical_systems_known",
                },
                "saved_answers": {},
            },
            {
                "message": "too naidis",
                "expect": {
                    "intent": "clarification",
                    "response_type": "client_question",
                    "current_question_id": "org_critical_systems_known",
                },
                "saved_answers": {},
            },
            {
                "message": "teab",
                "expect": {
                    "intent": "answer",
                    "action": "extract_answer",
                    "extracted_answers": {"org_critical_systems_known": "yes"},
                    "current_question_id": "backups_exist",
                },
                "saved_answers": {"org_critical_systems_known": "yes"},
            },
        ],
    },
    {
        "id": "short_yes_then_unsure",
        "steps": [
            {
                "message": "jah",
                "expect": {
                    "extracted_answers": {"org_critical_systems_known": "yes"},
                    "current_question_id": "backups_exist",
                },
                "saved_answers": {"org_critical_systems_known": "yes"},
            },
            {
                "message": "voib olla",
                "expect": {
                    "intent": "answer",
                    "action": "extract_answer",
                    "extracted_answers": {"backups_exist": "unsure"},
                    "current_question_id": "backup_frequency_defined",
                },
                "saved_answers": {
                    "org_critical_systems_known": "yes",
                    "backups_exist": "unsure",
                },
            },
        ],
    },
    {
        "id": "answer_clarification_answer_same_question",
        "steps": [
            {
                "message": "jah",
                "expect": {
                    "extracted_answers": {"org_critical_systems_known": "yes"},
                    "current_question_id": "backups_exist",
                },
                "saved_answers": {"org_critical_systems_known": "yes"},
            },
            {
                "message": "mida see tahendab?",
                "expect": {
                    "intent": "clarification",
                    "response_type": "client_question",
                    "current_question_id": "backups_exist",
                },
                "saved_answers": {"org_critical_systems_known": "yes"},
            },
            {
                "message": "tehakse",
                "expect": {
                    "intent": "answer",
                    "extracted_answers": {"backups_exist": "yes"},
                    "current_question_id": "backup_frequency_defined",
                },
                "saved_answers": {
                    "org_critical_systems_known": "yes",
                    "backups_exist": "yes",
                },
            },
        ],
    },
    {
        "id": "mixed_factual_message_extracts_two_answers",
        "steps": [
            {
                "message": "Meil on varukoopiad olemas, aga taastamist pole testitud.",
                "expect": {
                    "intent": "answer",
                    "action": "extract_answer",
                    "current_question_id": "org_critical_systems_known",
                },
                "extracted_contains": {
                    "backups_exist": "yes",
                    "restore_tested": "no",
                },
                "saved_answers": {
                    "backups_exist": "yes",
                    "restore_tested": "no",
                },
            },
        ],
    },
    {
        "id": "report_request_too_early_keeps_interview_open",
        "steps": [
            {
                "message": "tee raport",
                "expect": {
                    "intent": "report_request",
                    "response_type": "report_request_blocked",
                    "report": None,
                    "is_complete": False,
                    "current_question_id": "org_critical_systems_known",
                },
                "saved_answers": {},
            },
        ],
    },
    {
        "id": "answer_example_answer_on_same_question",
        "steps": [
            {
                "message": "jah",
                "expect": {
                    "extracted_answers": {"org_critical_systems_known": "yes"},
                    "current_question_id": "backups_exist",
                },
                "saved_answers": {"org_critical_systems_known": "yes"},
            },
            {
                "message": "too naidis",
                "expect": {
                    "intent": "clarification",
                    "response_type": "client_question",
                    "current_question_id": "backups_exist",
                    "extracted_answers": {},
                },
                "saved_answers": {"org_critical_systems_known": "yes"},
            },
            {
                "message": "jah",
                "expect": {
                    "intent": "answer",
                    "action": "extract_answer",
                    "extracted_answers": {"backups_exist": "yes"},
                    "current_question_id": "backup_frequency_defined",
                },
                "saved_answers": {
                    "org_critical_systems_known": "yes",
                    "backups_exist": "yes",
                },
            },
        ],
    },
    {
        "id": "short_negative_operational_reply",
        "steps": [
            {
                "message": "jah",
                "expect": {
                    "extracted_answers": {"org_critical_systems_known": "yes"},
                    "current_question_id": "backups_exist",
                },
                "saved_answers": {"org_critical_systems_known": "yes"},
            },
            {
                "message": "ei tehta",
                "expect": {
                    "intent": "answer",
                    "action": "extract_answer",
                    "extracted_answers": {"backups_exist": "no"},
                    "current_question_id": "backup_frequency_defined",
                },
                "saved_answers": {
                    "org_critical_systems_known": "yes",
                    "backups_exist": "no",
                },
            },
        ],
    },
    {
        "id": "partial_operational_reply_after_first_answer",
        "steps": [
            {
                "message": "jah",
                "expect": {
                    "extracted_answers": {"org_critical_systems_known": "yes"},
                    "current_question_id": "backups_exist",
                },
                "saved_answers": {"org_critical_systems_known": "yes"},
            },
            {
                "message": "ei, pigem osaliselt",
                "expect": {
                    "intent": "answer",
                    "action": "extract_answer",
                    "extracted_answers": {"backups_exist": "partial"},
                    "current_question_id": "backup_frequency_defined",
                },
                "saved_answers": {
                    "org_critical_systems_known": "yes",
                    "backups_exist": "partial",
                },
            },
        ],
    },
    {
        "id": "off_topic_smalltalk_does_not_create_answer",
        "steps": [
            {
                "message": "aitah",
                "expect": {
                    "intent": "smalltalk",
                    "action": "answer_smalltalk",
                    "current_question_id": "org_critical_systems_known",
                    "extracted_answers": {},
                },
                "saved_answers": {},
            },
        ],
    },
]


@pytest.mark.parametrize("scenario", SCENARIOS, ids=[scenario["id"] for scenario in SCENARIOS])
def test_chat_regression_scenarios(scenario: dict[str, Any]):
    start = _start_chat()
    sid = start["session_id"]

    for step in scenario["steps"]:
        turn = _chat(sid, step["message"])
        _assert_turn_matches(turn, step["expect"])

        expected_extracted = step.get("extracted_contains", {})
        if expected_extracted:
            for key, value in expected_extracted.items():
                assert turn["extracted_answers"][key] == value

        expected_saved_answers = step.get("saved_answers")
        if expected_saved_answers is not None:
            assert _saved_base_answers(sid) == expected_saved_answers


def test_correction_turn_after_mixed_fact_message_targets_current_question():
    start = _start_chat()
    sid = start["session_id"]

    first = _chat(sid, "Meil on varukoopiad olemas, aga taastamist pole testitud.")
    assert first["current_question_id"] == "org_critical_systems_known"

    correction = _chat(sid, "ei, kriitilised susteemid on ka teada")
    assert correction["intent"] == "answer"
    assert correction["extracted_answers"] == {"org_critical_systems_known": "yes"}
    assert correction["current_question_id"] == "backup_frequency_defined"
    assert _saved_base_answers(sid) == {
        "backups_exist": "yes",
        "restore_tested": "no",
        "org_critical_systems_known": "yes",
    }
