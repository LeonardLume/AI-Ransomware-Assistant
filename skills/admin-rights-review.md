---
id: admin-rights-review
title: Administrator rights and privilege review
domain: admin_rights
tags: [ransomware, admin-rights, least-privilege, access-review]
nist_csf: [PR.AA, PR.AC, GV.RR]
safe_use: defensive_only
---

## When to Use
Use this skill when assessing whether privileged access is limited, reviewed, and separated from everyday work. It is relevant for local admin rights, domain or cloud admins, MSP access, and third-party access.

## What to Ask
- Who currently has administrator rights?
- Are admin accounts separate from everyday user accounts?
- Are local admin rights restricted on workstations and servers?
- How often are privileged rights reviewed?
- Are third-party or MSP administrator accounts limited and monitored?
- Are admin rights removed promptly when roles change?

## Risk Logic
Low risk means admin rights are limited, separate accounts are used, and privileged access is reviewed regularly. Medium risk means some restrictions exist but reviews or account separation are incomplete. High risk means many users have broad admin rights or third-party access is always-on. Critical risk means there is no reliable list of admin accounts or no process to remove unnecessary rights.

## Recommended Actions
- Export and review the privileged account list.
- Remove administrator rights that are not needed for the role.
- Use separate admin accounts for administration tasks.
- Review third-party access and remove standing access where possible.
- Schedule recurring privilege reviews.
- Document who approves new admin rights.

## Evidence Checklist
- Current privileged user list.
- Record of last admin rights review.
- Approval process for new administrator access.
- Evidence of separate admin accounts.
- Third-party access list.
- Offboarding or role-change access removal record.

## Client Explanation
Admin rights determine how far an incident can spread. Fewer privileged accounts and regular reviews reduce the chance that one compromised account can affect every system.
