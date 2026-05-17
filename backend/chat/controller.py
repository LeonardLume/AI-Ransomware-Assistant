from __future__ import annotations

from typing import Any

from backend.chat.models import AnswerInterpretation, ChatDecision
from backend.chat_interview import classify_user_intent, looks_like_offensive_request
from backend.prompt_firewall import detect_prompt_injection


class ChatController:
    """Small testable backend chat slice.

    Keeps existing orchestration intact, but makes turn routing and answer
    normalization explicit and unit-testable.
    """

    def decide_action(
        self,
        *,
        message: str,
        is_new_session: bool,
        current_question: dict[str, Any] | None,
    ) -> ChatDecision:
        normalized_message = message.strip()

        if normalized_message:
            firewall = detect_prompt_injection(normalized_message)
            if firewall["detected"]:
                return ChatDecision(
                    action="prompt_injection_blocked",
                    intent="guardrail",
                    intent_confidence="high",
                    prompt_injection_reason=str(firewall.get("reason", "")),
                )

        if is_new_session or not normalized_message:
            return ChatDecision(
                action="ask_next_question",
                intent="smalltalk",
                intent_confidence="high",
            )

        if looks_like_offensive_request(normalized_message):
            return ChatDecision(
                action="guardrail_refusal",
                intent="guardrail",
                intent_confidence="high",
            )

        intent = classify_user_intent(normalized_message, current_question)
        action_map = {
            "report_request": "finish_or_continue_report",
            "general_advisory_chat": "answer_general_advisory",
            "clarification": "answer_clarification",
            "smalltalk": "answer_smalltalk",
            "unknown": "answer_smalltalk",
            "answer": "extract_answer",
        }
        return ChatDecision(
            action=action_map.get(intent, "extract_answer"),
            intent=intent,
            intent_confidence=self._intent_confidence(intent, normalized_message),
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
            summary="Tõlgendasin sinu vastuse nii: " + "; ".join(parts) + ".",
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
            f"Praegu on kindlus {interpretation.confidence_label.lower()}, seega vajan üht täpsustust.\n\n"
            f"{clarification_question}"
        )

    def build_answer_acknowledgement(
        self,
        interpretation: AnswerInterpretation | None,
    ) -> str:
        if interpretation is None:
            return ""
        return f"Selge. {interpretation.summary} Kindlus: {interpretation.confidence_label.lower()}."

    def _intent_confidence(self, intent: str, normalized_message: str) -> str:
        if intent in {"report_request", "clarification", "general_advisory_chat"}:
            return "high"
        if intent == "answer" and len(normalized_message.split()) <= 2:
            return "medium"
        if intent == "answer":
            return "high"
        return "medium"

    def _confidence_label(self, score: float) -> str:
        if score >= 0.85:
            return "High"
        if score >= 0.65:
            return "Medium"
        return "Low"

    def _answer_label(self, answer: str) -> str:
        return {
            "yes": "jah",
            "partial": "osaliselt",
            "no": "ei",
            "unsure": "ei tea",
        }.get(answer, answer)

    def _question_label(self, question: dict[str, Any], fallback_id: str) -> str:
        raw = str(question.get("question") or fallback_id).strip()
        short = raw.rstrip("?")
        return short if len(short) <= 72 else short[:69].rstrip() + "..."
