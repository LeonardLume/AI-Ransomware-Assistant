from __future__ import annotations

import hashlib
import json
from typing import Any

from backend.recovery_imports import parse_evidence_text

SUPPORTED_EVIDENCE_ADAPTERS = [
    {
        "id": "generic",
        "name": "Generic JSON/CSV/YAML",
        "formats": ["json", "csv", "yaml"],
        "execution_enabled": False,
    },
    {
        "id": "prowler",
        "name": "Prowler import",
        "formats": ["json", "csv"],
        "execution_enabled": False,
    },
    {
        "id": "scubagear",
        "name": "CISA ScubaGear import",
        "formats": ["json", "csv", "yaml"],
        "execution_enabled": False,
    },
    {
        "id": "wazuh",
        "name": "Wazuh summary import",
        "formats": ["json", "csv", "yaml"],
        "execution_enabled": False,
    },
    {
        "id": "defectdojo",
        "name": "DefectDojo findings import",
        "formats": ["json", "csv"],
        "execution_enabled": False,
    },
    {
        "id": "sigma",
        "name": "Sigma rule metadata import",
        "formats": ["yaml", "json"],
        "execution_enabled": False,
    },
    {
        "id": "complianceascode",
        "name": "ComplianceAsCode control import",
        "formats": ["yaml", "json"],
        "execution_enabled": False,
    },
]

SOURCE_ALIASES = {
    "scuba": "scubagear",
    "cisa_scubagear": "scubagear",
    "cisa-scubagear": "scubagear",
    "defect_dojo": "defectdojo",
    "defect-dojo": "defectdojo",
    "compliance-as-code": "complianceascode",
    "compliance_as_code": "complianceascode",
    "cac": "complianceascode",
}


def import_tool_output(
    text: str,
    *,
    source: str = "generic",
    evidence_format: str | None = None,
) -> list[dict[str, Any]]:
    adapter_source = normalize_adapter_source(source)
    raw_rows = parse_evidence_text(
        text,
        source=adapter_source,
        evidence_format=evidence_format,
    )
    return adapt_evidence_items(raw_rows, source=adapter_source)


def adapt_evidence_items(raw_items: list[dict[str, Any]], *, source: str) -> list[dict[str, Any]]:
    adapter_source = normalize_adapter_source(source)
    adapted: list[dict[str, Any]] = []
    for index, row in enumerate(raw_items or []):
        if not isinstance(row, dict):
            continue
        adapted.append(_adapt_row(row, source=adapter_source, index=index))
    return adapted


def normalize_adapter_source(source: str | None) -> str:
    clean = str(source or "generic").strip().lower()
    return SOURCE_ALIASES.get(clean, clean) or "generic"


def _adapt_row(row: dict[str, Any], *, source: str, index: int) -> dict[str, Any]:
    text = _row_text(row)
    evidence_type = _evidence_type_for(source, text)
    related_controls = _related_controls_for(source, text, evidence_type)
    title = _title_for(row, source=source, evidence_type=evidence_type)
    summary = _summary_for(row, source=source)
    confidence = _confidence_for(row, text)
    evidence_id = str(row.get("id") or row.get("finding_id") or row.get("check_id") or "").strip()
    if not evidence_id:
        evidence_id = _stable_id(source, title, summary, index)

    return {
        "id": evidence_id,
        "source": source,
        "type": evidence_type,
        "title": title,
        "summary": summary,
        "raw": row,
        "confidence": confidence,
        "related_control_ids": related_controls,
    }


def _evidence_type_for(source: str, text: str) -> str:
    lowered = text.lower()
    if source == "sigma":
        return "logging_config"
    if "restore" in lowered and ("test" in lowered or "rto" in lowered or "rpo" in lowered):
        return "restore_test_report"
    if any(term in lowered for term in ("backup", "immutable", "immutability", "vault", "repository", "offline copy")):
        return "backup_config"
    if any(term in lowered for term in ("mfa", "multi-factor", "multifactor", "conditional access", "legacy authentication")):
        return "mfa_config"
    if any(term in lowered for term in ("cloudtrail", "audit log", "logging", "log retention", "siem", "edr", "alert", "sigma", "wazuh")):
        return "logging_config"
    if any(term in lowered for term in ("cve", "vulnerability", "vulnerable", "unsupported software", "severity")):
        return "vulnerability_finding"
    if any(term in lowered for term in ("asset inventory", "critical system", "cmdb", "owner list", "business owner")):
        return "asset_inventory"
    if any(term in lowered for term in ("incident response", "playbook", "escalation", "contact list", "tabletop")):
        return "ir_plan"
    if any(term in lowered for term in ("public", "internet-facing", "external", "exposure", "security group", "vpn", "rdp", "bucket")):
        return "external_exposure"
    return "other"


