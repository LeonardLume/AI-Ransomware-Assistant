from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from backend.config import BASE_DIR
from backend.redaction import redact_sensitive_text

LOGGER = logging.getLogger(__name__)
TRACE_PATH = BASE_DIR / "data_runtime" / "ai_traces.jsonl"


def trace_ai_event(event: dict[str, Any]) -> None:
    if not _trace_enabled():
        return

    try:
        payload = _normalize_event(event)
        _append_jsonl(payload)
    except Exception as exc:  # noqa: BLE001
        LOGGER.warning("AI trace write failed: %s", exc)


def trace_intent_decision(
    *,
    session_id: str,
    request_id: str | None,
    intent: str,
    response_type: str = "",
    provider: str = "",
    used_fallback: bool | None = None,
    current_question_id: str | None = None,
    current_domain: str | None = None,
    user_message: str = "",
    should_save_answer: bool = False,
    confidence: str | float | None = None,
) -> None:
    trace_ai_event(
        {
            "session_id": session_id,
            "request_id": request_id,
            "event_type": "intent_decision",
            "intent": intent,
            "response_type": response_type,
            "provider": provider,
            "used_fallback": used_fallback,
            "current_question_id": current_question_id,
            "current_domain": current_domain,
            "message_length": len(user_message or ""),
            "should_save_answer": should_save_answer,
            "confidence": confidence,
            "user_text": user_message,
        }
    )


def trace_retrieval(
    *,
    session_id: str,
    request_id: str | None,
    intent: str,
    response_type: str,
    provider: str = "",
    used_fallback: bool | None = None,
    current_question_id: str | None = None,
    current_domain: str | None = None,
    user_message: str = "",
    retrieved_source_count: int = 0,
    knowledge_source_ids: list[str] | None = None,
) -> None:
    trace_ai_event(
        {
            "session_id": session_id,
            "request_id": request_id,
            "event_type": "retrieval",
            "intent": intent,
            "response_type": response_type,
            "provider": provider,
            "used_fallback": used_fallback,
            "current_question_id": current_question_id,
            "current_domain": current_domain,
            "message_length": len(user_message or ""),
            "should_save_answer": False,
            "retrieved_source_count": retrieved_source_count,
            "knowledge_source_ids": knowledge_source_ids or [],
            "user_text": user_message,
        }
    )


def trace_llm_call(
    *,
    session_id: str,
    request_id: str | None,
    intent: str,
    response_type: str,
    provider: str,
    used_fallback: bool,
    current_question_id: str | None = None,
    current_domain: str | None = None,
    user_message: str = "",
    should_save_answer: bool = False,
    confidence: str | float | None = None,
    retrieved_source_count: int = 0,
    knowledge_source_ids: list[str] | None = None,
    safety_blocked: bool = False,
    latency_ms: float | int | None = None,
) -> None:
    trace_ai_event(
        {
            "session_id": session_id,
            "request_id": request_id,
            "event_type": "llm_call",
            "intent": intent,
            "response_type": response_type,
            "provider": provider,
            "used_fallback": used_fallback,
            "current_question_id": current_question_id,
            "current_domain": current_domain,
            "message_length": len(user_message or ""),
            "should_save_answer": should_save_answer,
            "confidence": confidence,
            "retrieved_source_count": retrieved_source_count,
            "knowledge_source_ids": knowledge_source_ids or [],
            "safety_blocked": safety_blocked,
            "latency_ms": latency_ms,
            "user_text": user_message,
        }
    )


def trace_answer_saved(
    *,
    session_id: str,
    request_id: str | None,
    intent: str,
    response_type: str,
    provider: str,
    used_fallback: bool,
    current_question_id: str | None = None,
    current_domain: str | None = None,
    user_message: str = "",
    saved_answer: dict[str, Any] | None = None,
    confidence: str | float | None = None,
) -> None:
    trace_ai_event(
        {
            "session_id": session_id,
            "request_id": request_id,
            "event_type": "answer_saved",
            "intent": intent,
            "response_type": response_type,
            "provider": provider,
            "used_fallback": used_fallback,
            "current_question_id": current_question_id,
            "current_domain": current_domain,
            "message_length": len(user_message or ""),
            "should_save_answer": True,
            "saved_answer": saved_answer or {},
            "confidence": confidence,
            "user_text": user_message,
        }
    )


def trace_guardrail(
    *,
    session_id: str,
    request_id: str | None,
    intent: str = "guardrail",
    response_type: str,
    provider: str,
    used_fallback: bool,
    current_question_id: str | None = None,
    current_domain: str | None = None,
    user_message: str = "",
    safety_blocked: bool = True,
) -> None:
    trace_ai_event(
        {
            "session_id": session_id,
            "request_id": request_id,
            "event_type": "guardrail",
            "intent": intent,
            "response_type": response_type,
            "provider": provider,
            "used_fallback": used_fallback,
            "current_question_id": current_question_id,
            "current_domain": current_domain,
            "message_length": len(user_message or ""),
            "should_save_answer": False,
            "safety_blocked": safety_blocked,
            "user_text": user_message,
        }
    )


def _trace_enabled() -> bool:
    return str(os.getenv("AI_TRACE_ENABLED", "false")).strip().lower() in {"1", "true", "yes", "on"}


def _include_text() -> bool:
    return str(os.getenv("AI_TRACE_INCLUDE_TEXT", "false")).strip().lower() in {"1", "true", "yes", "on"}


def _normalize_event(event: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "timestamp": datetime.now(UTC).isoformat(),
        "session_id": str(event.get("session_id") or ""),
        "request_id": str(event.get("request_id") or ""),
        "event_type": str(event.get("event_type") or "unknown"),
        "intent": str(event.get("intent") or ""),
        "response_type": str(event.get("response_type") or ""),
        "provider": str(event.get("provider") or ""),
        "used_fallback": bool(event.get("used_fallback", False)),
        "current_question_id": _maybe_str(event.get("current_question_id")),
        "current_domain": _maybe_str(event.get("current_domain")),
        "message_length": int(event.get("message_length") or 0),
        "should_save_answer": bool(event.get("should_save_answer", False)),
        "saved_answer": event.get("saved_answer") if isinstance(event.get("saved_answer"), dict) else None,
        "confidence": event.get("confidence"),
        "retrieved_source_count": int(event.get("retrieved_source_count") or 0),
        "knowledge_source_ids": _string_list(event.get("knowledge_source_ids")),
        "safety_blocked": bool(event.get("safety_blocked", False)),
        "latency_ms": _maybe_float(event.get("latency_ms")),
    }

    if _include_text():
        redacted_text, _ = redact_sensitive_text(str(event.get("user_text") or ""))
        payload["message_text"] = redacted_text

    return payload


def _append_jsonl(payload: dict[str, Any]) -> None:
    TRACE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with TRACE_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def _maybe_str(value: Any) -> str | None:
    if value is None or value == "":
        return None
    return str(value)


def _maybe_float(value: Any) -> float | None:
    if value in {None, ""}:
        return None
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item)]
