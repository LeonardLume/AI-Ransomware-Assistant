---
id: ransomware-recovery
title: Ransomware recovery planning
domain: backups
tags: [ransomware, recovery, restore, continuity]
nist_csf: [RC.RP, RC.CO, ID.IM]
safe_use: defensive_only
---

## When to Use
Use this skill when the assessment needs to connect backup readiness to business recovery. It helps explain how restore order, recovery objectives, communication, and validation affect the ability to resume operations.

## What to Ask
- Which systems must be restored first for the organization to operate?
- Has the restore order been agreed with business owners?
- Are recovery objectives different for email, files, finance, production, or customer systems?
- Who approves the decision to restore a system?
- How will staff be informed if normal communication tools are unavailable?
- How will restored systems be validated before use?

## Risk Logic
Low risk means recovery priorities, owners, restore order, and validation steps are documented and tested. Medium risk means the organization has backups but recovery sequencing is informal. High risk means restoration depends on one person or an untested vendor process. Critical risk means the organization does not know what to restore first or how long recovery would take.

## Recommended Actions
- Create a short restore priority list for critical systems.
- Assign owners for recovery decisions and technical restore work.
- Record expected restore time and acceptable data loss for each critical system.
- Define a simple validation checklist before restored systems return to production.
- Keep recovery instructions available outside the affected environment.

## Evidence Checklist
- Critical system restore priority list.
- RTO/RPO table.
- Recovery owner list.
- Restore validation checklist.
- Alternate communication method for recovery coordination.
- Notes from the most recent recovery test or walkthrough.

## Client Explanation
Recovery is the practical answer to "what do we restore first and how do we know it works?" Without a recovery order, teams can lose valuable time even when backups exist.
