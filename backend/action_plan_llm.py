from __future__ import annotations

import json
from typing import Any

from backend.config import is_real_llm_configured
from backend.llm_client import generate_text, load_prompt, parse_json_from_llm
from backend.redaction import redact_sensitive_text

ALLOWED_EFFORTS = {"Low", "Medium", "High"}


def generate_llm_action_plan(
    *,
    base_action_plan: list[dict[str, Any]],
    scores: dict[str, Any],
    risks: list[dict[str, Any]],
    findings: list[dict[str, Any]],
    answers: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Use the LLM to rewrite action-plan text while preserving fixed report structure."""
    if not base_action_plan:
        return base_action_plan, _metadata("backend_rule_based", "deterministic-action-plan", False)

    if not is_real_llm_configured():
        return base_action_plan, _metadata("backend_rule_based", "deterministic-action-plan", False)

    payload = {
        "scores": _compact_scores(scores),
        "top_risks": [_compact_risk(item) for item in risks[:5]],
        "findings": [_compact_finding(item) for item in findings[:6]],
        "answers": [_compact_answer(item) for item in answers[:30]],
        "base_action_plan": [_compact_action_item(index, item) for index, item in enumerate(base_action_plan)],
    }
    prompt = load_prompt("action_plan_prompt.txt").replace(
        "{{PAYLOAD_JSON}}",
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
    )
    result = generate_text(
        prompt,
        system_prompt=(
            "You are a defensive cybersecurity advisor. Return strict JSON only. "
            "Preserve ids and do not alter scoring or risk labels."
        ),
        temperature=0.2,
        max_output_tokens=1200,
    )
    metadata = _metadata(
        result.provider,
        result.model,
        result.used_real_llm,
        result.error,
        prompt_preview=prompt[:600],
    )

    parsed = parse_json_from_llm(result.text)
    if not result.used_real_llm or not parsed:
        metadata["error"] = metadata.get("error") or "LLM did not return valid action-plan JSON."
        return base_action_plan, metadata

    llm_items = parsed.get("action_plan")
    if not isinstance(llm_items, list):
        metadata["error"] = "LLM action-plan JSON did not contain an action_plan list."
        return base_action_plan, metadata

    refined = _merge_llm_items(base_action_plan, llm_items)
    return refined, metadata


def _metadata(
    provider: str,
    model: str,
    used_real_llm: bool,
    error: str | None = None,
    *,
    prompt_preview: str = "",
) -> dict[str, Any]:
    return {
        "provider": provider,
        "model": model,
        "used_real_llm": used_real_llm,
        "error": error,
        "prompt_preview": prompt_preview,
    }


def _merge_llm_items(base_items: list[dict[str, Any]], llm_items: list[Any]) -> list[dict[str, Any]]:
    by_id: dict[int, dict[str, Any]] = {}
    for raw in llm_items:
        if not isinstance(raw, dict):
            continue
        try:
            item_id = int(raw.get("id"))
        except (TypeError, ValueError):
            continue
        by_id[item_id] = raw

    refined: list[dict[str, Any]] = []
    for index, base in enumerate(base_items):
        llm_item = by_id.get(index, {})
        next_item = dict(base)

        title = _clean_text(llm_item.get("title"), max_length=140)
        if title:
            next_item["title"] = title

        owner = _clean_text(
            llm_item.get("owner_suggestion") or llm_item.get("owner"),
            max_length=80,
        )
        if owner:
            next_item["owner_suggestion"] = owner
            next_item.pop("owner", None)

        deadline = _clean_text(llm_item.get("deadline"), max_length=40)
        if deadline:
            next_item["deadline"] = deadline

        effort = _clean_text(llm_item.get("effort"), max_length=20)
        if effort in ALLOWED_EFFORTS:
            next_item["effort"] = effort

        evidence = _clean_list(llm_item.get("evidence_required"), max_items=4, max_length=120)
        if evidence:
            next_item["evidence_required"] = evidence

        refined.append(next_item)
    return refined


def _compact_scores(scores: dict[str, Any]) -> dict[str, Any]:
    return {
        "overall_score": scores.get("overall_score"),
        "risk_level": scores.get("risk_level"),
        "score_status": scores.get("score_status"),
        "completion_rate": scores.get("completion_rate"),
        "answered_questions": scores.get("answered_questions"),
        "total_questions": scores.get("total_questions"),
        "domain_scores": scores.get("domain_scores", {}),
    }


def _compact_action_item(index: int, item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": index,
        "title": _clean_text(item.get("title"), max_length=140),
        "priority": item.get("priority"),
        "domain": item.get("domain"),
        "owner_suggestion": _clean_text(item.get("owner") or item.get("owner_suggestion"), max_length=80),
        "deadline": _clean_text(item.get("deadline"), max_length=40),
        "effort": _clean_text(item.get("effort"), max_length=20),
        "evidence_required": _clean_list(item.get("evidence_required"), max_items=4, max_length=120),
        "based_on_skill": item.get("based_on_skill"),
        "scoring_impact": item.get("scoring_impact"),
    }


def _compact_risk(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "domain": item.get("domain"),
        "title": _clean_text(item.get("title"), max_length=100),
        "risk_level": item.get("risk_level"),
        "risk": _clean_text(item.get("risk"), max_length=260),
        "recommended_actions": _clean_list(item.get("recommended_actions"), max_items=3, max_length=140),
    }


def _compact_finding(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": _clean_text(item.get("title"), max_length=120),
        "severity": item.get("severity"),
        "domain": item.get("domain"),
        "business_impact": _clean_text(item.get("business_impact"), max_length=220),
        "recommended_fix": _clean_text(item.get("recommended_fix"), max_length=180),
        "verification": _clean_text(item.get("verification"), max_length=180),
    }


def _compact_answer(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "question_id": item.get("question_id"),
        "domain": item.get("domain"),
        "question": _clean_text(item.get("question"), max_length=160),
        "answer": item.get("answer"),
        "details": _clean_text(item.get("details"), max_length=180),
    }


def _clean_list(value: Any, *, max_items: int, max_length: int) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned = [_clean_text(item, max_length=max_length) for item in value]
    return [item for item in cleaned if item][:max_items]


def _clean_text(value: Any, *, max_length: int) -> str:
    if value is None:
        return ""
    redacted, _ = redact_sensitive_text(str(value))
    cleaned = " ".join(redacted.replace("\n", " ").split()).strip()
    return cleaned[:max_length].rstrip()
