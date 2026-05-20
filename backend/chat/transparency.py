from __future__ import annotations

from typing import Any

from backend.questions import load_source_notes, question_map


def build_assistant_transparency(
    *,
    response_type: str,
    current_question: dict[str, Any] | None,
    current_question_id: str | None,
    extracted_answers: dict[str, str] | None,
    knowledge_sources: list[dict[str, Any]] | None,
    report: dict[str, Any] | None,
    prompt_injection_blocked: bool,
) -> dict[str, Any]:
    return {
        "answer_type": response_type,
        "answer_status": _answer_status(
            response_type=response_type,
            current_question_id=current_question_id,
            extracted_answers=extracted_answers,
            report=report,
            prompt_injection_blocked=prompt_injection_blocked,
        ),
        "sources": _source_entries(
            response_type=response_type,
            current_question=current_question,
            extracted_answers=extracted_answers,
            knowledge_sources=knowledge_sources,
        ),
        "saved_answers": _saved_answer_items(extracted_answers),
    }


def _question_source_entries(question: dict[str, Any] | None) -> list[dict[str, str]]:
    if not question:
        return []
    return [
        {"label": str(ref), "kind": "question_source"}
        for ref in (question.get("source_refs") or [])
        if str(ref).strip()
    ]


def _knowledge_source_entries(items: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for item in items or []:
        label = str(item.get("name") or item.get("label") or "").strip()
        if not label:
            continue
        entry = {"label": label, "kind": "knowledge_source"}
        url = str(item.get("url") or "").strip()
        if url:
            entry["url"] = url
        entries.append(entry)
    return entries


def _dedupe_source_entries(entries: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for entry in entries:
        key = f"{entry.get('label', '').strip().lower()}|{entry.get('url', '').strip().lower()}"
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(entry)
    return unique


def _saved_answer_items(extracted_answers: dict[str, str] | None) -> list[dict[str, str]]:
    return [
        {"question_id": qid, "answer": answer}
        for qid, answer in (extracted_answers or {}).items()
        if str(qid).strip() and str(answer).strip()
    ]


def _saved_answer_source_entries(extracted_answers: dict[str, str] | None) -> list[dict[str, str]]:
    qmap = question_map()
    entries: list[dict[str, str]] = []
    for qid in (extracted_answers or {}).keys():
        entries.extend(_question_source_entries(qmap.get(qid)))
    return _dedupe_source_entries(entries)


def _answer_status(
    *,
    response_type: str,
    current_question_id: str | None,
    extracted_answers: dict[str, str] | None,
    report: dict[str, Any] | None,
    prompt_injection_blocked: bool,
) -> str:
    saved_answer_ids = list((extracted_answers or {}).keys())
    if prompt_injection_blocked or response_type in {"guardrail", "prompt_injection_blocked", "report_request_blocked"}:
        return "blocked"
    if report:
        return "report_ready"
    if saved_answer_ids:
        if current_question_id and current_question_id not in saved_answer_ids:
            return "saved_and_advanced"
        return "answer_saved"
    if response_type == "context_note":
        return "context_recorded"
    if response_type == "pending_answer_confirmation":
        return "needs_confirmation"
    if response_type == "clarification":
        return "followup_requested"
    if response_type in {"client_question", "general_advisory_chat", "knowledge_grounded_answer", "smalltalk"}:
        return "question_unchanged"
    if response_type == "interview_question":
        return "question_presented"
    return "info_only"


def _source_entries(
    *,
    response_type: str,
    current_question: dict[str, Any] | None,
    extracted_answers: dict[str, str] | None,
    knowledge_sources: list[dict[str, Any]] | None,
) -> list[dict[str, str]]:
    if response_type == "knowledge_grounded_answer":
        entries = _knowledge_source_entries(knowledge_sources or load_source_notes())
        return _dedupe_source_entries(entries)

    if response_type in {"client_question", "general_advisory_chat", "context_note", "pending_answer_confirmation"}:
        entries = _question_source_entries(current_question)
        if not entries:
            entries = _knowledge_source_entries(load_source_notes())
        return _dedupe_source_entries(entries)

    if extracted_answers:
        return _saved_answer_source_entries(extracted_answers)

    if response_type == "interview_question":
        return _question_source_entries(current_question)

    return []
