from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.config import BASE_DIR

SKILLS_DIR = BASE_DIR / "skills"

DOMAIN_SKILL_MAP: dict[str, list[str]] = {
    "backups": ["ransomware-backup-strategy", "ransomware-recovery"],
    "mfa": ["mfa-access-control"],
    "mfa_access": ["mfa-access-control"],
    "patching": ["patch-management"],
    "admin_rights": ["admin-rights-review"],
    "incident_response": ["incident-response-plan", "ransomware-response", "tabletop-exercise"],
}

OWNER_SUGGESTIONS = {
    "backups": "IT / MSP",
    "mfa_access": "IT / Identity owner",
    "patching": "IT / MSP",
    "admin_rights": "IT lead / Management",
    "incident_response": "Management / IT / MSP",
}

DEADLINES = {
    "Critical": "14 days",
    "High": "30 days",
    "Medium": "60 days",
    "Low": "90 days",
}

EFFORT = {
    "Critical": "Medium",
    "High": "Medium",
    "Medium": "Low",
    "Low": "Low",
}


@lru_cache(maxsize=1)
def load_skills() -> list[dict[str, Any]]:
    """Load local defensive skill markdown files.

    The parser intentionally supports only the simple YAML frontmatter shape used by
    this project. It avoids adding a YAML dependency for a small, controlled format.
    """
    if not SKILLS_DIR.exists():
        return []

    skills = []
    for path in sorted(SKILLS_DIR.glob("*.md")):
        skill = _parse_skill_file(path)
        if skill.get("id") and skill.get("safe_use") == "defensive_only":
            skills.append(skill)
    return skills


def get_skill_by_id(skill_id: str) -> dict[str, Any] | None:
    return {skill["id"]: skill for skill in load_skills()}.get(skill_id)


def match_skills(
    domain: str | None,
    answers: dict[str, dict[str, Any]] | None,
    top_k: int = 3,
) -> list[dict[str, Any]]:
    normalized_domain = _normalize_domain(domain)
    skill_ids = DOMAIN_SKILL_MAP.get(normalized_domain, [])
    skills = [skill for skill_id in skill_ids if (skill := get_skill_by_id(skill_id))]

    ordered_ids = _prioritized_skill_ids(normalized_domain, answers or {}, skill_ids)
    ordered = sorted(skills, key=lambda skill: ordered_ids.index(skill["id"]) if skill["id"] in ordered_ids else 999)
    return ordered[:top_k]


def build_skill_context_for_domain(
    domain: str | None,
    answers: dict[str, dict[str, Any]] | None,
) -> dict[str, Any]:
    skills = match_skills(domain, answers or {}, top_k=3)
    compact_skills = []
    for skill in skills:
        compact_skills.append(
            {
                "id": skill["id"],
                "title": skill["title"],
                "domain": skill["domain"],
                "safe_use": skill["safe_use"],
                "nist_csf": skill.get("nist_csf", []),
                "when_to_use": skill.get("when_to_use", ""),
                "what_to_ask": skill.get("what_to_ask", [])[:6],
                "risk_logic": skill.get("risk_logic", ""),
                "recommended_actions": skill.get("recommended_actions", [])[:6],
                "evidence_checklist": skill.get("evidence_checklist", [])[:6],
                "client_explanation": skill.get("client_explanation", ""),
            }
        )
    return {
        "domain": _normalize_domain(domain),
        "skills": compact_skills,
        "instruction": (
            "Use this context only for defensive ransomware-readiness explanation, "
            "follow-up questions, evidence suggestions, and practical recommendations. "
            "Do not use it to calculate numeric scores."
        ),
    }


