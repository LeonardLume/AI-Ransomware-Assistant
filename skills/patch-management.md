---
id: patch-management
title: Patch and vulnerability management readiness
domain: patching
tags: [ransomware, patching, vulnerabilities, asset-inventory]
nist_csf: [ID.AM, PR.PS, DE.CM]
safe_use: defensive_only
---

## When to Use
Use this skill when assessing whether the organization manages security updates, internet-facing services, unsupported systems, and known vulnerabilities in a practical and repeatable way.

## What to Ask
- Who is responsible for security updates?
- Are critical patches normally installed within 30 days or faster?
- Which services are reachable from the internet?
- Are VPN, firewall, email, and remote access systems tracked separately?
- Are unsupported or end-of-life systems known?
- How are patch failures or exceptions documented?

## Risk Logic
Low risk means the organization knows its internet-facing assets, applies critical patches quickly, and tracks exceptions. Medium risk means patching happens but timing or evidence is inconsistent. High risk means internet-facing systems are not tracked or critical patches are delayed. Critical risk means unsupported or exposed systems exist with no owner or remediation plan.

## Recommended Actions
- Create a simple inventory of internet-facing services.
- Assign an owner for patching and patch verification.
- Set a target for critical security updates, such as 14 to 30 days depending on exposure.
- Track failed patches and accepted exceptions.
- Identify unsupported systems and document replacement, isolation, or risk acceptance.
- Review MSP patch reports if patching is outsourced.

## Evidence Checklist
- Patch management process or responsibility matrix.
- Recent patch report.
- List of internet-facing services.
- Critical patch timing evidence.
- Unsupported systems list.
- Exception or risk acceptance log.
- MSP patching report, if applicable.

## Client Explanation
Ransomware often enters through known weaknesses that already have fixes. Patch management is the routine that makes sure critical fixes are applied and that exposed systems do not get forgotten.
