from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import requests

from backend.config import (
    PROMPTS_DIR,
    get_llm_settings,
    has_real_openai_key,
    openai_provider_config_error,
)


@dataclass
class LLMResult:
    text: str
    provider: str
    model: str
    used_real_llm: bool
    error: str | None = None


def load_prompt(name: str) -> str:
    path = PROMPTS_DIR / name
    return path.read_text(encoding="utf-8")


def generate_text(
    prompt: str,
    system_prompt: str = "",
    temperature: float = 0.2,
    max_output_tokens: int = 1200,
) -> LLMResult:
    """Generate text using configured provider.

    The app is demo-safe: if Ollama/OpenAI is unavailable, it falls back to a deterministic
    local generator and exposes that fact in the response.
    """
    settings = get_llm_settings()
    provider = str(settings["provider"])
    ollama_model = str(settings["ollama_model"])
    ollama_url = str(settings["ollama_url"])
    openai_model = str(settings["openai_model"])
    openai_api_key = str(settings["openai_api_key"])
    openai_base_url = str(settings["openai_base_url"])
    request_timeout_seconds = float(settings["request_timeout_seconds"])
    safe_max_output_tokens = max(32, min(int(max_output_tokens), 1200))
    provider_config_error = openai_provider_config_error(openai_api_key, openai_base_url)

    if provider == "ollama":
        try:
            payload = {
                "model": ollama_model,
                "prompt": f"{system_prompt}\n\n{prompt}",
                "stream": False,
                "options": {"temperature": temperature},
            }
            r = requests.post(ollama_url, json=payload, timeout=request_timeout_seconds)
            r.raise_for_status()
            data = r.json()
            return LLMResult(
                text=data.get("response", "").strip(),
                provider="ollama",
                model=ollama_model,
                used_real_llm=True,
            )
        except Exception as exc:  # noqa: BLE001
            fallback = fallback_text(prompt)
            return LLMResult(
                text=fallback,
                provider="fallback_after_ollama_error",
                model="deterministic-template",
                used_real_llm=False,
                error=str(exc),
            )

    if provider == "openai" and provider_config_error:
        fallback = fallback_text(prompt)
        return LLMResult(
            text=fallback,
            provider="fallback_after_openai_config_error",
            model="deterministic-template",
            used_real_llm=False,
            error=provider_config_error,
        )

    if provider == "openai" and has_real_openai_key(openai_api_key):
        try:
            from openai import OpenAI  # optional dependency

            client = OpenAI(api_key=openai_api_key, base_url=openai_base_url)
            response = _create_openai_chat_completion(
                client=client,
                model=openai_model,
                temperature=temperature,
                max_tokens=safe_max_output_tokens,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
            )
            return LLMResult(
                text=response.choices[0].message.content.strip(),
                provider="openai",
                model=openai_model,
                used_real_llm=True,
            )
        except Exception as exc:  # noqa: BLE001
            fallback = fallback_text(prompt)
            return LLMResult(
                text=fallback,
                provider="fallback_after_openai_error",
                model="deterministic-template",
                used_real_llm=False,
                error=str(exc),
            )

    if provider == "openai" and not has_real_openai_key(openai_api_key):
        fallback = fallback_text(prompt)
        return LLMResult(
            text=fallback,
            provider="fallback_after_openai_missing_key",
            model="deterministic-template",
            used_real_llm=False,
            error="OPENAI_API_KEY is empty or still a placeholder; insert your key in .env.",
        )

    return LLMResult(
        text=fallback_text(prompt),
        provider="fallback",
        model="deterministic-template",
        used_real_llm=False,
    )


def _create_openai_chat_completion(
    *,
    client: Any,
    model: str,
    temperature: float,
    max_tokens: int,
    messages: list[dict[str, str]],
) -> Any:
    attempt_tokens = max_tokens
    last_error: Exception | None = None

    for _ in range(3):
        try:
            request_kwargs = _openai_token_param_kwargs(model=model, max_tokens=attempt_tokens)
            return client.chat.completions.create(
                model=model,
                temperature=temperature,
                messages=messages,
                **request_kwargs,
            )
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            reduced_tokens = _reduced_max_tokens_from_error(str(exc), attempt_tokens)
            if reduced_tokens is None or reduced_tokens >= attempt_tokens:
                raise
            attempt_tokens = reduced_tokens

    if last_error is not None:
        raise last_error
    raise RuntimeError("OpenAI chat completion failed without an exception.")


