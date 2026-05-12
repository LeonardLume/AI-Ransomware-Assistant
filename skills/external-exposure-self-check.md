---
id: external-exposure-self-check
title: External exposure self-check
domain: external_exposure_self_check
tags: [ransomware, external-exposure, self-assessment, dns, remote-access]
nist_csf: [ID.AM, ID.RA, PR.AC, DE.CM]
safe_use: defensive_only
---

## When to Use
Use this skill when the client needs a safe self-reported checklist for public exposure awareness. It must not run OSINT, enumerate domains, scan IPs, query breach services, or automate reconnaissance.

## What to Ask
- Does the organization know its public domains and subdomains?
- Has internet-facing remote access such as VPN or RDP gateway been reviewed?
- Are SPF, DKIM, and DMARC settings known?
- Have public code repositories been reviewed for secrets and sensitive information?
- Have public cloud storage locations or buckets been reviewed?
- Are breach exposure checks done only through approved and legal channels?

## Risk Logic
Low risk means the organization has a maintained self-reported view of public exposure and owners. Medium risk means some areas are known but not consistently reviewed. High risk means remote access, public repositories, DNS email security records, or cloud sharing may be unmanaged. This skill is advisory and does not calculate numeric score.

## Recommended Actions
- Maintain a simple list of public domains, subdomains, and service owners.
- Review public remote access services and confirm MFA and patch ownership.
- Confirm SPF, DKIM, and DMARC through DNS or email admin tools.
- Manually review public repositories for secrets and sensitive data.
- Review public cloud storage and sharing settings in the cloud console.
- Use only approved legal channels for breach exposure checks.

## Evidence Checklist
- Public domain and service owner list.
- Remote access exposure review note.
- SPF, DKIM, and DMARC configuration evidence.
- Public repository review record.
- Cloud storage exposure review record.
- Approved breach exposure check procedure.

## Client Explanation
This self-check is about knowing what the organization has intentionally exposed to the internet. It is not a scan and not OSINT automation; it is a safe checklist for owners, evidence, and follow-up decisions.
