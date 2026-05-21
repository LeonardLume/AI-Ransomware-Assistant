import os

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

from backend.llm_contracts import (
    validate_chat_decision,
    validate_extracted_answer,
    validate_grounded_answer_quality,
    validate_intent_decision,
)
from backend.llm_client import _openai_token_param_kwargs, _reduced_max_tokens_from_error


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


def test_validate_chat_decision_accepts_string_null_for_optional_answer():
    decision = validate_chat_decision(
        {
            "action": "answer_clarification",
            "normalized_answer": "null",
            "confidence": 0.78,
            "reason": "clarification request",
            "user_visible_response": "Here is what the question means.",
            "should_advance_question": False,
            "should_save_answer": False,
        }
    )

    assert decision is not None
    assert decision.normalized_answer is None


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


def test_reduced_max_tokens_parses_openrouter_credit_error():
    error_text = (
        "Error code: 402 - {'error': {'message': 'This request requires more credits, or fewer max_tokens. "
        "You requested up to 1200 tokens, but can only afford 1043.'}}"
    )

    reduced = _reduced_max_tokens_from_error(error_text, 1200)

    assert reduced == 1043


def test_reduced_max_tokens_allows_small_affordable_limit():
    error_text = (
        "Error code: 402 - {'error': {'message': 'This request requires more credits, or fewer max_tokens. "
        "You requested up to 256 tokens, but can only afford 63.'}}"
    )

    reduced = _reduced_max_tokens_from_error(error_text, 256)

    assert reduced == 63


def test_openai_token_param_uses_max_completion_tokens_for_gpt5_models():
    kwargs = _openai_token_param_kwargs(model="gpt-5.4-mini", max_tokens=128)

    assert kwargs == {"max_completion_tokens": 128}


def test_openai_token_param_uses_max_tokens_for_legacy_models():
    kwargs = _openai_token_param_kwargs(model="gpt-4o-mini", max_tokens=128)

    assert kwargs == {"max_tokens": 128}
