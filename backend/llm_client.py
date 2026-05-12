from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import requests

from backend.config import (
    PROMPTS_DIR,
    get_llm_settings,
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


def generate_text(prompt: str, system_prompt: str = "", temperature: float = 0.2) -> LLMResult:
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

    if provider == "openai" and openai_api_key:
        try:
            from openai import OpenAI  # optional dependency

            client = OpenAI(api_key=openai_api_key, base_url=openai_base_url)
            response = client.chat.completions.create(
                model=openai_model,
                temperature=temperature,
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

    if provider == "openai" and not openai_api_key:
        fallback = fallback_text(prompt)
        return LLMResult(
            text=fallback,
            provider="fallback_after_openai_missing_key",
            model="deterministic-template",
            used_real_llm=False,
            error="OPENAI_API_KEY is empty; insert your key in .env.",
        )

    return LLMResult(
        text=fallback_text(prompt),
        provider="fallback",
        model="deterministic-template",
        used_real_llm=False,
    )


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
