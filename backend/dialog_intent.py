from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Literal

from backend.chat_interview import (
    classify_user_intent,
    infer_answer,
    looks_like_current_question_clarification,
    looks_like_offensive_request,
)
from backend.prompt_firewall import detect_prompt_injection

IntentMode = Literal["auto", "direct_answer", "clarification", "context_note", "advisory"]
DialogRoute = Literal[
    "direct_assessment_answer",
    "clarification_current_question",
    "general_advisory_chat",
    "knowledge_grounded_answer",
    "context_note",
    "correction_or_update",
    "ambiguous_needs_confirmation",
    "report_request",
    "smalltalk",
    "guardrail",
]
AssessmentAnswer = Literal["yes", "partial", "no", "unsure"]

VALID_INTENT_MODES = {"auto", "direct_answer", "clarification", "context_note", "advisory"}
VALID_ASSESSMENT_ANSWERS = {"yes", "partial", "no", "unsure"}


@dataclass(frozen=True)
class DialogIntent:
    route: DialogRoute
    suggested_answer: AssessmentAnswer | None
    confidence: float
    should_save_answer: bool
    should_advance_question: bool
    reason: str


def classify_dialog_intent(
    message: str,
    current_question: dict[str, Any] | None,
    chat_context: list[dict[str, Any]] | None = None,
    intent_mode: str = "auto",
    selected_answer: str | None = None,
) -> DialogIntent:
    """Conservative dialog router.

    Explicit UI metadata is authoritative. Free text is only saved when it is a
    clear assessment answer; otherwise we keep the question in place and route
    to clarification, advisory, context, or confirmation.
    """

    _ = chat_context  # reserved for future semantic/LLM routing context
    mode = _normalize_mode(intent_mode)
    answer_override = _normalize_answer(selected_answer)
    text = str(message or "").strip()
    normalized = _normalize(text)

    if answer_override and mode == "direct_answer":
        return DialogIntent(
            route="direct_assessment_answer",
            suggested_answer=answer_override,
            confidence=1.0,
            should_save_answer=True,
            should_advance_question=True,
            reason="Explicit UI direct-answer metadata selected this assessment answer.",
        )

    if text:
        firewall = detect_prompt_injection(text)
        if firewall["detected"] or looks_like_offensive_request(text):
            return DialogIntent(
                route="guardrail",
                suggested_answer=None,
                confidence=1.0,
                should_save_answer=False,
                should_advance_question=False,
                reason=str(firewall.get("reason") or "Unsafe request detected."),
            )

    if mode == "clarification":
        return DialogIntent(
            route="clarification_current_question",
            suggested_answer=None,
            confidence=1.0,
            should_save_answer=False,
            should_advance_question=False,
            reason="Explicit UI mode says the user is asking for clarification.",
        )
    if mode == "context_note":
        return DialogIntent(
            route="context_note",
            suggested_answer=None,
            confidence=1.0,
            should_save_answer=False,
            should_advance_question=False,
            reason="Explicit UI mode says the user is adding non-scoring context.",
        )
    if mode == "advisory":
        return DialogIntent(
            route="knowledge_grounded_answer" if _looks_like_grounded_request(normalized) else "general_advisory_chat",
            suggested_answer=None,
            confidence=1.0,
            should_save_answer=False,
            should_advance_question=False,
            reason="Explicit UI mode says the user wants advisory help.",
        )

    if not normalized:
        return DialogIntent("smalltalk", None, 1.0, False, False, "Empty message.")

    legacy_intent = classify_user_intent(text, current_question)
    if legacy_intent == "report_request":
        return DialogIntent("report_request", None, 0.95, False, True, "User requested report/results.")

    if legacy_intent == "smalltalk":
        return DialogIntent("smalltalk", None, 0.82, False, False, "Smalltalk/acknowledgement.")

    if legacy_intent == "clarification":
        return DialogIntent(
            "clarification_current_question",
            None,
            0.86,
            False,
            False,
            "User is asking for clarification or identity/help, not answering the assessment.",
        )

    if current_question and looks_like_current_question_clarification(text, current_question):
        return DialogIntent(
            "clarification_current_question",
            None,
            0.9,
            False,
            False,
            "User asks about the current assessment question.",
        )

    if _is_question(text, normalized):
        return DialogIntent(
            "knowledge_grounded_answer" if _looks_like_grounded_request(normalized) else "general_advisory_chat",
            None,
            0.82,
            False,
            False,
            "User asked a question, so the assessment answer is not saved automatically.",
        )

    if (
        current_question
        and _looks_like_context_statement(normalized)
        and not _starts_with_explicit_answer(normalized)
        and not _has_current_question_overlap(normalized, current_question)
        and not _has_assessment_topic_signal(normalized)
    ):
        return DialogIntent(
            "context_note",
            None,
            0.72,
            False,
            False,
            "User is providing situational context that does not map cleanly to the active question.",
        )

    if (
        current_question
        and legacy_intent == "answer"
        and _has_assessment_topic_signal(normalized)
        and not _has_current_question_overlap(normalized, current_question)
        and not _starts_with_explicit_answer(normalized)
    ):
        return DialogIntent(
            "correction_or_update",
            None,
            0.7,
            False,
            False,
            "Message appears to contain assessment facts for another question; defer to existing extractor.",
        )

    answer, answer_confidence = _candidate_answer(text, current_question)
    if answer:
        if _is_mixed_or_uncertain_statement(normalized) and not _starts_with_explicit_answer(normalized):
            return DialogIntent(
                "ambiguous_needs_confirmation",
                "partial" if answer in {"yes", "unsure"} else answer,
                min(answer_confidence, 0.64),
                False,
                False,
                "Message mixes possible answer evidence with uncertainty/context; confirmation is required.",
            )
        return DialogIntent(
            "direct_assessment_answer",
            answer,
            answer_confidence,
            answer_confidence >= 0.55,
            answer_confidence >= 0.55,
            "Free text contains a clear assessment answer.",
        )

    if mode == "direct_answer":
        return DialogIntent(
            "ambiguous_needs_confirmation",
            None,
            0.35,
            False,
            False,
            "Answer mode was selected, but the text is not clear enough to save.",
        )

    if current_question and _looks_like_context_statement(normalized):
        return DialogIntent(
            "context_note",
            None,
            0.68,
            False,
            False,
            "User appears to be adding background/context, not committing an answer.",
        )

    if len(re.findall(r"\b\w+\b", normalized)) <= 2:
        return DialogIntent("smalltalk", None, 0.58, False, False, "Short acknowledgement or non-answer.")

    if current_question and _looks_like_non_assessment_request(normalized, current_question):
        return DialogIntent(
            "general_advisory_chat",
            None,
            0.66,
            False,
            False,
            "Message does not semantically overlap with the active assessment question, so it is not saved.",
        )

    return DialogIntent(
        "ambiguous_needs_confirmation",
        None,
        0.4,
        False,
        False,
        "The message is ambiguous; backend will not save it without confirmation.",
    )