def _related_controls_for(source: str, text: str, evidence_type: str) -> list[str]:
    lowered = text.lower()
    controls: list[str] = []
    by_type = {
        "restore_test_report": ["restore_test_proven"],
        "mfa_config": ["admin_mfa_proven"],
        "logging_config": ["endpoint_detection_or_logging_present"],
        "asset_inventory": ["critical_assets_identified", "recovery_priority_list_exists"],
        "ir_plan": ["incident_response_playbook_exists"],
        "external_exposure": ["external_exposure_reviewed"],
        "vulnerability_finding": ["external_exposure_reviewed"],
    }
    controls.extend(by_type.get(evidence_type, []))

    keyword_controls = [
        ("backup_exists_for_critical_systems", ("backup job", "backup coverage", "protected system", "backup schedule")),
        ("backup_isolation_or_immutability_proven", ("immutable", "immutability", "offline", "isolated backup", "backup vault")),
        ("backup_admin_separation_proven", ("backup admin", "separate admin", "least privilege", "privileged access")),
        ("restore_test_proven", ("restore test", "rto", "rpo", "restored")),
        ("admin_mfa_proven", ("admin mfa", "privileged mfa", "conditional access", "legacy authentication")),
        ("endpoint_detection_or_logging_present", ("cloudtrail", "audit log", "siem", "edr", "alert", "sigma", "wazuh")),
        ("external_exposure_reviewed", ("public", "internet-facing", "security group", "vpn", "rdp", "bucket", "external exposure")),
        ("incident_response_playbook_exists", ("incident response", "ransomware playbook", "escalation", "contact list")),
        ("critical_assets_identified", ("critical asset", "critical system", "business owner", "asset inventory")),
        ("recovery_priority_list_exists", ("restore order", "recovery priority", "dependency map", "rto", "rpo")),
    ]
    for control_id, terms in keyword_controls:
        if any(term in lowered for term in terms):
            controls.append(control_id)

    if source == "prowler" and any(term in lowered for term in ("cloudtrail", "securityhub", "guardduty")):
        controls.append("endpoint_detection_or_logging_present")
    if source == "scubagear" and any(term in lowered for term in ("conditional access", "mfa", "legacy authentication")):
        controls.append("admin_mfa_proven")
    if source == "wazuh":
        controls.append("endpoint_detection_or_logging_present")
    if source == "defectdojo":
        controls.append("external_exposure_reviewed")
    if source == "sigma":
        controls.append("endpoint_detection_or_logging_present")

    return _dedupe(controls)


def _title_for(row: dict[str, Any], *, source: str, evidence_type: str) -> str:
    keys = (
        "title",
        "check_title",
        "controlName",
        "control_name",
        "rule_title",
        "name",
        "finding",
        "id",
        "check_id",
    )
    for key in keys:
        value = row.get(key)
        if value:
            title = str(value).strip()
            if source == "sigma" and not title.lower().startswith("sigma"):
                return f"Sigma detection rule: {title}"
            return title
    return f"{source} {evidence_type} evidence"


def _summary_for(row: dict[str, Any], *, source: str) -> str:
    parts: list[str] = []
    for key in (
        "summary",
        "description",
        "status_extended",
        "rationale",
        "message",
        "mitigation",
        "remediation",
        "fix",
        "result",
        "status",
        "severity",
    ):
        value = row.get(key)
        if value is not None and str(value).strip():
            parts.append(f"{key}: {value}")
    if not parts:
        parts.append(f"Imported {source} evidence row.")
    return " | ".join(parts)


def _confidence_for(row: dict[str, Any], text: str) -> str:
    explicit = str(row.get("confidence") or "").strip().lower()
    if explicit in {"high", "medium", "low"}:
        return explicit
    lowered = text.lower()
    if any(term in lowered for term in ("fail", "failed", "missing", "exception", "excluded", "disabled", "not enabled")):
        return "low"
    if any(term in lowered for term in ("pass", "passed", "enabled", "compliant", "active", "success")):
        return "high"
    return "medium"


def _row_text(row: dict[str, Any]) -> str:
    parts: list[str] = []
    for value in row.values():
        if isinstance(value, (str, int, float, bool)):
            parts.append(str(value))
        elif isinstance(value, list):
            parts.extend(str(item) for item in value if isinstance(item, (str, int, float, bool)))
        elif isinstance(value, dict):
            parts.append(json.dumps(value, ensure_ascii=False, default=str))
    return " ".join(parts)


def _stable_id(source: str, title: str, summary: str, index: int) -> str:
    digest = hashlib.sha1(f"{source}|{title}|{summary}|{index}".encode("utf-8")).hexdigest()
    return f"{source}_{digest[:12]}"


def _dedupe(values: list[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        if value and value not in result:
            result.append(value)
    return result
