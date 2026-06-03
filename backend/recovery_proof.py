from __future__ import annotations

import copy
import hashlib
import json
import re
from functools import lru_cache
from typing import Any

from backend.config import DATA_DIR

CONTROL_STATUS_SCORES = {
    "proven": 100,
    "partially_proven": 50,
    "not_proven": 0,
    "unknown": 0,
}

ALLOWED_SOURCES = {
    "manual",
    "uploaded_text",
    "prowler",
    "scubagear",
    "wazuh",
    "velociraptor",
    "defectdojo",
    "sigma",
    "complianceascode",
    "dradis",
    "generic",
}

ALLOWED_EVIDENCE_TYPES = {
    "restore_test_report",
    "backup_config",
    "mfa_config",
    "logging_config",
    "vulnerability_finding",
    "asset_inventory",
    "ir_plan",
    "external_exposure",
    "other",
}

TYPE_ALIASES = {
    "restore_test": "restore_test_report",
    "restore": "restore_test_report",
    "backup": "backup_config",
    "backup_report": "backup_config",
    "mfa": "mfa_config",
    "conditional_access": "mfa_config",
    "logs": "logging_config",
    "log": "logging_config",
    "detection": "logging_config",
    "detection_summary": "logging_config",
    "vulnerability": "vulnerability_finding",
    "vuln": "vulnerability_finding",
    "inventory": "asset_inventory",
    "asset": "asset_inventory",
    "incident_response": "ir_plan",
    "playbook": "ir_plan",
    "exposure": "external_exposure",
    "external": "external_exposure",
}

CONTROL_KEYWORDS = {
    "critical_assets_identified": [
        "asset",
        "critical system",
        "business owner",
        "owner list",
        "inventory",
        "dependency",
    ],
    "backup_exists_for_critical_systems": [
        "backup",
        "job",
        "protected system",
        "coverage",
        "retention",
        "schedule",
    ],
    "backup_isolation_or_immutability_proven": [
        "immutable",
        "immutability",
        "isolated",
        "offline",
        "repository",
        "separate permission",
    ],
    "restore_test_proven": [
        "restore",
        "restore test",
        "restored",
        "rto",
        "rpo",
        "recovery test",
    ],
    "admin_mfa_proven": [
        "mfa",
        "conditional access",
        "admin",
        "privileged",
        "entra",
        "m365",
    ],
    "backup_admin_separation_proven": [
        "backup admin",
        "separate admin",
        "least privilege",
        "privileged access",
        "console access",
        "role list",
    ],
    "endpoint_detection_or_logging_present": [
        "endpoint",
        "edr",
        "alert",
        "logging",
        "log",
        "siem",
        "failed sign",
        "file integrity",
        "wazuh",
        "detection",
    ],
    "incident_response_playbook_exists": [
        "incident response",
        "ir plan",
        "playbook",
        "contact",
        "escalation",
        "ransomware plan",
    ],
    "recovery_priority_list_exists": [
        "recovery priority",
        "restore order",
        "rto",
        "rpo",
        "business owner",
        "dependency",
    ],
    "external_exposure_reviewed": [
        "external",
        "exposure",
        "internet",
        "public",
        "vpn",
        "rdp",
        "cloud",
        "prowler",
    ],
}

NEGATIVE_OR_WEAK_TERMS = [
    "absent",
    "disabled",
    "exception",
    "excluded",
    "failed",
    "fail",
    "gap",
    "missing",
    "not provided",
    "partial",
    "unprotected",
    "weak",
]

CRITICAL_CONTROL_IDS = {
    "backup_exists_for_critical_systems",
    "backup_isolation_or_immutability_proven",
    "restore_test_proven",
}

HIGH_CONTROL_IDS = {
    "critical_assets_identified",
    "admin_mfa_proven",
    "backup_admin_separation_proven",
    "endpoint_detection_or_logging_present",
    "incident_response_playbook_exists",
}


@lru_cache(maxsize=1)
def _load_recovery_controls_cached() -> list[dict[str, Any]]:
    with open(DATA_DIR / "recovery_controls.json", "r", encoding="utf-8") as f:
        return json.load(f)


