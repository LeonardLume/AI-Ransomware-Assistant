import os

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

from backend.llm_contracts import (
    validate_chat_decision,
    validate_extracted_answer,
    validate_grounded_answer_quality,
    validate_intent_decision,
)


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


def test_validate_chat_decision_accepts_valid_payload():
    decision = validate_chat_decision(
        {
            "action": "save_answer",
            "normalized_answer": "partial",
            "confidence": 0.81,
            "reason": "clear but incomplete evidence",
            "user_visible_response": "I can save this as partial.",
            "should_advance_question": True,
            "should_save_answer": True,
        }
    )

    assert decision is not None
    assert decision.action == "save_answer"
    assert decision.normalized_answer == "partial"


def test_validate_chat_decision_rejects_invalid_answer():
    decision = validate_chat_decision(
        {
            "action": "save_answer",
            "normalized_answer": "banana",
            "confidence": 0.7,
            "reason": "",
            "user_visible_response": "",
            "should_advance_question": True,
            "should_save_answer": True,
        }
    )

    assert decision is None


def test_validate_chat_decision_rejects_missing_answer_for_save():
    decision = validate_chat_decision(
        {
            "action": "save_answer",
            "normalized_answer": None,
            "confidence": 0.9,
            "reason": "missing normalized answer",
            "user_visible_response": "",
            "should_advance_question": True,
            "should_save_answer": True,
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
