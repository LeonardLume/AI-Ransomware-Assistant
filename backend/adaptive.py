from __future__ import annotations

import json
from typing import Any

from backend.llm_client import generate_text, load_prompt, parse_json_from_llm
from backend.questions import question_map


def decide_followup(question: dict[str, Any], answer: str, details: str = "") -> dict[str, Any]:
    """Ask LLM whether a short clarification is needed.

    This addresses the feedback: the adaptive interview follows a fixed domain/question
    structure, while LLM is used inside the loop only to decide/phrase clarification questions.
    """
    base_need = answer in {"partial", "unsure"}
    if not base_need and answer != "no":
        return {
            "needs_followup": False,
            "followup_question": "",
            "reason": "Vastus on piisavalt selge ja ei vaja MVP-s täpsustust.",
            "llm": {"used": False, "provider": "not_called", "model": "none"},
        }

    system = load_prompt("followup_prompt.txt")
    prompt = f"""
Küsimus: {question.get('question')}
Domeen: {question.get('domain')}
Valitud vastus: {answer}
Kasutaja täpsustus: {details or '(puudub)'}

Otsusta, kas on vaja täpsustavat küsimust.
""".strip()
    result = generate_text(prompt=prompt, system_prompt=system, temperature=0.1)
    parsed = parse_json_from_llm(result.text)

    if not parsed:
        # Safe deterministic fallback for partial/unsure/no answers.
        parsed = {
            "needs_followup": base_need,
            "followup_question": f"Palun täpsustage lühidalt: mis on praegu suurim ebaselgus seoses teemaga '{question.get('question')}'?",
            "reason": "LLM-i vastust ei õnnestunud JSON-ina tõlgendada; kasutati fallback-küsimust.",
        }

    parsed["llm"] = {
        "used": result.used_real_llm,
        "provider": result.provider,
        "model": result.model,
        "error": result.error,
        "prompt_used": system[:300] + "...",
    }
    return parsed


def get_next_required_question(answer_records: dict[str, Any]) -> dict[str, Any] | None:
    qmap = question_map()
    for q in qmap.values():
        if q.get("required", True) and q["id"] not in answer_records:
            return q
    return None


def make_followup_question(base_question_id: str, followup_text: str) -> dict[str, Any]:
    q = question_map()[base_question_id]
    return {
        "id": f"followup__{base_question_id}",
        "base_question_id": base_question_id,
        "domain": q["domain"],
        "question": followup_text,
        "type": "free_text",
        "required": False,
    }
