import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PROMPTS_DIR = BASE_DIR / "prompts"
OPENAI_KEY_PLACEHOLDERS = {"your-api-key-here", "your-openrouter-key-here"}


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def _dotenv_values() -> dict[str, str]:
    if os.getenv("RRA_IGNORE_DOTENV") == "1":
        return {}
    return load_dotenv(BASE_DIR / ".env")


def get_config_value(key: str, default: str = "") -> str:
    dotenv = _dotenv_values()
    if key in dotenv:
        return dotenv[key]
    return os.getenv(key, default)


def _parse_float(value: str, default: float) -> float:
    try:
        return float(value)
    except ValueError:
        return default


def _parse_int(value: str, default: int) -> int:
    try:
        return int(value)
    except ValueError:
        return default


def _parse_bool(value: str, default: bool = False) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def get_llm_settings() -> dict[str, object]:
    timeout = _parse_float(get_config_value("REQUEST_TIMEOUT_SECONDS", "30"), 30.0)

    return {
        "provider": get_config_value("LLM_PROVIDER", "fallback").strip().lower(),
        "ollama_url": get_config_value("OLLAMA_URL", "http://localhost:11434/api/generate").strip(),
        "ollama_model": get_config_value("OLLAMA_MODEL", "qwen2.5:7b").strip(),
        "openai_model": get_config_value("OPENAI_MODEL", "gpt-4o-mini").strip(),
        "openai_api_key": get_config_value("OPENAI_API_KEY").strip(),
        "openai_base_url": get_config_value("OPENAI_BASE_URL", "https://api.openai.com/v1").strip(),
        "request_timeout_seconds": timeout,
    }


def get_security_settings() -> dict[str, object]:
    api_auth_token = get_config_value("API_AUTH_TOKEN").strip()
    return {
        "api_auth_token": api_auth_token,
        "auth_enabled": bool(api_auth_token),
        "trust_proxy_headers": _parse_bool(get_config_value("TRUST_PROXY_HEADERS", "0")),
        "rate_limit_chat_per_minute": _parse_int(get_config_value("RATE_LIMIT_CHAT_PER_MINUTE", "20"), 20),
        "rate_limit_report_per_minute": _parse_int(get_config_value("RATE_LIMIT_REPORT_PER_MINUTE", "10"), 10),
        "rate_limit_demo_per_minute": _parse_int(get_config_value("RATE_LIMIT_DEMO_PER_MINUTE", "5"), 5),
    }


def has_real_openai_key(value: str) -> bool:
    key = value.strip()
    return bool(key) and key.lower() not in OPENAI_KEY_PLACEHOLDERS


_SETTINGS = get_llm_settings()
LLM_PROVIDER = str(_SETTINGS["provider"])  # fallback, ollama, openai
OLLAMA_URL = str(_SETTINGS["ollama_url"])
OLLAMA_MODEL = str(_SETTINGS["ollama_model"])
OPENAI_MODEL = str(_SETTINGS["openai_model"])
OPENAI_API_KEY = str(_SETTINGS["openai_api_key"])
OPENAI_BASE_URL = str(_SETTINGS["openai_base_url"])
REQUEST_TIMEOUT_SECONDS = float(_SETTINGS["request_timeout_seconds"])


def llm_status() -> dict[str, object]:
    settings = get_llm_settings()
    provider = str(settings["provider"])
    openai_api_key = str(settings["openai_api_key"])
    provider_ready = (
        provider == "fallback"
        or provider == "ollama"
        or (provider == "openai" and has_real_openai_key(openai_api_key))
    )
    reason = "ready"
    if provider == "openai" and not has_real_openai_key(openai_api_key):
        reason = "OPENAI_API_KEY is empty or still a placeholder; insert your key in .env."
    elif provider not in {"fallback", "ollama", "openai"}:
        reason = f"Unsupported LLM_PROVIDER: {provider}"

    return {
        "provider": provider,
        "provider_ready": provider_ready,
        "reason": reason,
        "openai_api_key_present": has_real_openai_key(openai_api_key),
        "openai_model": settings["openai_model"],
        "openai_base_url": settings["openai_base_url"],
        "ollama_model": settings["ollama_model"],
        "ollama_url": settings["ollama_url"],
        "request_timeout_seconds": settings["request_timeout_seconds"],
    }