def load_recovery_controls() -> list[dict[str, Any]]:
    return copy.deepcopy(_load_recovery_controls_cached())


def normalize_evidence_items(raw_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, raw_item in enumerate(raw_items or []):
        if not isinstance(raw_item, dict):
            continue

        source = _normalize_source(raw_item)
        evidence_type = _normalize_evidence_type(raw_item)
        title = _first_text(
            raw_item,
            "title",
            "name",
            "check_title",
            "controlName",
            "finding",
            default=f"Evidence item {index + 1}",
        )
        summary = _first_text(
            raw_item,
            "summary",
            "description",
            "message",
            "status_extended",
            "details",
            "text",
            default="",
        )
        confidence = _normalize_confidence(raw_item.get("confidence"))
        related_control_ids = _normalize_string_list(raw_item.get("related_control_ids"))
        raw_payload = raw_item.get("raw") if isinstance(raw_item.get("raw"), dict) else raw_item
        evidence_id = str(raw_item.get("id") or "").strip()
        if not evidence_id:
            evidence_id = _stable_evidence_id(index, source, evidence_type, title, summary, raw_payload)

        normalized.append(
            {
                "id": evidence_id,
                "source": source,
                "type": evidence_type,
                "title": title,
                "summary": summary,
                "raw": raw_payload,
                "confidence": confidence,
                "related_control_ids": related_control_ids,
            }
        )
    return normalized


def evaluate_recovery_control(
    control: dict[str, Any],
    answer_records: dict[str, dict[str, Any]],
    evidence_items: list[dict[str, Any]],
) -> dict[str, Any]:
    evidence_items = normalize_evidence_items(evidence_items)
    matched_evidence = [
        _evidence_match_detail(control, evidence)
        for evidence in evidence_items
    ]
    matched_evidence = [match for match in matched_evidence if match is not None]

    answer_support = _answer_support(control, answer_records)
    required_types = set(_normalize_string_list(control.get("required_evidence_types")))
    matched_types = {
        str(match["item"].get("type"))
        for match in matched_evidence
        if str(match["item"].get("type"))
    }
    direct_matches = [match for match in matched_evidence if match["match"] == "direct"]
    exact_type_matches = [
        match
        for match in matched_evidence
        if match["item"].get("type") in required_types
    ]
    strong_evidence = [
        match
        for match in matched_evidence
        if match["strength"] == "strong"
        and (match in direct_matches or match in exact_type_matches)
    ]
    weak_evidence = [
        match
        for match in matched_evidence
        if match["strength"] != "strong"
    ]

    status = "unknown"
    reason = "No questionnaire answer or imported evidence supports this control yet."
    evidence_confidence = 0

    if strong_evidence:
        status = "proven"
        evidence_confidence = _max_evidence_confidence(strong_evidence)
        reason = "Imported evidence directly or strongly supports the required recovery proof."
    elif matched_evidence:
        status = "partially_proven"
        evidence_confidence = max(45, _max_evidence_confidence(weak_evidence or matched_evidence))
        reason = "Evidence was imported, but it is weak, partial, low-confidence, or not enough for full proof."
    elif answer_support["signal"] in {"positive", "partial"}:
        status = "partially_proven"
        evidence_confidence = 30 if answer_support["signal"] == "positive" else 20
        reason = "Questionnaire answers support this control, but no imported evidence proves it."
    elif answer_support["signal"] == "negative":
        status = "not_proven"
        evidence_confidence = 0
        reason = "Questionnaire answers indicate the control is missing or uncertain, and no imported evidence proves it."

    missing_types = sorted(required_types - matched_types) if status != "proven" else []
    supporting_evidence = [_public_evidence(match) for match in matched_evidence]

    return {
        "control_id": control.get("id"),
        "title": control.get("title"),
        "category": control.get("category"),
        "description": control.get("description"),
        "status": status,
        "status_score": CONTROL_STATUS_SCORES[status],
        "reason": reason,
        "answer_support": answer_support,
        "supporting_evidence": supporting_evidence,
        "matched_evidence_types": sorted(matched_types),
        "missing_evidence_types": missing_types,
        "evidence_confidence": evidence_confidence,
        "client_friendly_risk": control.get("client_friendly_risk", ""),
        "technical_risk": control.get("technical_risk", ""),
        "required_evidence_types": list(control.get("required_evidence_types") or []),
        "weak_if_missing": list(control.get("weak_if_missing") or []),
        "mapped_existing_question_ids": list(control.get("mapped_existing_question_ids") or []),
        "remediation_template": dict(control.get("remediation_template") or {}),
        "framework_mappings": dict(control.get("framework_mappings") or {}),
    }


def run_recovery_proof(
    answer_records: dict[str, dict[str, Any]],
    evidence_items: list[dict[str, Any]],
) -> dict[str, Any]:
    controls = load_recovery_controls()
    normalized_evidence = normalize_evidence_items(evidence_items)
    control_results = [
        evaluate_recovery_control(control, answer_records or {}, normalized_evidence)
        for control in controls
    ]
    proof_gaps = detect_proof_gaps(control_results)
    remediation_tickets = generate_remediation_tickets(proof_gaps, control_results)
    proven_controls = [result for result in control_results if result["status"] == "proven"]
    partially_proven_controls = [
        result for result in control_results if result["status"] == "partially_proven"
    ]
    unproven_controls = [
        result
        for result in control_results
        if result["status"] in {"not_proven", "unknown"}
    ]

    recovery_proof_score = calculate_recovery_proof_score(control_results)
    evidence_confidence = calculate_evidence_confidence(control_results)

    return {
        "safe_defensive_only": True,
        "engine_version": "recovery-proof-v1",
        "recovery_proof_score": recovery_proof_score,
        "evidence_confidence": evidence_confidence,
        "controls_count": len(control_results),
        "evidence_items_count": len(normalized_evidence),
        "proven_controls": proven_controls,
        "partially_proven_controls": partially_proven_controls,
        "unproven_controls": unproven_controls,
        "control_results": control_results,
        "proof_gaps": proof_gaps,
        "remediation_tickets": remediation_tickets,
        "client_summary": _client_summary(
            recovery_proof_score,
            evidence_confidence,
            proven_controls,
            partially_proven_controls,
            unproven_controls,
            proof_gaps,
        ),
        "technical_summary": _technical_summary(
            control_results,
            normalized_evidence,
            proof_gaps,
        ),
    }


def calculate_recovery_proof_score(control_results: list[dict[str, Any]]) -> int:
    if not control_results:
        return 0
    total = sum(CONTROL_STATUS_SCORES.get(str(result.get("status")), 0) for result in control_results)
    return round(total / len(control_results))


def calculate_evidence_confidence(control_results: list[dict[str, Any]]) -> int:
    if not control_results:
        return 0
    total = sum(int(result.get("evidence_confidence") or 0) for result in control_results)
    return round(total / len(control_results))


def detect_proof_gaps(control_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    gaps: list[dict[str, Any]] = []
    for result in control_results:
        status = str(result.get("status") or "")
        if status == "proven":
            continue

        control_id = str(result.get("control_id") or "")
        missing_evidence = list(result.get("missing_evidence_types") or [])
        if not missing_evidence:
            missing_evidence = list(result.get("required_evidence_types") or [])
        severity = _gap_severity(control_id, status)
        gaps.append(
            {
                "id": f"gap_{control_id}",
                "control_id": control_id,
                "control_title": result.get("title"),
                "severity": severity,
                "status": status,
                "missing_evidence_types": missing_evidence,
                "description": _gap_description(result),
                "client_friendly_risk": result.get("client_friendly_risk", ""),
                "technical_risk": result.get("technical_risk", ""),
                "recommended_action": (result.get("remediation_template") or {}).get("title", ""),
            }
        )
    return gaps


def generate_remediation_tickets(
    proof_gaps: list[dict[str, Any]],
    control_results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    results_by_id = {str(result.get("control_id")): result for result in control_results}
    tickets: list[dict[str, Any]] = []
    for gap in proof_gaps:
        control_id = str(gap.get("control_id") or "")
        result = results_by_id.get(control_id, {})
        template = dict(result.get("remediation_template") or {})
        evidence_needed = template.get("evidence_needed") or gap.get("missing_evidence_types") or []
        tickets.append(
            {
                "id": f"ticket_{control_id}",
                "title": template.get("title") or f"Collect proof for {gap.get('control_title', control_id)}",
                "priority": template.get("priority") or gap.get("severity") or "Medium",
                "description": template.get("description") or gap.get("description") or "",
                "evidence_needed": list(evidence_needed),
                "affected_controls": [control_id],
                "affected_business_processes": _affected_business_processes(control_id),
                "suggested_owner": template.get("suggested_owner") or "MSP / IT owner",
                "client_friendly_explanation": template.get("client_friendly_explanation")
                or gap.get("client_friendly_risk", ""),
                "technical_notes": template.get("technical_notes") or gap.get("technical_risk", ""),
            }
        )
    return tickets


def _normalize_source(raw_item: dict[str, Any]) -> str:
    source = str(raw_item.get("source") or "").strip().lower()
    if not source:
        source = _infer_source(raw_item)
    return source if source in ALLOWED_SOURCES else "generic"


def _infer_source(raw_item: dict[str, Any]) -> str:
    text = " ".join(str(raw_item.get(key) or "") for key in ("tool", "scanner", "provider", "check_id", "controlName"))
    lowered = text.lower()
    if "prowler" in lowered or raw_item.get("check_id"):
        return "prowler"
    if "scuba" in lowered or raw_item.get("controlName"):
        return "scubagear"
    if "wazuh" in lowered:
        return "wazuh"
    if "velociraptor" in lowered:
        return "velociraptor"
    if "defectdojo" in lowered:
        return "defectdojo"
    return "generic"


def _normalize_evidence_type(raw_item: dict[str, Any]) -> str:
    evidence_type = str(raw_item.get("type") or raw_item.get("evidence_type") or "").strip().lower()
    evidence_type = TYPE_ALIASES.get(evidence_type, evidence_type)
    if evidence_type in ALLOWED_EVIDENCE_TYPES:
        return evidence_type

    text = _evidence_text(raw_item)
    inferred = _infer_type_from_text(text)
    return inferred if inferred in ALLOWED_EVIDENCE_TYPES else "other"


def _infer_type_from_text(text: str) -> str:
    lowered = text.lower()
    patterns = [
        ("restore_test_report", ["restore test", "restored", "rto", "rpo"]),
        ("backup_config", ["backup", "immutable", "offline copy", "repository"]),
        ("mfa_config", ["mfa", "conditional access", "privileged account", "admin role"]),
        ("logging_config", ["log", "logging", "edr", "endpoint", "siem", "alert", "wazuh"]),
        ("vulnerability_finding", ["vulnerability", "finding", "severity", "cve"]),
        ("asset_inventory", ["asset inventory", "critical system", "owner list"]),
        ("ir_plan", ["incident response", "playbook", "escalation", "contact list"]),
        ("external_exposure", ["external exposure", "internet-facing", "public", "prowler", "vpn", "rdp"]),
    ]
    for evidence_type, keywords in patterns:
        if any(keyword in lowered for keyword in keywords):
            return evidence_type
    return "other"


def _first_text(raw_item: dict[str, Any], *keys: str, default: str) -> str:
    for key in keys:
        value = raw_item.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def _normalize_confidence(value: Any) -> str:
    confidence = str(value or "").strip().lower()
    if confidence in {"high", "medium", "low"}:
        return confidence
    if confidence in {"strong", "verified"}:
        return "high"
    if confidence in {"weak", "partial"}:
        return "low"
    return "medium"


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = str(item or "").strip()
        if text and text not in result:
            result.append(text)
    return result


def _stable_evidence_id(
    index: int,
    source: str,
    evidence_type: str,
    title: str,
    summary: str,
    raw_payload: Any,
) -> str:
    raw_text = json.dumps(raw_payload, sort_keys=True, ensure_ascii=True, default=str)
    digest = hashlib.sha1(f"{source}|{evidence_type}|{title}|{summary}|{raw_text}".encode("utf-8")).hexdigest()
    prefix = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")[:32] or "evidence"
    return f"{prefix}_{index + 1}_{digest[:8]}"


def _evidence_match_detail(
    control: dict[str, Any],
    evidence: dict[str, Any],
) -> dict[str, Any] | None:
    control_id = str(control.get("id") or "")
    related_ids = set(_normalize_string_list(evidence.get("related_control_ids")))
    text = _evidence_text(evidence)
    confidence = str(evidence.get("confidence") or "medium")

    if control_id in related_ids:
        return {
            "item": evidence,
            "match": "direct",
            "strength": _match_strength(confidence, text, required_type=True),
            "reason": "related_control_ids",
        }

    evidence_type = str(evidence.get("type") or "")
    required_types = set(_normalize_string_list(control.get("required_evidence_types")))
    keyword_match = _keyword_match(control_id, text)
    if evidence_type in required_types and (keyword_match or _specific_type_can_match(control_id, evidence_type)):
        return {
            "item": evidence,
            "match": "inferred",
            "strength": _match_strength(confidence, text, required_type=True),
            "reason": f"type:{evidence_type}",
        }
    if keyword_match:
        return {
            "item": evidence,
            "match": "inferred",
            "strength": _match_strength(confidence, text, required_type=False),
            "reason": f"keyword:{keyword_match}",
        }
    return None


def _specific_type_can_match(control_id: str, evidence_type: str) -> bool:
    specific_pairs = {
        ("restore_test_proven", "restore_test_report"),
        ("admin_mfa_proven", "mfa_config"),
        ("incident_response_playbook_exists", "ir_plan"),
        ("external_exposure_reviewed", "external_exposure"),
    }
    return (control_id, evidence_type) in specific_pairs


def _keyword_match(control_id: str, text: str) -> str:
    lowered = text.lower()
    for keyword in CONTROL_KEYWORDS.get(control_id, []):
        if keyword in lowered:
            return keyword
    return ""


def _match_strength(confidence: str, text: str, *, required_type: bool) -> str:
    if confidence == "low" or _has_weak_signal(text):
        return "weak"
    if confidence == "high" and required_type:
        return "strong"
    if confidence == "medium" and required_type:
        return "strong"
    return "weak"


def _has_weak_signal(text: str) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in NEGATIVE_OR_WEAK_TERMS)


def _evidence_text(item: dict[str, Any]) -> str:
    parts = [
        str(item.get("title") or ""),
        str(item.get("summary") or ""),
        str(item.get("type") or ""),
        str(item.get("source") or ""),
    ]
    raw = item.get("raw")
    if isinstance(raw, dict):
        for value in raw.values():
            if isinstance(value, (str, int, float, bool)):
                parts.append(str(value))
    return " ".join(parts)


def _answer_support(
    control: dict[str, Any],
    answer_records: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    mapped_ids = _normalize_string_list(control.get("mapped_existing_question_ids"))
    answers: dict[str, str] = {}
    missing_ids: list[str] = []
    positive = 0
    partial = 0
    negative = 0
    for question_id in mapped_ids:
        record = answer_records.get(question_id)
        if not isinstance(record, dict):
            missing_ids.append(question_id)
            continue
        answer = str(record.get("answer") or "").strip().lower()
        answers[question_id] = answer
        if answer == "yes":
            positive += 1
        elif answer == "partial":
            partial += 1
        elif answer in {"no", "unsure"}:
            negative += 1

    signal = "none"
    if positive and not partial and not negative:
        signal = "positive"
    elif positive or partial:
        signal = "partial"
    elif negative:
        signal = "negative"

    return {
        "signal": signal,
        "mapped_question_ids": mapped_ids,
        "answers": answers,
        "missing_question_ids": missing_ids,
    }


def _public_evidence(match: dict[str, Any]) -> dict[str, Any]:
    item = match["item"]
    return {
        "id": item.get("id"),
        "source": item.get("source"),
        "type": item.get("type"),
        "title": item.get("title"),
        "summary": item.get("summary"),
        "confidence": item.get("confidence"),
        "match": match.get("match"),
        "match_reason": match.get("reason"),
        "match_strength": match.get("strength"),
    }


def _max_evidence_confidence(matches: list[dict[str, Any]]) -> int:
    values = []
    for match in matches:
        confidence = str(match["item"].get("confidence") or "medium")
        strength = str(match.get("strength") or "weak")
        if confidence == "high" and strength == "strong":
            values.append(100)
        elif confidence == "medium" and strength == "strong":
            values.append(80)
        elif confidence == "high":
            values.append(65)
        elif confidence == "medium":
            values.append(55)
        else:
            values.append(40)
    return max(values or [0])


def _gap_severity(control_id: str, status: str) -> str:
    if control_id in CRITICAL_CONTROL_IDS:
        return "Critical" if status in {"not_proven", "unknown"} else "High"
    if control_id in HIGH_CONTROL_IDS:
        return "High" if status in {"not_proven", "unknown"} else "Medium"
    return "Medium"


def _gap_description(result: dict[str, Any]) -> str:
    title = str(result.get("title") or result.get("control_id") or "control")
    status = str(result.get("status") or "unknown").replace("_", " ")
    missing = ", ".join(result.get("missing_evidence_types") or result.get("required_evidence_types") or [])
    if missing:
        return f"{title} is {status}; missing evidence types: {missing}."
    return f"{title} is {status}; imported proof is missing or weak."


def _affected_business_processes(control_id: str) -> list[str]:
    mapping = {
        "critical_assets_identified": ["Business continuity", "Recovery planning"],
        "backup_exists_for_critical_systems": ["Data recovery", "Core operations"],
        "backup_isolation_or_immutability_proven": ["Backup resilience", "Ransomware recovery"],
        "restore_test_proven": ["Service restoration", "Client operations"],
        "admin_mfa_proven": ["Identity security", "Administrative access"],
        "backup_admin_separation_proven": ["Privileged access", "Backup operations"],
        "endpoint_detection_or_logging_present": ["Incident detection", "Recovery scoping"],
        "incident_response_playbook_exists": ["Incident response", "Executive communication"],
        "recovery_priority_list_exists": ["Business continuity", "Restore sequencing"],
        "external_exposure_reviewed": ["Attack surface management", "Remote access"],
    }
    return mapping.get(control_id, ["Ransomware recovery"])


def _client_summary(
    score: int,
    confidence: int,
    proven: list[dict[str, Any]],
    partial: list[dict[str, Any]],
    unproven: list[dict[str, Any]],
    gaps: list[dict[str, Any]],
) -> str:
    return (
        f"Recovery proof score is {score}/100 with evidence confidence {confidence}/100. "
        f"{len(proven)} controls are proven, {len(partial)} are partially proven, "
        f"and {len(unproven)} are not proven or unknown. "
        f"{len(gaps)} proof gaps should be remediated before this can be shown as strong recovery evidence."
    )


def _technical_summary(
    control_results: list[dict[str, Any]],
    evidence_items: list[dict[str, Any]],
    proof_gaps: list[dict[str, Any]],
) -> str:
    statuses: dict[str, int] = {}
    for result in control_results:
        status = str(result.get("status") or "unknown")
        statuses[status] = statuses.get(status, 0) + 1
    status_text = ", ".join(f"{status}: {count}" for status, count in sorted(statuses.items()))
    return (
        "Recovery Proof Engine v1 used deterministic control, evidence type, keyword, and questionnaire mappings. "
        f"It evaluated {len(control_results)} controls against {len(evidence_items)} imported evidence items "
        f"({status_text}) and generated {len(proof_gaps)} proof gaps. "
        "No LLM calls, external API calls, target scans, network probes, or third-party tools were executed."
    )
