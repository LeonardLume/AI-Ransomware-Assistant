from __future__ import annotations

import json
from typing import Any

from backend.confidence import calculate_domain_confidence, calculate_overall_confidence
from backend.exposure import build_external_exposure_self_check
from backend.findings import build_findings
from backend.hygiene import build_employee_hygiene_actions, build_employee_hygiene_checklist
from backend.llm_client import generate_text, load_prompt
from backend.questions import load_domain_metadata, load_questions, load_source_notes
from backend.redaction import redact_sensitive_text
from backend.scoring import calculate_scores
from backend.skills import (
    build_action_plan_from_skills,
    build_evidence_checklist_from_skills,
    build_skill_references,
    match_skills,
)


def build_risks_and_steps(
    scores: dict[str, Any],
    answer_records: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    metadata = load_domain_metadata()
    domain_details = scores["domain_details"]
    answer_records = answer_records or {}

    weak_domains = sorted(domain_details.items(), key=lambda item: item[1]["score"])
    risks: list[dict[str, Any]] = []
    next_steps: list[str] = []

    for domain, detail in weak_domains:
        if detail["score"] >= 75:
            continue
        meta = metadata.get(domain, {})
        matched_skills = match_skills(domain, answer_records, top_k=2)
        skill_nist = sorted({item for skill in matched_skills for item in skill.get("nist_csf", [])})
        recommended_actions = [
            action
            for skill in matched_skills
            for action in skill.get("recommended_actions", [])[:2]
        ][:4]

        risks.append(
            {
                "domain": domain,
                "title": meta.get("title", domain),
                "score": str(detail["score"]),
                "risk_level": detail["risk_level"],
                "risk": meta.get("low_score_risk", "Valdkond vajab täiendavat tähelepanu."),
                "skill_references": [skill["id"] for skill in matched_skills],
                "nist_csf": skill_nist,
                "recommended_actions": recommended_actions,
            }
        )

        next_steps.append(
            recommended_actions[0]
            if recommended_actions
            else meta.get("default_next_step", "Täpsustada valdkonna riske ja parandustegevusi.")
        )
        if len(risks) >= 5:
            break

    return risks, next_steps


def generate_report(answer_records: dict[str, dict[str, Any]], org_info: dict[str, Any] | None = None) -> dict[str, Any]:
    org_info = org_info or {}
    scores = calculate_scores(answer_records)
    risks, next_steps = build_risks_and_steps(scores, answer_records)
    action_plan = build_action_plan_from_skills(scores, answer_records)
    action_plan.extend(build_employee_hygiene_actions(answer_records))
    evidence_checklist = build_evidence_checklist_from_skills(scores, answer_records)
    skill_references = build_skill_references(scores, answer_records)
    findings = build_findings(scores, answer_records)
    overall_confidence = calculate_overall_confidence(answer_records)
    domain_confidence = calculate_domain_confidence(answer_records)
    employee_hygiene_checklist = build_employee_hygiene_checklist(answer_records)
    external_exposure_self_check = build_external_exposure_self_check()

    question_lookup = {q["id"]: q for q in load_questions()}
    answer_summary = []
    for qid, record in answer_records.items():
        if qid.startswith("followup__"):
            continue
        q = question_lookup.get(qid, {"question": qid, "domain": "unknown"})
        answer_summary.append(
            {
                "question_id": qid,
                "domain": q.get("domain"),
                "question": q.get("question"),
                "answer": record.get("answer"),
                "details": redact_sensitive_text(str(record.get("details", "")))[0],
            }
        )

    base_summary = (
        f"Organisatsiooni lunavararünnakuks valmisoleku skoor on {scores['overall_score']}/100 "
        f"(riskitase: {scores['risk_level']}). "
    )
    if not scores["is_complete"]:
        base_summary += (
            f"Tegemist on esialgse hinnanguga: vastatud on {scores['answered_questions']} / "
            f"{scores['total_questions']} põhiküsimusele. "
        )
    base_summary += "Peamised riskid ja soovitatud järgmised sammud on toodud allpool."

    prompt_payload = {
        "org_info": org_info,
        "scores": scores,
        "top_risks": risks,
        "next_steps": next_steps,
        "action_plan": action_plan,
        "evidence_checklist": evidence_checklist,
        "skill_references": skill_references,
        "findings": findings,
        "overall_confidence": overall_confidence,
        "domain_confidence": domain_confidence,
        "employee_hygiene_checklist": employee_hygiene_checklist,
        "external_exposure_self_check": external_exposure_self_check,
        "answers": answer_summary,
        "scoring_guardrail": "Numeric score comes only from data/scoring_rules.json; skills add explanation and recommendations only.",
    }
    system_prompt = load_prompt("report_prompt.txt")
    user_prompt = "Koosta lõppkasutajale lühike raport järgmise JSON-sisendi põhjal:\n" + json.dumps(
        prompt_payload, ensure_ascii=False, indent=2
    )
    llm_result = generate_text(prompt=user_prompt, system_prompt=system_prompt, temperature=0.2)

    # The rule-based data remains primary; LLM text is a readable layer.
    return {
        **scores,
        "summary": base_summary,
        "top_risks": risks,
        "findings": findings,
        "next_steps": next_steps,
        "action_plan": action_plan,
        "evidence_checklist": evidence_checklist,
        "skill_references": skill_references,
        "overall_confidence": overall_confidence,
        "domain_confidence": domain_confidence,
        "employee_hygiene_checklist": employee_hygiene_checklist,
        "external_exposure_self_check": external_exposure_self_check,
        "llm_report_text": llm_result.text,
        "llm": {
            "provider": llm_result.provider,
            "model": llm_result.model,
            "used_real_llm": llm_result.used_real_llm,
            "error": llm_result.error,
            "report_prompt_preview": system_prompt[:500] + "...",
        },
        "sources": load_source_notes(),
    }
