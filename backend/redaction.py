from __future__ import annotations

import re

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
URL_RE = re.compile(r"\bhttps?://[^\s<>()]+|\bwww\.[^\s<>()]+", re.IGNORECASE)
IPV4_RE = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b"
)
DOMAIN_RE = re.compile(
    r"(?<!@)\b(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+"
    r"(?:[A-Z]{2,24})\b",
    re.IGNORECASE,
)
SECRET_ASSIGNMENT_RE = re.compile(
    r"\b([A-Za-z0-9_]*(?:api[_-]?key|token|secret|password|passwd|pwd))\s*[:=]\s*([^\s,;]+)",
    re.IGNORECASE,
)
BEARER_SECRET_RE = re.compile(r"\b(Bearer)\s+[A-Za-z0-9._~+/=-]{12,}\b", re.IGNORECASE)
HIGH_ENTROPY_SECRET_RE = re.compile(
    r"\b(?:sk-[A-Za-z0-9_-]{16,}|[A-Za-z0-9_/\-+=]{32,})\b"
)
LONG_ID_RE = re.compile(r"\b\d(?:[\d -]{8,}\d)\b")


def redact_sensitive_text(text: str) -> tuple[str, list[str]]:
    """Replace sensitive identifiers before text is sent to an LLM.

    The patterns are intentionally conservative so normal Estonian prose is not
    treated as sensitive data just because it contains punctuation or initials.
    """
    redacted = str(text or "")
    applied: list[str] = []

    replacements = [
        ("EMAIL", EMAIL_RE, "[EMAIL]"),
        ("URL", URL_RE, "[URL]"),
        ("IP_ADDRESS", IPV4_RE, "[IP_ADDRESS]"),
        ("SECRET", SECRET_ASSIGNMENT_RE, _redact_secret_assignment),
        ("SECRET", BEARER_SECRET_RE, r"\1 [SECRET]"),
        ("SECRET", HIGH_ENTROPY_SECRET_RE, "[SECRET]"),
        ("ID_NUMBER", LONG_ID_RE, "[ID_NUMBER]"),
        ("DOMAIN", DOMAIN_RE, "[DOMAIN]"),
    ]

    for label, pattern, replacement in replacements:
        redacted, count = pattern.subn(replacement, redacted)
        if count and label not in applied:
            applied.append(label)

    return redacted, applied


def has_sensitive_data(text: str) -> bool:
    return bool(redact_sensitive_text(text)[1])


def _redact_secret_assignment(match: re.Match[str]) -> str:
    return f"{match.group(1)}=[SECRET]"
