from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PROMPTS_DIR = BASE_DIR / "prompts"


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


def get_llm_settings() -> dict[str, object]:
    dotenv = {} if os.getenv("RRA_IGNORE_DOTENV") == "1" else load_dotenv(BASE_DIR / ".env")

    def value(key: str, default: str = "") -> str:
        if key in dotenv:
            return dotenv[key]
        return os.getenv(key, default)

    try:
        timeout = float(value("REQUEST_TIMEOUT_SECONDS", "30"))
    except ValueError:
        timeout = 30.0

    return {
        "provider": value("LLM_PROVIDER", "fallback").strip().lower(),
        "ollama_url": value("OLLAMA_URL", "http://localhost:11434/api/generate").strip(),
        "ollama_model": value("OLLAMA_MODEL", "qwen2.5:7b").strip(),
        "openai_model": value("OPENAI_MODEL", "gpt-4o-mini").strip(),
        "openai_api_key": value("OPENAI_API_KEY").strip(),
        "openai_base_url": value("OPENAI_BASE_URL", "https://api.openai.com/v1").strip(),
        "request_timeout_seconds": timeout,
    }


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
        or (provider == "openai" and bool(openai_api_key))
    )
    reason = "ready"
    if provider == "openai" and not openai_api_key:
        reason = "OPENAI_API_KEY is empty; insert your key in .env."
    elif provider not in {"fallback", "ollama", "openai"}:
        reason = f"Unsupported LLM_PROVIDER: {provider}"

    return {
        "provider": provider,
        "provider_ready": provider_ready,
        "reason": reason,
        "openai_api_key_present": bool(openai_api_key),
        "openai_model": settings["openai_model"],
        "openai_base_url": settings["openai_base_url"],
        "ollama_model": settings["ollama_model"],
        "ollama_url": settings["ollama_url"],
        "request_timeout_seconds": settings["request_timeout_seconds"],
    }
