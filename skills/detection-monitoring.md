---
id: detection-monitoring
title: Detection and monitoring readiness
domain: detection_monitoring
tags: [ransomware, detection, monitoring, logs, endpoint-alerts]
nist_csf: [DE.CM, DE.AE, ID.RA, RS.MA]
safe_use: defensive_only
---

## When to Use
Use this skill when assessing whether the organization can notice early ransomware warning signs through logs, endpoint alerts, suspicious login activity, file-change signals, and vulnerability inventory.

## What to Ask
- Which critical system logs are collected or retained?
- Who reviews antivirus, endpoint security, or EDR alerts?
- Are failed logins and unusual access attempts checked?
- Can mass file changes or suspicious file activity be noticed?
- Is there a list or report of vulnerable or outdated software?
- Who owns alert triage and escalation?

## Risk Logic
Low risk means critical logs and endpoint alerts are available, reviewed by an owner, and tied to response steps. Medium risk means some alerts or logs exist but ownership or coverage is incomplete. High risk means suspicious access or endpoint activity may be missed. Critical risk means there is no practical way to notice early ransomware activity before damage spreads.

## Recommended Actions
- Identify the critical logs that must be retained for ransomware investigation.
- Assign an owner for endpoint, antivirus, or EDR alert review.
- Review failed login monitoring for admin, VPN, email, and cloud accounts.
- Define how mass file changes or suspicious encryption-like behavior would be noticed.
- Maintain a simple vulnerable or outdated software inventory.
- Document alert escalation into the incident response process.

## Evidence Checklist
- List of critical log sources and retention period.
- Endpoint or antivirus alert review process.
- Sample alert ticket or triage record.
- Failed login monitoring report or dashboard screenshot.
- File integrity or mass-change alert configuration note.
- Vulnerability or outdated software inventory.

## Client Explanation
Detection and monitoring are about noticing trouble early enough to respond. For ransomware readiness, the goal is not a complex SOC on day one; it is knowing which warnings matter, who sees them, and what happens next.
