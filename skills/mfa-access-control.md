---
id: mfa-access-control
title: MFA and access control readiness
domain: mfa_access
tags: [ransomware, mfa, access, identity]
nist_csf: [PR.AA, PR.AC, ID.AM]
safe_use: defensive_only
---

## When to Use
Use this skill when assessing whether identity and access controls reduce ransomware risk. It is most relevant for administrator accounts, remote access, cloud services, email, and account lifecycle questions.

## What to Ask
- Is MFA mandatory for administrator and privileged accounts?
- Is MFA required for VPN, RDP gateways, cloud admin portals, and remote access?
- Is MFA enabled for email and important cloud applications?
- Are old, unused, shared, or departed employee accounts removed regularly?
- Are emergency or break-glass accounts documented and monitored?
- Who reviews identity and access settings?

## Risk Logic
Low risk means MFA protects privileged, remote, email, and cloud access, and accounts are reviewed regularly. Medium risk means MFA exists for some systems but coverage is inconsistent. High risk means remote access or admin accounts are not fully protected. Critical risk means password-only access is common for critical services or old accounts remain active without review.

## Recommended Actions
- Enforce MFA for all administrator accounts.
- Enforce MFA for VPN, RDP gateway, cloud console, email, and other remote access paths.
- Remove or disable unused and departed employee accounts.
- Review shared accounts and replace them with named accounts where practical.
- Document and monitor emergency access accounts.
- Keep a simple access review schedule.

## Evidence Checklist
- MFA policy or configuration screenshot for admin accounts.
- MFA coverage report for email, cloud, and remote access.
- List of privileged users.
- Recent account review record.
- Offboarding checklist showing account removal.
- Emergency access account register.

## Client Explanation
MFA makes a stolen password much less useful. For ransomware readiness, the highest priorities are admin accounts, remote access, email, and cloud systems because these are common paths into the organization.
