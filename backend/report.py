from __future__ import annotations

from typing import Any

from backend.confidence import calculate_domain_confidence, calculate_overall_confidence
from backend.exposure import build_external_exposure_self_check
from backend.findings import build_findings
from backend.hygiene import build_employee_hygiene_actions, build_employee_hygiene_checklist
from backend.questions import (
    load_assessment_methodology,
    load_domain_metadata,
    load_questions,
    load_source_notes,
    load_threat_overlay_notes,
    resolve_source_refs,
)
from backend.redaction import redact_sensitive_text
from backend.scoring import calculate_scores, explain_score
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

    lines.append(
        "Numbriline skoor põhineb salvestatud struktureeritud vastustel ja backendi reeglitel. "
        "AI võib aidata küsimusi selgitada, kuid ametlikku skoori ei arvuta ega muuda AI."
    )
    return "\n\n".join(lines)


def generate_report(answer_records: dict[str, dict[str, Any]], org_info: dict[str, Any] | None = None) -> dict[str, Any]:
    org_info = org_info or {}
    scores = calculate_scores(answer_records)
    score_explanation = explain_score(answer_records)
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
    methodology = load_assessment_methodology()
    threat_overlay = load_threat_overlay_notes()

    question_lookup = {q["id"]: q for q in load_questions()}
    domain_explanation = {item["domain"]: item for item in score_explanation.get("domains", [])}
    evidence_checklist = _enrich_evidence_checklist(evidence_checklist, domain_explanation)
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

    findings = _enrich_findings(findings, domain_explanation)
    risks = _enrich_risks(risks, domain_explanation)

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
        "methodology": {
            "methodology_name": methodology.get("methodology_name"),
            "methodology_version": methodology.get("methodology_version"),
            "questions_version": methodology.get("questions_version"),
            "scoring_version": methodology.get("scoring_version"),
            "score_scale": methodology.get("score_scale"),
            "important_note": methodology.get("important_note"),
            "scoring_principles": methodology.get("scoring_principles", []),
        },
        "score_explanation": score_explanation,
        "threat_overlay": threat_overlay,
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


def _enrich_risks(risks: list[dict[str, Any]], domain_explanation: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for risk in risks:
        domain = str(risk.get("domain") or "")
        explanation = domain_explanation.get(domain, {})
        enriched.append({**risk, **_trace_from_questions(explanation.get("questions", []))})
    return enriched


def _enrich_findings(findings: list[dict[str, Any]], domain_explanation: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    question_map = {
        "finding_restore_capability_unproven": ["restore_tested"],
        "finding_backup_isolation_missing": ["backup_isolated"],
        "finding_admin_mfa_incomplete": ["mfa_admin"],
        "finding_remote_access_mfa_incomplete": ["mfa_remote_access"],
        "finding_ir_process_not_documented": ["ir_plan_exists"],
        "finding_detection_monitoring_weak": [],
        "finding_admin_rights_too_broad": ["least_privilege", "separate_admin_accounts"],
    }

    enriched: list[dict[str, Any]] = []
    for finding in findings:
        finding_id = str(finding.get("id") or "")
        domain = str(finding.get("domain") or "")
        explanation = domain_explanation.get(domain, {})
        domain_questions = explanation.get("questions", [])
        question_ids = question_map.get(finding_id) or []
        selected = [item for item in domain_questions if item.get("question_id") in question_ids] if question_ids else domain_questions
        trace = _trace_from_questions(selected)
        if not trace.get("attack_path_notes") and domain in {"mfa_access", "admin_rights", "patching", "detection_monitoring"}:
            trace["attack_path_notes"] = (
                "This weakness can contribute to common ransomware paths such as credential compromise, lateral movement and backup impact."
            )
        enriched.append({**finding, **trace})
    return enriched


def _enrich_evidence_checklist(
    groups: list[dict[str, Any]],
    domain_explanation: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for group in groups:
        domain = str(group.get("domain") or "")
        explanation = domain_explanation.get(domain, {})
        trace = _trace_from_questions(explanation.get("questions", []))
        source_refs = list(trace.get("source_refs") or [])
        enriched.append(
            {
                **group,
                "source_refs": source_refs,
                "source_links": _source_links_from_refs(source_refs),
                "framework_mappings": trace.get("framework_mappings", {}),
                "evidence_examples": trace.get("evidence_examples", []),
            }
        )
    return enriched


def _source_links_from_refs(source_refs: list[str]) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    for source in resolve_source_refs(source_refs):
        links.append(
            {
                "id": source.get("id"),
                "name": source.get("name"),
                "publisher": source.get("publisher"),
                "type": source.get("type"),
                "url": source.get("url"),
                "note": source.get("note"),
            }
        )
    return links


def _trace_from_questions(questions: list[dict[str, Any]]) -> dict[str, Any]:
    if not questions:
        return {}

    prioritized = sorted(
        questions,
        key=lambda item: (int(item.get("points_lost", 0)), int(item.get("max_points", 0))),
        reverse=True,
    )
    selected = prioritized[:2]

    source_refs: list[str] = []
    evidence_examples: list[str] = []
    framework_mappings: dict[str, list[str]] = {}
    rationale_bits: list[str] = []

    for item in selected:
        for ref in item.get("source_refs", []):
            if ref not in source_refs:
                source_refs.append(ref)
        for example in item.get("evidence_examples", []):
            if example not in evidence_examples:
                evidence_examples.append(example)
        for key, values in (item.get("framework_mappings") or {}).items():
            merged = framework_mappings.setdefault(key, [])
            for value in values:
                if value not in merged:
                    merged.append(value)
        rationale = str(item.get("rationale") or "").strip()
        if rationale and rationale not in rationale_bits:
            rationale_bits.append(rationale)

    primary = selected[0]
    attack_mappings = list(primary.get("attack_mappings") or [])
    attack_path_notes = attack_mappings[0]["relationship"] if attack_mappings else ""

    return {
        "source_refs": source_refs,
        "framework_mappings": framework_mappings,
        "scoring_rationale_summary": rationale_bits[0] if rationale_bits else "",
        "evidence_examples": evidence_examples[:5],
        "attack_mappings": attack_mappings,
        "attack_path_notes": attack_path_notes,
    }