def _normalize_mode(value: str | None) -> IntentMode:
    mode = str(value or "auto").strip().lower()
    return mode if mode in VALID_INTENT_MODES else "auto"  # type: ignore[return-value]


def _normalize_answer(value: str | None) -> AssessmentAnswer | None:
    answer = str(value or "").strip().lower()
    return answer if answer in VALID_ASSESSMENT_ANSWERS else None  # type: ignore[return-value]


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.lower())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _is_question(raw: str, normalized: str) -> bool:
    if "?" in raw or "؟" in raw or "？" in raw:
        return True
    if re.search(r"\b(что|почему|как|где|когда|какой|какая|какие|объясни|обьясни)\b", normalized):
        return True
    return bool(
        re.search(
            r"\b(what|why|how|where|when|which|who|mis|mida|miks|kuidas|kus|millal|milline|millised|kas|что|почему|как|где|когда|какой|какая|какие)\b",
            normalized,
        )
    )


def _candidate_answer(
    message: str,
    current_question: dict[str, Any] | None,
) -> tuple[AssessmentAnswer | None, float]:
    if not current_question:
        return None, 0.0
    explicit_answer = _explicit_answer_from_start(_normalize(message))
    if explicit_answer:
        return explicit_answer, 0.9
    answer, confidence = infer_answer(message, str(current_question.get("id") or ""))
    if answer in VALID_ASSESSMENT_ANSWERS:
        return answer, float(confidence)
    return None, 0.0


