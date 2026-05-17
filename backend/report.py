from __future__ import annotations

from typing import Any

from backend.confidence import calculate_domain_confidence, calculate_overall_confidence
from backend.exposure import build_external_exposure_self_check
from backend.findings import build_findings
from backend.hygiene import build_employee_hygiene_actions, build_employee_hygiene_checklist
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


def build_report_narrative(
    *,
    scores: dict[str, Any],
    risks: list[dict[str, Any]],
    next_steps: list[str],
    findings: list[dict[str, Any]],
    overall_confidence: str,
) -> str:
    lines: list[str] = []
    lines.append(
        f"Valmisoleku koondhinnang on {scores['overall_score']}/100 ja riskitase on {scores['risk_level']}."
    )

    if not scores["is_complete"]:
        lines.append(
            f"Hinnang on esialgne, sest vastatud on {scores['answered_questions']} / {scores['total_questions']} põhiküsimusele."
        )

    lines.append(f"Vastuste usaldusväärsuse hinnang on {overall_confidence.lower()}.")

    if risks:
        risk_summary = "; ".join(
            f"{risk.get('title', risk.get('domain', 'Valdkond'))}: {str(risk.get('risk', '')).strip().rstrip('.')}"
            for risk in risks[:3]
        )
        if risk_summary:
            lines.append(f"Olulisemad riskikohad on {risk_summary}.")

    if findings:
        finding_titles = [str(item.get("title", "")).strip() for item in findings[:3] if str(item.get("title", "")).strip()]
        if finding_titles:
            lines.append("Kõige nähtavamad kontrollilüngad puudutavad järgmisi teemasid: " + "; ".join(finding_titles) + ".")

    if next_steps:
        step_summary = "; ".join(str(step).strip().rstrip(".") for step in next_steps[:4])
        if step_summary:
            lines.append(f"Järgmised praktilised sammud on {step_summary}.")

    lines.append("Numbriline skoor põhineb ainult backendi reeglitel ja küsimuste vastustel.")
    return "\n\n".join(lines)


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

    report_text = build_report_narrative(
        scores=scores,
        risks=risks,
        next_steps=next_steps,
        findings=findings,
        overall_confidence=overall_confidence,
    )

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
        "answers": answer_summary,
        "llm_report_text": report_text,
        "report_text": report_text,
        "llm": {
            "provider": "backend_rule_based",
            "model": "deterministic-report",
            "used_real_llm": False,
            "error": None,
            "report_prompt_preview": "",
        },
        "sources": load_source_notes(),
    }
