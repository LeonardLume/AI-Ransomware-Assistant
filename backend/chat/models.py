from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ChatDecision:
    action: str
    intent: str
    intent_confidence: str
    prompt_injection_reason: str = ""


@dataclass(frozen=True)
class AnswerInterpretation:
    summary: str
    confidence_label: str
    confidence_score: float
