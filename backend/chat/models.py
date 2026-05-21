from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ChatDecision:
    action: str
    normalized_answer: str | None
    confidence: float
    reason: str
    user_visible_response: str
    should_advance_question: bool
    should_save_answer: bool
    intent: str = "unknown"
    intent_confidence: str = "medium"
    prompt_injection_reason: str = ""


@dataclass(frozen=True)
class AnswerInterpretation:
    summary: str
    confidence_label: str
    confidence_score: float
