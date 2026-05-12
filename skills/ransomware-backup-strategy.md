---
id: ransomware-backup-strategy
title: Ransomware backup and restore readiness
domain: backups
tags: [ransomware, backups, restore, recovery]
nist_csf: [PR.DS, RC.RP, RC.CO]
safe_use: defensive_only
---

## When to Use
Use this skill when assessing whether critical business data and systems can be restored after a ransomware incident. It is most relevant when the user is discussing backup coverage, backup frequency, restore tests, offline or immutable copies, or RTO/RPO expectations.

## What to Ask
- Which systems and data are business-critical?
- Are backups automatic and monitored?
- How often are backups created for each critical system?
- Has a restore test been completed in the last 6 months?
- Is at least one backup copy offline, immutable, or protected by separate credentials?
- Who receives alerts when backup jobs fail?
- Are RTO and RPO expectations documented for critical systems?

## Risk Logic
Low risk means critical data is backed up automatically, restore tests are recent, and at least one backup copy is protected from ransomware. Medium risk means backups exist but restore testing, monitoring, or isolation is incomplete. High risk means important systems are missing from backup coverage or restore capability is unproven. Critical risk means backups are absent, unknown, or likely reachable by the same compromised accounts used for production systems.

## Recommended Actions
- Test restore for one critical system and record the result.
- Confirm which critical systems are covered by backups.
- Configure alerts for failed backup jobs.
- Keep at least one backup copy offline, immutable, or protected with separate credentials.
- Document RTO and RPO expectations for priority systems.
- Review backup access rights so normal user or admin compromise does not automatically expose all backups.

## Evidence Checklist
- Backup policy or backup job schedule.
- List of systems and data included in backups.
- Last successful backup job results.
- Restore test date and result.
- Restored system or dataset name.
- RTO/RPO result from the restore test.
- Proof of offline, immutable, or separately protected backup storage.
- Named owner for backup monitoring.

## Client Explanation
Backups only help in a ransomware event if they can actually be restored. A good proof point is the date and result of the last restore test, not only a statement that backups exist.
