from __future__ import annotations

import re
from typing import Any

from backend.dialog_contracts import DialogDecision
from backend.llm_contracts import validate_extracted_answer
from backend.redaction import redact_sensitive_text

SHORT_DIRECT_ANSWERS = {
    "yes": "yes",
    "no": "no",
    "partial": "partial",
    "unsure": "unsure",
    "jah": "yes",
    "ei": "no",
    "osaliselt": "partial",
    "да": "yes",
    "нет": "no",
    "частично": "partial",
}

META_UNCERTAINTY_PATTERNS = [
    "i do not understand whether our situation is bad or normal",
    "i am not sure what we should check first",
    "i am not sure what to check first",
    "is our situation bad",
    "ma ei tea mida kontrollida",
    "ma ei saa aru kas olukord on halb",
    "не знаю что проверить сначала",
]


def apply_dialog_policy(decision: DialogDecision, context: dict[str, Any], message: str) -> DialogDecision:
    text = str(message or "").strip().lower()
    if _is_meta_uncertainty(text):
        return DialogDecision(
            route="answer_general_advisory",
            should_save_answer=False,
            should_advance_question=False,
            question_id=None,
            answer=None,
            needs_knowledge=False,
            confidence=max(decision.confidence, 0.7),
            reason="Meta uncertainty should be answered as advisory, not saved as an assessment answer.",
            soft_bridge_to_assessment=True,
        )

    if decision.route != "save_assessment_answer":
        return DialogDecision(
            route=decision.route,
            should_save_answer=False,
            should_advance_question=decision.route == "generate_report",
            question_id=None if decision.route != "generate_report" else decision.question_id,
            answer=None,
            needs_knowledge=decision.needs_knowledge,
            confidence=decision.confidence,
            reason=decision.reason,
            soft_bridge_to_assessment=decision.soft_bridge_to_assessment,
        )

    normalized_answer = _normalized_direct_answer(text) or decision.answer
    question_id = decision.question_id or str(context.get("current_question_id") or "").strip() or None

    candidate = validate_extracted_answer(
        {
            "question_id": question_id or "",
            "answer": normalized_answer,
            "confidence": decision.confidence,
            "details": "",
            "should_advance": True,
        }
    )
    if candidate is None:
        return DialogDecision(
            route="ask_clarifying_followup",
            should_save_answer=False,
            should_advance_question=False,
            question_id=question_id,
            answer=None,
            needs_knowledge=False,
            confidence=min(decision.confidence, 0.54),
            reason="The proposed answer did not pass backend validation.",
            soft_bridge_to_assessment=False,
        )

    if decision.confidence < 0.55:
        return DialogDecision(
            route="ask_clarifying_followup",
            should_save_answer=False,
            should_advance_question=False,
            question_id=candidate.question_id,
            answer=None,
            needs_knowledge=False,
            confidence=decision.confidence,
            reason="Low-confidence save requests require a clarifying follow-up instead.",
            soft_bridge_to_assessment=False,
        )

    return DialogDecision(
        route="save_assessment_answer",
        should_save_answer=True,
        should_advance_question=True,
        question_id=candidate.question_id,
        answer=candidate.answer,
        needs_knowledge=False,
        confidence=decision.confidence,
        reason=decision.reason,
        soft_bridge_to_assessment=False,
    )


def _normalized_direct_answer(text: str) -> str | None:
    compact = re.sub(r"[.!?,;:]+", "", text).strip()
    return SHORT_DIRECT_ANSWERS.get(compact)


def _is_meta_uncertainty(text: str) -> bool:
    redacted, _ = redact_sensitive_text(text)
    return any(pattern in redacted for pattern in META_UNCERTAINTY_PATTERNS)
