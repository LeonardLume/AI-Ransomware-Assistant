from __future__ import annotations

from typing import Any

from backend.questions import load_questions, load_scoring_rules, load_domain_metadata


def risk_level_from_score(score: int) -> str:
    if score >= 80:
        return "Low"
    if score >= 60:
        return "Medium"
    if score >= 40:
        return "High"
    return "Critical"


def calculate_scores(answer_records: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Calculate deterministic rule-based readiness scores.

    answer_records shape:
    {
      "question_id": {"answer": "yes", "details": "..."}
    }
    """
    questions = load_questions()
    rules = load_scoring_rules()
    metadata = load_domain_metadata()

    domain_question_ids: dict[str, list[str]] = {}
    required_question_ids: list[str] = []
    for q in questions:
        qid = q["id"]
        if qid not in rules:
            continue
        domain_question_ids.setdefault(q["domain"], []).append(qid)
        if q.get("required", True):
            required_question_ids.append(qid)

    domain_scores: dict[str, int] = {}
    domain_details: dict[str, dict[str, Any]] = {}

    for domain, qids in domain_question_ids.items():
        earned = 0
        max_possible = 0
        answered = 0
        unanswered: list[str] = []
        critical_negatives: list[str] = []

        for qid in qids:
            rule = rules[qid]
            max_possible += max(rule.values())
            record = answer_records.get(qid)
            if record is None:
                unanswered.append(qid)
                continue
            answer = record.get("answer")
            if answer in rule:
                earned += rule[answer]
                answered += 1
                if answer in {"no", "unsure"}:
                    critical_negatives.append(qid)

        score = round(earned / max_possible * 100) if max_possible else 0
        domain_scores[domain] = score
        domain_details[domain] = {
            "title": metadata.get(domain, {}).get("title", domain),
            "score": score,
            "answered_questions": answered,
            "total_questions": len(qids),
            "unanswered_questions": unanswered,
            "critical_negative_answers": critical_negatives,
            "risk_level": risk_level_from_score(score),
        }

    answered_required = [qid for qid in required_question_ids if qid in answer_records]
    total_required = len(required_question_ids)
    completion_rate = round(len(answered_required) / total_required * 100) if total_required else 100
    is_complete = completion_rate == 100

    # Only average all domain scores. If interview is incomplete, mark as preliminary.
    overall = round(sum(domain_scores.values()) / len(domain_scores)) if domain_scores else 0

    return {
        "overall_score": overall,
        "risk_level": risk_level_from_score(overall),
        "score_status": "final" if is_complete else "preliminary",
        "is_complete": is_complete,
        "answered_questions": len(answered_required),
        "total_questions": total_required,
        "completion_rate": completion_rate,
        "domain_scores": domain_scores,
        "domain_details": domain_details,
        "unanswered_questions": [qid for qid in required_question_ids if qid not in answer_records],
    }
