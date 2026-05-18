from __future__ import annotations

import re
import unicodedata

INJECTION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("ignore previous instructions", re.compile(r"\bignore\s+(?:all\s+)?previous\s+instructions\b", re.I)),
    ("reveal system prompt", re.compile(r"\b(?:reveal|show|print|dump)\s+(?:the\s+)?system\s+prompt\b", re.I)),
    ("internal prompts", re.compile(r"\binternal\s+prompts?\b", re.I)),
    ("developer message", re.compile(r"\bdeveloper\s+(?:message|instructions?)\b", re.I)),
    ("hidden prompt", re.compile(r"\bhidden\s+prompt\b", re.I)),
    ("disable safety", re.compile(r"\bdisable\s+(?:all\s+)?safety\b", re.I)),
    ("ignore safety rules", re.compile(r"\bignore\s+(?:all\s+)?safety\s+rules\b", re.I)),
    ("jailbreak", re.compile(r"\bjailbreak\b", re.I)),
    ("act unrestricted", re.compile(r"\bact\s+as\s+(?:an?\s+)?unrestricted\b", re.I)),
    ("print instructions", re.compile(r"\b(?:print|show|reveal|dump)\s+(?:your\s+)?instructions\b", re.I)),
    ("system instructions", re.compile(r"\bsystem\s+instructions\b", re.I)),
    ("bypass guardrails", re.compile(r"\bbypass\s+(?:the\s+)?guardrails\b", re.I)),
    ("DAN", re.compile(r"\bDAN\b")),
]


def detect_prompt_injection(text: str) -> dict[str, object]:
    normalized = _normalize(text)
    matched = [reason for reason, pattern in INJECTION_PATTERNS if pattern.search(text or "")]

    normalized_checks = {
        "ignore previous instructions": "ignore previous instructions",
        "reveal system prompt": "reveal system prompt",
        "internal prompts": "internal prompts",
        "developer message": "developer message",
        "hidden prompt": "hidden prompt",
        "disable safety": "disable safety",
        "ignore safety rules": "ignore safety rules",
        "jailbreak": "jailbreak",
        "act unrestricted": "act as unrestricted",
        "print instructions": "print your instructions",
        "system instructions": "system instructions",
        "bypass guardrails": "bypass guardrails",
    }
    for reason, phrase in normalized_checks.items():
        if phrase in normalized and reason not in matched:
            matched.append(reason)

    return {
        "detected": bool(matched),
        "reason": ", ".join(matched) if matched else "",
        "matched_patterns": matched,
    }


def is_prompt_injection(text: str) -> bool:
    return bool(detect_prompt_injection(text)["detected"])


def safe_prompt_injection_response(language: str = "et") -> str:
    lang = language.lower()
    if lang in {"ru", "russian"}:
        return "Я не могу менять системные инструкции или раскрывать внутренние prompts. Продолжим оценку готовности к ransomware."
    if lang in {"en", "english"}:
        return "I can’t change system instructions or reveal internal prompts. Let’s continue the ransomware readiness assessment."
    return "Ma ei saa muuta süsteemi juhiseid ega avaldada sisemisi prompt’e. Jätkame lunavara valmisoleku hindamisega."


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(text or "").lower())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))