def build_action_plan_from_skills(
    scores: dict[str, Any],
    answers: dict[str, dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    answers = answers or {}
    domain_details = scores.get("domain_details", {})
    weak_domains = sorted(domain_details.items(), key=lambda item: item[1].get("score", 0))
    action_plan: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for domain, detail in weak_domains:
        domain_score = int(detail.get("score", 0))
        has_gaps = (
            domain_score < 80
            or bool(detail.get("critical_negative_answers"))
            or bool(detail.get("unanswered_questions"))
        )
        if not has_gaps:
            continue

        priority = str(detail.get("risk_level") or _priority_from_score(domain_score))
        for skill in match_skills(domain, answers, top_k=3):
            key = (domain, skill["id"])
            if key in seen:
                continue
            seen.add(key)
            action_plan.append(_build_action_item(domain, priority, skill))
            if len(action_plan) >= 8:
                return action_plan

    return action_plan


def build_evidence_checklist_from_skills(
    scores: dict[str, Any],
    answers: dict[str, dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    answers = answers or {}
    domain_details = scores.get("domain_details", {})
    checklist: list[dict[str, Any]] = []
    seen: set[str] = set()

    candidate_domains = [
        domain
        for domain, detail in sorted(domain_details.items(), key=lambda item: item[1].get("score", 0))
        if int(detail.get("score", 0)) < 80
        or bool(detail.get("critical_negative_answers"))
        or bool(detail.get("unanswered_questions"))
    ]
    if not candidate_domains:
        candidate_domains = list(domain_details.keys())

    for domain in candidate_domains:
        for skill in match_skills(domain, answers, top_k=3):
            if skill["id"] in seen:
                continue
            seen.add(skill["id"])
            checklist.append(
                {
                    "domain": domain,
                    "based_on_skill": skill["id"],
                    "title": skill["title"],
                    "nist_csf": skill.get("nist_csf", []),
                    "items": skill.get("evidence_checklist", []),
                }
            )
    return checklist


def build_skill_references(
    scores: dict[str, Any],
    answers: dict[str, dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    answers = answers or {}
    domain_details = scores.get("domain_details", {})
    refs: list[dict[str, Any]] = []
    seen: set[str] = set()

    for domain, detail in sorted(domain_details.items(), key=lambda item: item[1].get("score", 0)):
        if int(detail.get("score", 0)) >= 80 and not detail.get("critical_negative_answers"):
            continue
        for skill in match_skills(domain, answers, top_k=3):
            if skill["id"] in seen:
                continue
            seen.add(skill["id"])
            refs.append(
                {
                    "id": skill["id"],
                    "title": skill["title"],
                    "domain": skill["domain"],
                    "safe_use": skill["safe_use"],
                    "nist_csf": skill.get("nist_csf", []),
                    "tags": skill.get("tags", []),
                }
            )
    return refs


def _parse_skill_file(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8-sig")
    metadata: dict[str, Any] = {}
    body = raw

    if raw.startswith("---"):
        parts = raw.split("---", 2)
        if len(parts) == 3:
            metadata = _parse_frontmatter(parts[1])
            body = parts[2].strip()

    sections = _parse_sections(body)
    return {
        **metadata,
        "path": str(path.relative_to(BASE_DIR)),
        "body": body,
        "sections": sections,
        "when_to_use": sections.get("When to Use", ""),
        "what_to_ask": _section_items(sections.get("What to Ask", "")),
        "risk_logic": sections.get("Risk Logic", ""),
        "recommended_actions": _section_items(sections.get("Recommended Actions", "")),
        "evidence_checklist": _section_items(sections.get("Evidence Checklist", "")),
        "client_explanation": sections.get("Client Explanation", ""),
    }


def _parse_frontmatter(frontmatter: str) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    for raw_line in frontmatter.splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        key = key.strip()
        value = raw_value.strip()
        if value.startswith("[") and value.endswith("]"):
            metadata[key] = [
                item.strip().strip("\"'")
                for item in value[1:-1].split(",")
                if item.strip()
            ]
        else:
            metadata[key] = value.strip("\"'")
    return metadata


def _parse_sections(body: str) -> dict[str, str]:
    matches = list(re.finditer(r"^##\s+(.+?)\s*$", body, flags=re.MULTILINE))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        sections[title] = body[start:end].strip()
    return sections


def _section_items(section_text: str) -> list[str]:
    items = []
    for line in section_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("- "):
            items.append(stripped[2:].strip())
    if items:
        return items
    return [section_text.strip()] if section_text.strip() else []


def _normalize_domain(domain: str | None) -> str:
    value = str(domain or "").strip().lower().replace("-", "_")
    if value in {"mfa", "mfa_access", "access"}:
        return "mfa_access"
    return value


def _prioritized_skill_ids(
    domain: str,
    answers: dict[str, dict[str, Any]],
    fallback_ids: list[str],
) -> list[str]:
    if domain == "backups":
        if _answer_is_gap(answers, "rto_rpo_known"):
            return ["ransomware-recovery", "ransomware-backup-strategy"]
        return ["ransomware-backup-strategy", "ransomware-recovery"]

    if domain == "incident_response":
        if _answer_is_gap(answers, "ir_plan_tested"):
            return ["tabletop-exercise", "incident-response-plan", "ransomware-response"]
        if _answer_is_gap(answers, "ir_plan_exists"):
            return ["incident-response-plan", "ransomware-response", "tabletop-exercise"]
        return ["incident-response-plan", "ransomware-response", "tabletop-exercise"]

    return fallback_ids


def _answer_is_gap(answers: dict[str, dict[str, Any]], question_id: str) -> bool:
    answer = (answers.get(question_id) or {}).get("answer")
    return answer in {"partial", "no", "unsure"}


def _build_action_item(domain: str, priority: str, skill: dict[str, Any]) -> dict[str, Any]:
    evidence = skill.get("evidence_checklist", [])[:3]
    recommended_actions = skill.get("recommended_actions", [])
    title = recommended_actions[0] if recommended_actions else skill["title"]
    return {
        "title": title.rstrip("."),
        "priority": priority,
        "domain": domain,
        "owner_suggestion": OWNER_SUGGESTIONS.get(domain, "Management / IT"),
        "deadline": DEADLINES.get(priority, "60 days"),
        "effort": EFFORT.get(priority, "Medium"),
        "evidence_required": evidence,
        "based_on_skill": skill["id"],
    }


def _priority_from_score(score: int) -> str:
    if score < 40:
        return "Critical"
    if score < 60:
        return "High"
    if score < 80:
        return "Medium"
    return "Low"
