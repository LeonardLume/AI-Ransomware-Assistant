from __future__ import annotations

from typing import Any


def build_findings(
    scores: dict[str, Any],
    answer_records: dict[str, dict[str, Any]],
) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []

    if _answer_is(answer_records, "restore_tested", {"no", "unsure"}):
        findings.append(
            _finding(
                finding_id="finding_restore_capability_unproven",
                title="Restore capability is unproven",
                severity="High",
                domain="backups",
                evidence=_evidence(answer_records, "restore_tested"),
                business_impact="Backups may not restore critical data or systems fast enough during a ransomware incident.",
                recommended_fix="Run a documented restore test for at least one critical system or dataset and record the result.",
                owner="IT",
                deadline="14 days",
                verification="Restore test record with date, scope, result, issues found, and RTO/RPO notes.",
            )
        )

    if _answer_is(answer_records, "backup_isolated", {"no", "unsure"}):
        findings.append(
            _finding(
                finding_id="finding_backup_isolation_missing",
                title="Backups may be reachable by ransomware",
                severity="Critical",
                domain="backups",
                evidence=_evidence(answer_records, "backup_isolated"),
                business_impact="If ransomware can delete or encrypt backups, recovery options may disappear.",
                recommended_fix="Keep at least one backup copy offline, immutable, or protected with separate credentials.",
                owner="IT",
                deadline="7 days",
                verification="Backup architecture note or screenshot showing offline, immutable, or separately permissioned backup storage.",
            )
        )

    if _answer_is(answer_records, "mfa_admin", {"no", "partial"}):
        findings.append(
            _finding(
                finding_id="finding_admin_mfa_incomplete",
                title="Admin accounts are not fully protected by MFA",
                severity="High",
                domain="mfa_access",
                evidence=_evidence(answer_records, "mfa_admin"),
                business_impact="A stolen administrator password could give broad access to systems and backups.",
                recommended_fix="Require MFA for every privileged and administrator account, including MSP and break-glass access.",
                owner="IT",
                deadline="14 days",
                verification="MFA coverage report or identity configuration screenshot for all privileged accounts.",
            )
        )

    if _answer_is(answer_records, "mfa_remote_access", {"no", "partial"}):
        findings.append(
            _finding(
                finding_id="finding_remote_access_mfa_incomplete",
                title="Remote access is not fully protected by MFA",
                severity="High",
                domain="mfa_access",
                evidence=_evidence(answer_records, "mfa_remote_access"),
                business_impact="Password-only VPN, RDP gateway, or cloud access increases the chance of ransomware entry.",
                recommended_fix="Require MFA for VPN, RDP gateway, remote administration, and cloud console access.",
                owner="IT",
                deadline="14 days",
                verification="Remote access policy or configuration evidence showing MFA enforcement.",
            )
        )

    if _answer_is(answer_records, "ir_plan_exists", {"no", "unsure"}):
        findings.append(
            _finding(
                finding_id="finding_ir_process_not_documented",
                title="Ransomware response process is not documented",
                severity="High",
                domain="incident_response",
                evidence=_evidence(answer_records, "ir_plan_exists"),
                business_impact="During an incident, delays and unclear ownership can increase downtime, cost, and legal exposure.",
                recommended_fix="Create a short ransomware response plan with roles, contacts, escalation, containment, and communication steps.",
                owner="Management",
                deadline="14 days",
                verification="Approved response plan with current contact list and decision owners.",
            )
        )

    detection_detail = scores.get("domain_details", {}).get("detection_monitoring", {})
    detection_score = int(detection_detail.get("score", 100))
    if detection_score < 60 or detection_detail.get("critical_negative_answers"):
        findings.append(
            _finding(
                finding_id="finding_detection_monitoring_weak",
                title="Suspicious activity may not be detected in time",
                severity="High" if detection_score < 40 else "Medium",
                domain="detection_monitoring",
                evidence=_detection_evidence(answer_records, detection_detail),
                business_impact="Ransomware activity may spread before anyone sees endpoint, login, file-change, or vulnerability warning signs.",
                recommended_fix="Define which logs and endpoint alerts are monitored, who owns triage, and how suspicious activity is escalated.",
                owner="IT",
                deadline="30 days",
                verification="Monitoring responsibility matrix, sample alert review record, and list of collected critical logs.",
            )
        )

    if _answer_is(answer_records, "least_privilege", {"no", "partial"}) or _answer_is(
        answer_records, "separate_admin_accounts", {"no", "partial"}
    ):
        findings.append(
            _finding(
                finding_id="finding_admin_rights_too_broad",
                title="Privileged access is broader than needed",
                severity="Medium",
                domain="admin_rights",
                evidence=_combined_evidence(answer_records, ["least_privilege", "separate_admin_accounts"]),
                business_impact="Broad admin rights can let ransomware spread faster and disable defenses.",
                recommended_fix="Reduce standing administrator rights and use separate named admin accounts for privileged work.",
                owner="IT",
                deadline="30 days",
                verification="Updated privileged user list and recent access review record.",
            )
        )

    return findings[:8]


def _finding(
    finding_id: str,
    title: str,
    severity: str,
    domain: str,
    evidence: str,
    business_impact: str,
    recommended_fix: str,
    owner: str,
    deadline: str,
    verification: str,
) -> dict[str, str]:
    return {
        "id": finding_id,
        "title": title,
        "severity": severity,
        "domain": domain,
        "evidence": evidence,
        "business_impact": business_impact,
        "recommended_fix": recommended_fix,
        "owner": owner,
        "deadline": deadline,
        "verification": verification,
    }


def _answer_is(
    answer_records: dict[str, dict[str, Any]],
    question_id: str,
    values: set[str],
) -> bool:
    return str((answer_records.get(question_id) or {}).get("answer", "")).lower() in values


def _evidence(answer_records: dict[str, dict[str, Any]], question_id: str) -> str:
    record = answer_records.get(question_id) or {}
    answer = record.get("answer", "missing")
    details = str(record.get("details") or "").strip()
    return f"{question_id} = {answer}" + (f"; details: {details}" if details else "")


def _combined_evidence(answer_records: dict[str, dict[str, Any]], question_ids: list[str]) -> str:
    return " | ".join(_evidence(answer_records, qid) for qid in question_ids if qid in answer_records)


def _detection_evidence(
    answer_records: dict[str, dict[str, Any]],
    detection_detail: dict[str, Any],
) -> str:
    negatives = detection_detail.get("critical_negative_answers") or []
    if negatives:
        return _combined_evidence(answer_records, list(negatives))
    return f"detection_monitoring score = {detection_detail.get('score', 'unknown')}/100"
