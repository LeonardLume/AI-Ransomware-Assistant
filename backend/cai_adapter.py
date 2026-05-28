from __future__ import annotations

from importlib import metadata, util
from typing import Any

from backend.config import get_config_value

CAI_PACKAGE = "cai-framework"
CAI_IMPORT_NAME = "cai"
CAI_TESTED_VERSION = "0.5.10"

SAFE_CAPABILITIES = [
    {
        "id": "blue_team_reasoning",
        "name": "Blue-team reasoning",
        "description": "Use CAI-style agent roles to explain defensive controls, evidence, and likely risk paths.",
    },
    {
        "id": "dfir_triage_guidance",
        "name": "DFIR triage guidance",
        "description": "Guide incident-response readiness questions without touching customer systems.",
    },
    {
        "id": "report_review",
        "name": "Report review",
        "description": "Review backend-owned findings and turn them into IT-ready remediation language.",
    },
]

BLOCKED_CAPABILITIES = [
    "exploit_execution",
    "credential_theft",
    "malware_generation",
    "mfa_bypass",
    "persistence",
    "evasion",
    "unauthorized_scanning",
    "shell_execution_against_targets",
]


def cai_framework_status() -> dict[str, Any]:
    """Return a safe runtime status for the optional CAI integration.

    CAI is intentionally not imported or executed here. The core assessment must
    keep working even when the optional framework is missing, disabled, or kept in
    a separate worker environment.
    """

    installed, version = _installed_package_version()
    enabled = _env_bool("CAI_AGENT_ENABLED", default=False)
    execution_enabled = _env_bool("CAI_ALLOW_TOOL_EXECUTION", default=False)
    safe_execution = bool(enabled and installed and not execution_enabled)

    if not enabled:
        reason = "CAI bridge is disabled by default. Set CAI_AGENT_ENABLED=1 to enable metadata-level integration."
    elif not installed:
        reason = "CAI package is not installed in this backend environment."
    elif execution_enabled:
        reason = (
            "CAI tool execution is blocked by product policy; only defensive metadata-level integration is allowed."
        )
    else:
        reason = "CAI bridge is available for defensive agent orchestration metadata."

    return {
        "framework": "CAI",
        "package": CAI_PACKAGE,
        "import_name": CAI_IMPORT_NAME,
        "tested_version": CAI_TESTED_VERSION,
        "installed": installed,
        "version": version,
        "enabled": enabled,
        "execution_enabled": False,
        "safe_execution_ready": safe_execution,
        "reason": reason,
        "dependency_strategy": (
            "Optional and isolated. The default backend requirements are unchanged so the existing "
            "question flow, scoring, and fallback mode remain stable."
        ),
        "safe_capabilities": SAFE_CAPABILITIES,
        "blocked_capabilities": BLOCKED_CAPABILITIES,
    }


def cai_security_manifest() -> dict[str, Any]:
    status = cai_framework_status()
    return {
        "name": "CAI Defensive Bridge",
        "purpose": (
            "Connect CAI-style cybersecurity agents to the readiness assistant without replacing backend scoring."
        ),
        "status": status,
        "routing_policy": [
            "The structured interview remains the source of truth for answers.",
            "The deterministic backend remains the source of truth for score and risk level.",
            "CAI-style agents may only explain, review, request evidence, or draft defensive recommendations.",
            "No external target interaction is allowed from this bridge.",
            "Any future active checks must be a separate opt-in worker with asset-owner authorization.",
        ],
    }


def is_cai_capability_allowed(capability_id: str) -> bool:
    allowed = {capability["id"] for capability in SAFE_CAPABILITIES}
    return capability_id in allowed


def _installed_package_version() -> tuple[bool, str | None]:
    if util.find_spec(CAI_IMPORT_NAME) is None:
        return False, None
    try:
        return True, metadata.version(CAI_PACKAGE)
    except metadata.PackageNotFoundError:
        return True, None


def _env_bool(key: str, *, default: bool) -> bool:
    value = get_config_value(key, "1" if default else "0").strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default
