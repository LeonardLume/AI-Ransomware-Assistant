from __future__ import annotations

from typing import Any

from backend.chat.models import AnswerInterpretation, ChatDecision
from backend.prompt_firewall import detect_prompt_injection


class ChatController:
    """Legacy helper utilities kept for compatibility.

    The main `/chat` endpoint now uses the semantic LLM decision flow directly.
    This controller still provides small formatting helpers used by response code
    and tests that import it.
    """

    def decide_action(
        self,
        *,
        message: str,
        is_new_session: bool,
        current_question: dict[str, Any] | None,
    ) -> ChatDecision:
        _ = is_new_session
        _ = current_question
        firewall = detect_prompt_injection(message.strip())
        if firewall["detected"]:
            return ChatDecision(
                action="refuse",
                normalized_answer=None,
                confidence=1.0,
                reason=str(firewall.get("reason", "")),
                user_visible_response="",
                should_advance_question=False,
                should_save_answer=False,
                intent="guardrail",
                intent_confidence="high",
                prompt_injection_reason=str(firewall.get("reason", "")),
            )
        return ChatDecision(
            action="smalltalk",
            normalized_answer=None,
            confidence=0.5,
            reason="Legacy controller is not the primary router.",
            user_visible_response="",
            should_advance_question=False,
            should_save_answer=False,
            intent="unknown",
            intent_confidence="medium",
        )

    def build_answer_interpretation(
        self,
        extracted_answers: dict[str, str] | None,
        confidence: dict[str, float] | None,
        questions: list[dict[str, Any]],
    ) -> AnswerInterpretation | None:
        if not extracted_answers:
            return None

        qmap = {question["id"]: question for question in questions}
        parts: list[str] = []
        scores: list[float] = []

        for qid, answer in extracted_answers.items():
            question = qmap.get(qid, {})
            label = self._question_label(question, qid)
            parts.append(f"{label}: {self._answer_label(answer)}")
            score = (confidence or {}).get(qid)
            if isinstance(score, (int, float)):
                scores.append(float(score))

        average_confidence = sum(scores) / len(scores) if scores else 0.6
        return AnswerInterpretation(
            summary="I interpreted your answer as: " + "; ".join(parts) + ".",
            confidence_label=self._confidence_label(average_confidence),
            confidence_score=round(average_confidence, 2),
        )

    def build_clarification_message(
        self,
        *,
        clarification_question: str,
        interpretation: AnswerInterpretation | None,
    ) -> str:
        if interpretation is None:
            return clarification_question
        return (
            f"{interpretation.summary} "
            f"Confidence is {interpretation.confidence_label.lower()}, so I need one clarification.\n\n"
            f"{clarification_question}"
        )

    def build_answer_acknowledgement(
        self,
        interpretation: AnswerInterpretation | None,
    ) -> str:
        if interpretation is None:
            return "Saved."
        return f"Saved. {interpretation.summary}"

    def _confidence_label(self, score: float) -> str:
        if score >= 0.85:
            return "High"
        if score >= 0.65:
            return "Medium"
        return "Low"

    def _answer_label(self, answer: str) -> str:
        return {
            "yes": "yes",
            "partial": "partial",
            "no": "no",
            "unsure": "unsure",
        }.get(answer, answer)

    def _question_label(self, question: dict[str, Any], fallback_id: str) -> str:
        raw = str(question.get("question") or fallback_id).strip()
        short = raw.rstrip("?")
        return short if len(short) <= 72 else short[:69].rstrip() + "..."