def _explicit_answer_from_start(normalized: str) -> AssessmentAnswer | None:
    words = re.findall(r"\b\w+\b", normalized)
    if re.match(r"^\s*(yes|jah|\u0434\u0430)\b", normalized):
        return "yes"
    if re.match(r"^\s*(partial|osaliselt|\u0447\u0430\u0441\u0442\u0438\u0447\u043d\u043e)\b", normalized):
        return "partial"
    if re.match(r"^\s*(no|ei|\u043d\u0435\u0442)\b", normalized):
        if re.search(r"\b(partial|osaliselt|\u0447\u0430\u0441\u0442\u0438\u0447\u043d\u043e)\b", normalized):
            return "partial"
        if len(words) <= 3:
            return "no"
        return None
    if re.match(r"^\s*(unsure|ei tea|\u043d\u0435 \u0437\u043d\u0430\u044e)\b", normalized):
        return "unsure"
    return None


def _starts_with_explicit_answer(normalized: str) -> bool:
    if _explicit_answer_from_start(normalized):
        return True
    if re.match(r"^\s*(да|нет|частично)\b", normalized):
        return True
    return bool(re.match(r"^\s*(yes|no|partial|unsure|jah|ei|osaliselt|да|нет|частично)\b", normalized))


def _is_mixed_or_uncertain_statement(normalized: str) -> bool:
    if re.search(r"\b(не знаю|не уверен|не уверена|но|однако)\b", normalized):
        return True
    has_uncertainty = bool(
        re.search(r"\b(not sure|unsure|maybe|ei tea|pole kindel|не знаю|не уверен|не уверена)\b", normalized)
    )
    has_contrast = bool(re.search(r"\b(but|although|though|aga|kuid|но|однако)\b", normalized))
    return has_uncertainty or has_contrast


def _looks_like_context_statement(normalized: str) -> bool:
    words = re.findall(r"\b\w+\b", normalized)
    if len(words) < 5:
        return False
    if _is_mixed_or_uncertain_statement(normalized):
        return True
    if re.search(r"\b(мы|нас|нам|наш|наша|наши)\b", normalized):
        return True
    return bool(re.search(r"\b(we|our|meil|meie|у нас|нам|me|my|i)\b", normalized))


def _has_current_question_overlap(normalized: str, current_question: dict[str, Any]) -> bool:
    question_text = _normalize(
        " ".join(
            [
                str(current_question.get("id") or ""),
                str(current_question.get("question") or ""),
                str(current_question.get("help") or ""),
                str(current_question.get("domain") or ""),
            ]
        )
    )
    question_terms = {word for word in re.findall(r"\b\w+\b", question_text) if len(word) >= 4}
    message_terms = {word for word in re.findall(r"\b\w+\b", normalized) if len(word) >= 4}
    return bool(question_terms & message_terms)


def _has_assessment_topic_signal(normalized: str) -> bool:
    return bool(
        re.search(
            r"\b(backup\w*|varukoop\w*|restore\w*|taast\w*|mfa|2fa|patch\w*|admin\w*|incident\w*|response\w*|log\w*|monitor\w*|ransomware|lunavara|account\w*|konto\w*|vpn|rdp|cloud|pilv\w*|email|e-post)\b",
            normalized,
        )
    )


def _looks_like_non_assessment_request(normalized: str, current_question: dict[str, Any]) -> bool:
    words = re.findall(r"\b\w+\b", normalized)
    if len(words) < 2:
        return False

    question_text = _normalize(
        " ".join(
            [
                str(current_question.get("id") or ""),
                str(current_question.get("question") or ""),
                str(current_question.get("help") or ""),
                str(current_question.get("domain") or ""),
            ]
        )
    )
    question_terms = {word for word in re.findall(r"\b\w+\b", question_text) if len(word) >= 4}
    message_terms = {word for word in words if len(word) >= 4}
    return not bool(question_terms & message_terms)


def _looks_like_grounded_request(normalized: str) -> bool:
    if re.search(r"\b(доказ|источник|источники|tõend|allikas)\b", normalized):
        return True
    return bool(re.search(r"\b(evidence|source|sources|prove|proof|tõend|toend|allikas|доказ|источник)\b", normalized))
