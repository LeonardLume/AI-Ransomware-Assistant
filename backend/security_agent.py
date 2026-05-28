from __future__ import annotations

from typing import Any

from backend.cai_adapter import cai_framework_status


def security_agent_profile() -> dict[str, Any]:
    """Product profile for the bounded security-agent layer.

    The product can use agentic cybersecurity patterns without exposing offensive
    automation. This keeps the assistant useful for real assessments while the
    scoring and safety boundaries remain backend-owned.
    """

    return {
        "name": "Ransomware Readiness Security Agent",
        "positioning": (
            "An authorized defensive security assessor that interviews users, "
            "helps classify controls, explains risk, requests evidence, and prepares "
            "readiness reports."
        ),
        "inspiration": {
            "framework": "CAI-style agentic cybersecurity workflow",
            "package": "cai-framework",
            "use": (
                "Optional defensive bridge for agents, tool boundaries, guardrails, tracing, "
                "and human confirmation."
            ),
            "not_enabled": [
                "exploit execution",
                "credential theft",
                "malware generation",
                "MFA bypass",
                "persistence",
                "evasion",
                "unauthorized scanning",
            ],
        },
        "framework_status": cai_framework_status(),
        "agents": [
            {
                "id": "assessment_guide",
                "name": "Assessment Guide",
                "role": "Runs the interview and keeps the user on the current control.",
            },
            {
                "id": "answer_classifier",
                "name": "Answer Classifier",
                "role": "Maps natural-language answers to yes, partial, no, or unsure only after validation.",
            },
            {
                "id": "evidence_advisor",
                "name": "Evidence Advisor",
                "role": "Suggests evidence that would support each readiness control.",
            },
            {
                "id": "source_researcher",
                "name": "Source Researcher",
                "role": "Grounds explanations in curated defensive sources and future allowlisted web research.",
            },
            {
                "id": "report_writer",
                "name": "Report Writer",
                "role": "Turns backend-owned scores and findings into a concise report and action plan.",
            },
            {
                "id": "safety_reviewer",
                "name": "Safety Reviewer",
                "role": "Blocks unsafe requests and keeps the product defensive-only.",
            },
        ],
        "safe_tools": [
            {
                "id": "control_interview",
                "status": "enabled",
                "description": "Guided ransomware-readiness controls remain the core workflow.",
            },
            {
                "id": "evidence_checklist",
                "status": "enabled",
                "description": "Evidence suggestions for audit readiness and IT handoff.",
            },
            {
                "id": "curated_source_grounding",
                "status": "enabled",
                "description": "Uses curated guidance such as NIST, CISA, NCSC and CIS mappings.",
            },
            {
                "id": "external_exposure_self_check",
                "status": "enabled",
                "description": "Self-reported external exposure checklist; no active scanning.",
            },
            {
                "id": "allowlisted_web_research",
                "status": "planned",
                "description": "Read-only web research against trusted defensive sources with citations.",
            },
            {
                "id": "customer_owned_asset_checks",
                "status": "planned",
                "description": (
                    "Optional checks only for explicitly authorized assets and only with safe read-only methods."
                ),
            },
        ],
        "guardrails": [
            "The official score remains deterministic and backend-owned.",
            "The agent cannot directly mutate score rules or question definitions.",
            "Ambiguous answers require user confirmation before saving.",
            "Prompt injection and offensive requests are blocked before scoring state changes.",
            "Any future external checks must require explicit authorization and use read-only methods.",
        ],
        "value": [
            "Turns a questionnaire into an AI-assisted security assessment.",
            "Helps non-experts answer controls accurately.",
            "Gives IT/MSP teams evidence requests, risks, and next actions.",
            "Keeps a clear audit trail between AI advice and backend scoring.",
        ],
    }