def _openai_token_param_kwargs(*, model: str, max_tokens: int) -> dict[str, int]:
    normalized_model = model.strip().lower()
    if normalized_model.startswith("gpt-5"):
        return {"max_completion_tokens": max_tokens}
    return {"max_tokens": max_tokens}


def _reduced_max_tokens_from_error(error_text: str, current_max_tokens: int) -> int | None:
    normalized = error_text.lower()
    if "fewer max_tokens" not in normalized and "can only afford" not in normalized:
        return None

    affordable_match = re.search(r"can only afford (\d+)", normalized)
    if affordable_match:
        affordable = int(affordable_match.group(1))
        if affordable >= 32:
            return min(affordable, max(32, current_max_tokens - 1))

    if current_max_tokens > 256:
        return 256
    if current_max_tokens > 128:
        return 128
    if current_max_tokens > 64:
        return 64
    if current_max_tokens > 32:
        return 32
    return None


def fallback_text(prompt: str) -> str:
    """Local deterministic fallback for classroom/demo reliability."""
    if "needs_followup" in prompt or "followup_question" in prompt:
        return json.dumps(
            {
                "needs_followup": False,
                "followup_question": "",
                "reason": "Fallback-režiim: täpsustavat küsimust ei genereeritud.",
            },
            ensure_ascii=False,
        )

    report_payload = parse_json_from_llm(prompt)
    if report_payload and "scores" in report_payload:
        return fallback_report_text(report_payload)

    return "Automaatne tekstikiht ei ole hetkel saadaval, kuid reeglipõhine hindamine on arvutatud."


def fallback_report_text(payload: dict[str, Any]) -> str:
    """Create a client-facing report text without exposing provider internals."""
    scores = payload.get("scores", {})
    top_risks = payload.get("top_risks", [])
    next_steps = payload.get("next_steps", [])
    answers = payload.get("answers", [])

    score = scores.get("overall_score", "N/A")
    risk_level = fallback_risk_label(str(scores.get("risk_level", "unknown")))
    score_status = scores.get("score_status", "final")
    completion_rate = scores.get("completion_rate", 0)

    lines = [
        (
            f"Organisatsiooni lunavararünnakuks valmisoleku skoor on {score}/100 "
            f"ja riskitase on {risk_level}. See on esmane enesehindamine vastuste põhjal, "
            "mitte täielik audit."
        )
    ]

    if score_status == "preliminary":
        lines.append(f"Hinnang on esialgne, sest vastatud on {completion_rate}% põhiküsimustest.")

    unsure_answers = [
        answer
        for answer in answers
        if answer.get("answer") in {"partial", "unsure"} or not answer.get("answer")
    ]
    if unsure_answers:
        lines.append(
            "Mitmes vastuses jäi info osaliseks või ebakindlaks; need kohad vajavad enne otsuste tegemist üle kontrollimist."
        )

    if top_risks:
        risk_lines = []
        for risk in top_risks[:5]:
            title = risk.get("title", "Valdkond")
            risk_text = trim_sentence(risk.get("risk", "vajab täiendavat tähelepanu"))
            risk_lines.append(f"{title}: {risk_text}")
        lines.append("Peamised riskid on: " + "; ".join(risk_lines) + ".")

    if next_steps:
        step_lines = [trim_sentence(step) for step in next_steps[:5]]
        lines.append("Järgmised prioriteetsed sammud: " + "; ".join(step_lines) + ".")

    return "\n\n".join(lines)


def fallback_risk_label(risk_level: str) -> str:
    return {
        "low": "madal",
        "medium": "keskmine",
        "high": "kõrge",
        "critical": "kriitiline",
    }.get(risk_level.lower(), risk_level)


def trim_sentence(value: Any) -> str:
    return str(value).strip().rstrip(".;:")


def parse_json_from_llm(text: str) -> dict[str, Any] | None:
    """Robustly extract the first valid JSON object from LLM output.

    Handles:
    - clean JSON responses
    - JSON wrapped in ```json ... ``` fences
    - prose before/after the JSON block
    - multiple JSON objects in one response (takes the first)
    """
    # 1. Try direct parse first (fast path for clean responses)
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # 2. Strip markdown code fences: ```json ... ``` or ``` ... ```
    fenced = re.search(r"```(?:json)?\s*(\{.*?})\s*```", stripped, re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass

    # 3. Find the first { and match its closing } by counting braces
    #    This correctly handles nested objects and ignores trailing content.
    start = stripped.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape_next = False

    for i, ch in enumerate(stripped[start:], start=start):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(stripped[start : i + 1])
                except json.JSONDecodeError:
                    return None

    return None
