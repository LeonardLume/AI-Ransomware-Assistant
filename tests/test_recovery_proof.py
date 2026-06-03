from __future__ import annotations

import os

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.recovery_adapters import import_tool_output
from backend.recovery_exports import export_remediation_tickets
from backend.recovery_imports import parse_evidence_text
from backend.recovery_proof import (
    detect_proof_gaps,
    evaluate_recovery_control,
    generate_remediation_tickets,
    load_recovery_controls,
    normalize_evidence_items,
    run_recovery_proof,
)
from backend.security import RATE_LIMITER

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_runtime_env(monkeypatch: pytest.MonkeyPatch):
    for key in [
        "API_AUTH_TOKEN",
        "RATE_LIMIT_CHAT_PER_MINUTE",
        "RATE_LIMIT_REPORT_PER_MINUTE",
        "RATE_LIMIT_DEMO_PER_MINUTE",
        "TRUST_PROXY_HEADERS",
    ]:
        monkeypatch.delenv(key, raising=False)
    RATE_LIMITER.clear()
    yield
    RATE_LIMITER.clear()


def _control(control_id: str) -> dict:
    controls = load_recovery_controls()
    return next(control for control in controls if control["id"] == control_id)


def test_load_recovery_controls() -> None:
    controls = load_recovery_controls()

    assert len(controls) == 10
    assert {control["id"] for control in controls} >= {
        "critical_assets_identified",
        "restore_test_proven",
        "admin_mfa_proven",
    }
    assert all(control["remediation_template"]["title"] for control in controls)


def test_normalize_evidence_items() -> None:
    items = normalize_evidence_items(
        [
            {
                "source": "Prowler",
                "type": "backup",
                "title": "Immutable backup repository",
                "summary": "Repository immutability is enabled.",
                "confidence": "verified",
            }
        ]
    )

    assert items[0]["source"] == "prowler"
    assert items[0]["type"] == "backup_config"
    assert items[0]["confidence"] == "high"
    assert items[0]["id"]


def test_evidence_linked_directly_by_related_control_ids() -> None:
    result = evaluate_recovery_control(
        _control("restore_test_proven"),
        {},
        [
            {
                "source": "manual",
                "type": "restore_test_report",
                "title": "Restore test report",
                "summary": "A critical file share was restored and validated.",
                "confidence": "high",
                "related_control_ids": ["restore_test_proven"],
            }
        ],
    )

    assert result["status"] == "proven"
    assert result["supporting_evidence"][0]["match"] == "direct"


def test_evidence_inferred_by_type_and_keywords() -> None:
    result = evaluate_recovery_control(
        _control("backup_isolation_or_immutability_proven"),
        {},
        [
            {
                "source": "manual",
                "type": "backup_config",
                "title": "Immutable backup repository setting",
                "summary": "The repository has immutability enabled for 30 days.",
                "confidence": "high",
            }
        ],
    )

    assert result["status"] == "proven"
    assert result["supporting_evidence"][0]["match"] == "inferred"


def test_questionnaire_yes_without_evidence_is_partially_proven() -> None:
    result = evaluate_recovery_control(
        _control("restore_test_proven"),
        {"restore_tested": {"answer": "yes", "details": ""}},
        [],
    )

    assert result["status"] == "partially_proven"
    assert result["status"] != "proven"
    assert result["answer_support"]["signal"] == "positive"


def test_missing_evidence_creates_proof_gaps() -> None:
    report = run_recovery_proof({}, [])

    assert report["recovery_proof_score"] == 0
    assert report["evidence_confidence"] == 0
    assert len(report["proof_gaps"]) == 10
    assert any(gap["control_id"] == "restore_test_proven" for gap in report["proof_gaps"])


def test_remediation_tickets_generated_from_proof_gaps() -> None:
    results = [
        evaluate_recovery_control(
            _control("restore_test_proven"),
            {},
            [],
        )
    ]
    gaps = detect_proof_gaps(results)
    tickets = generate_remediation_tickets(gaps, results)

    assert tickets
    assert tickets[0]["affected_controls"] == ["restore_test_proven"]
    assert "Restore test report" in tickets[0]["evidence_needed"]


