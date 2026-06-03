from __future__ import annotations

import json
from typing import Any


def export_remediation_tickets(
    tickets: list[dict[str, Any]],
    *,
    export_format: str = "markdown",
) -> dict[str, Any]:
    selected = str(export_format or "markdown").strip().lower()
    if selected in {"markdown", "md"}:
        return {
            "format": "markdown",
            "content_type": "text/markdown",
            "content": tickets_to_markdown(tickets),
        }
    if selected in {"jira", "jira_json", "json"}:
        return {
            "format": "jira_json",
            "content_type": "application/json",
            "content": tickets_to_jira_json(tickets),
        }
    raise ValueError(f"Unsupported ticket export format: {selected}")


def tickets_to_markdown(tickets: list[dict[str, Any]]) -> str:
    if not tickets:
        return "# Recovery Proof Remediation Tickets\n\nNo remediation tickets were generated.\n"

    lines = ["# Recovery Proof Remediation Tickets", ""]
    for index, ticket in enumerate(tickets, start=1):
        lines.extend(
            [
                f"## {index}. {ticket.get('title', 'Remediation ticket')}",
                "",
                f"- Priority: {ticket.get('priority', 'Medium')}",
                f"- Suggested owner: {ticket.get('suggested_owner', 'MSP / IT owner')}",
                f"- Affected controls: {', '.join(ticket.get('affected_controls') or []) or '-'}",
                f"- Affected business processes: {', '.join(ticket.get('affected_business_processes') or []) or '-'}",
                "",
                "### Description",
                str(ticket.get("description") or "-"),
                "",
                "### Evidence needed",
            ]
        )
        evidence_needed = ticket.get("evidence_needed") or []
        if evidence_needed:
            lines.extend(f"- {item}" for item in evidence_needed)
        else:
            lines.append("- -")
        lines.extend(
            [
                "",
                "### Client-friendly explanation",
                str(ticket.get("client_friendly_explanation") or "-"),
                "",
                "### Technical notes",
                str(ticket.get("technical_notes") or "-"),
                "",
            ]
        )
    return "\n".join(lines)


def tickets_to_jira_json(tickets: list[dict[str, Any]]) -> str:
    issues = []
    for ticket in tickets:
        issues.append(
            {
                "fields": {
                    "summary": ticket.get("title") or "Recovery Proof remediation",
                    "issuetype": {"name": "Task"},
                    "priority": {"name": _jira_priority(ticket.get("priority"))},
                    "labels": ["ransomware-recovery-proof", "defensive-evidence"],
                    "description": _jira_description(ticket),
                },
                "recovery_proof": {
                    "ticket_id": ticket.get("id"),
                    "affected_controls": ticket.get("affected_controls") or [],
                    "evidence_needed": ticket.get("evidence_needed") or [],
                    "suggested_owner": ticket.get("suggested_owner"),
                    "affected_business_processes": ticket.get("affected_business_processes") or [],
                },
            }
        )
    return json.dumps({"issues": issues}, ensure_ascii=False, indent=2)


def _jira_priority(priority: Any) -> str:
    normalized = str(priority or "").strip().lower()
    if normalized == "critical":
        return "Highest"
    if normalized == "high":
        return "High"
    if normalized == "low":
        return "Low"
    return "Medium"


def _jira_description(ticket: dict[str, Any]) -> str:
    evidence = ticket.get("evidence_needed") or []
    controls = ticket.get("affected_controls") or []
    processes = ticket.get("affected_business_processes") or []
    return "\n".join(
        [
            str(ticket.get("description") or ""),
            "",
            f"Suggested owner: {ticket.get('suggested_owner', 'MSP / IT owner')}",
            f"Affected controls: {', '.join(controls) or '-'}",
            f"Affected business processes: {', '.join(processes) or '-'}",
            "",
            "Evidence needed:",
            *[f"- {item}" for item in evidence],
            "",
            "Client-friendly explanation:",
            str(ticket.get("client_friendly_explanation") or "-"),
            "",
            "Technical notes:",
            str(ticket.get("technical_notes") or "-"),
        ]
    )