def test_recovery_proof_run_endpoint_returns_safe_defensive_only() -> None:
    session = client.post("/session", json={"organization_name": "Recovery Test"})
    assert session.status_code == 200
    session_id = session.json()["session_id"]

    response = client.post(
        "/recovery-proof/run",
        json={
            "session_id": session_id,
            "items": [
                {
                    "source": "manual",
                    "type": "restore_test_report",
                    "title": "Restore test report",
                    "summary": "A shared file restore was completed and validated.",
                    "confidence": "high",
                    "related_control_ids": ["restore_test_proven"],
                }
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["safe_defensive_only"] is True
    assert any(control["control_id"] == "restore_test_proven" for control in data["proven_controls"])


def test_parse_evidence_text_supports_csv_and_yaml() -> None:
    csv_rows = parse_evidence_text(
        "check_id,check_title,status,status_extended\n"
        "prowler-1,Cloud audit logging enabled,PASS,Audit logs are enabled\n",
        source="prowler",
        evidence_format="csv",
    )
    yaml_rows = parse_evidence_text(
        """
items:
  - controlName: Admin MFA baseline
    summary: Conditional access requires MFA for admin roles.
    type: mfa_config
""",
        source="scubagear",
        evidence_format="yaml",
    )

    assert csv_rows[0]["source"] == "prowler"
    assert csv_rows[0]["check_title"] == "Cloud audit logging enabled"
    assert yaml_rows[0]["source"] == "scubagear"
    assert yaml_rows[0]["type"] == "mfa_config"


def test_import_text_endpoint_accepts_yaml_without_running_tools() -> None:
    session = client.post("/session", json={"organization_name": "YAML Import"})
    assert session.status_code == 200
    session_id = session.json()["session_id"]

    response = client.post(
        "/recovery-proof/import-text",
        json={
            "session_id": session_id,
            "source": "scubagear",
            "format": "yaml",
            "text": """
items:
  - title: M365 admin MFA evidence
    summary: Conditional access requires MFA for privileged administrator roles.
    type: mfa_config
    confidence: high
    related_control_ids:
      - admin_mfa_proven
""",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert data["items"][0]["source"] == "scubagear"

    proof = client.post("/recovery-proof/run", json={"session_id": session_id})
    assert proof.status_code == 200
    assert proof.json()["safe_defensive_only"] is True
    assert any(control["control_id"] == "admin_mfa_proven" for control in proof.json()["proven_controls"])


def test_prowler_csv_adapter_maps_logging_control() -> None:
    items = import_tool_output(
        "check_id,check_title,status,status_extended\n"
        "aws_cloudtrail_enabled,CloudTrail logging enabled,PASS,CloudTrail audit logging is enabled\n",
        source="prowler",
        evidence_format="csv",
    )

    assert items[0]["source"] == "prowler"
    assert items[0]["type"] == "logging_config"
    assert "endpoint_detection_or_logging_present" in items[0]["related_control_ids"]


def test_sigma_yaml_adapter_maps_detection_coverage() -> None:
    items = import_tool_output(
        """
title: Suspicious Mass File Rename
logsource:
  product: windows
detection:
  selection:
    EventID: 4663
tags:
  - attack.impact
""",
        source="sigma",
        evidence_format="yaml",
    )

    assert items[0]["source"] == "sigma"
    assert items[0]["type"] == "logging_config"
    assert "endpoint_detection_or_logging_present" in items[0]["related_control_ids"]


def test_remediation_tickets_export_markdown_and_jira_json() -> None:
    report = run_recovery_proof({}, [])
    markdown = export_remediation_tickets(report["remediation_tickets"], export_format="markdown")
    jira = export_remediation_tickets(report["remediation_tickets"], export_format="jira_json")

    assert markdown["content_type"] == "text/markdown"
    assert "Recovery Proof Remediation Tickets" in markdown["content"]
    assert jira["content_type"] == "application/json"
    assert "ransomware-recovery-proof" in jira["content"]


def test_ticket_export_endpoint_returns_markdown() -> None:
    session = client.post("/session", json={"organization_name": "Ticket Export"})
    assert session.status_code == 200
    session_id = session.json()["session_id"]

    response = client.get(f"/recovery-proof/tickets/{session_id}/export?format=markdown")

    assert response.status_code == 200
    data = response.json()
    assert data["safe_defensive_only"] is True
    assert data["format"] == "markdown"
    assert "Recovery Proof Remediation Tickets" in data["content"]
