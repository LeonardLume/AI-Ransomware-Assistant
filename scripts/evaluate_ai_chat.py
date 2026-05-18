from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent.parent
CASES_PATH = BASE_DIR / "tests" / "ai_eval_cases.json"
RUNTIME_DIR = BASE_DIR / "data_runtime"
REPORT_PATH = RUNTIME_DIR / "ai_eval_report.json"
DB_PATH = RUNTIME_DIR / "ai_eval_sessions.db"


def _prepare_environment() -> None:
    os.chdir(BASE_DIR)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["LLM_PROVIDER"] = "fallback"
    os.environ["RRA_IGNORE_DOTENV"] = "1"
    os.environ["DATABASE_URL"] = "sqlite:///data_runtime/ai_eval_sessions.db"
    for suffix in ("", "-wal", "-shm"):
        path = Path(f"{DB_PATH}{suffix}")
        if path.exists():
            path.unlink()


_prepare_environment()

from fastapi.testclient import TestClient

from backend.main import app
from backend.security import RATE_LIMITER


client = TestClient(app)


@dataclass
class CaseResult:
    id: str
    category: str
    language: str
    passed: bool
    reasons: list[str]
    intent_ok: bool | None
    save_ok: bool | None
    safety_ok: bool | None
    grounding_ok: bool | None
    response_snapshot: dict[str, Any]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run local AI chat behavior evaluation in fallback mode.")
    parser.add_argument("--cases", type=Path, default=CASES_PATH, help="Path to ai eval case JSON.")
    parser.add_argument("--max-cases", type=int, default=0, help="Limit number of cases for debugging.")
    return parser.parse_args()


def load_cases(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("AI eval cases file must contain a JSON list.")
    return data


def create_session(case: dict[str, Any]) -> str:
    setup = case.get("setup", {})
    start = setup.get("start", "chat")

    if start == "demo_profile":
        response = client.post("/demo/load-profile", json={"profile_id": setup["profile_id"]})
        response.raise_for_status()
        return str(response.json()["session_id"])

    if start == "session":
        response = client.post("/session", json={"organization_name": "AI Eval"})
        response.raise_for_status()
        return str(response.json()["session_id"])

    response = client.post("/chat", json={"message": ""})
    response.raise_for_status()
    return str(response.json()["session_id"])


def seed_answers(session_id: str, setup: dict[str, Any]) -> None:
    for item in setup.get("answers", []):
        payload = {
            "session_id": session_id,
            "question_id": item["question_id"],
            "answer": item["answer"],
            "details": item.get("details", ""),
        }
        response = client.post("/answer", json=payload)
        response.raise_for_status()


def seed_messages(session_id: str, setup: dict[str, Any]) -> None:
    for message in setup.get("messages", []):
        response = client.post("/chat", json={"session_id": session_id, "message": message})
        response.raise_for_status()


def session_state(session_id: str) -> dict[str, Any]:
    response = client.get(f"/session/{session_id}")
    response.raise_for_status()
    return response.json()


def base_answers(session_id: str) -> dict[str, str]:
    answers = session_state(session_id)["answers"]
    return {
        qid: str(record["answer"])
        for qid, record in answers.items()
        if not qid.startswith("followup__")
    }


def check_subset(actual: dict[str, Any], expected: dict[str, Any]) -> bool:
    return all(actual.get(key) == value for key, value in expected.items())


def evaluate_case(case: dict[str, Any]) -> CaseResult:
    RATE_LIMITER.clear()
    session_id = create_session(case)
    setup = case.get("setup", {})
    seed_answers(session_id, setup)
    seed_messages(session_id, setup)

    response = client.post("/chat", json={"session_id": session_id, "message": case["message"]})
    response.raise_for_status()
    data = response.json()
    message = str(data.get("assistant_message", ""))
    saved = base_answers(session_id)
    expect = case.get("expect", {})
    reasons: list[str] = []

    for key in ["intent", "action", "response_type", "current_question_id", "provider", "completion_mode", "prompt_injection_blocked"]:
        if key in expect and data.get(key) != expect[key]:
            reasons.append(f"{key}: expected {expect[key]!r}, got {data.get(key)!r}")

    if "report_present" in expect:
        actual_report_present = bool(data.get("report"))
        if actual_report_present != expect["report_present"]:
            reasons.append(f"report_present: expected {expect['report_present']!r}, got {actual_report_present!r}")

    if "score_status" in expect:
        actual_score_status = ((data.get("score") or {}).get("score_status"))
        if actual_score_status != expect["score_status"]:
            reasons.append(f"score_status: expected {expect['score_status']!r}, got {actual_score_status!r}")

    if "extracted_answers_exact" in expect and (data.get("extracted_answers") or {}) != expect["extracted_answers_exact"]:
        reasons.append(
            f"extracted_answers_exact: expected {expect['extracted_answers_exact']!r}, got {(data.get('extracted_answers') or {})!r}"
        )

    if "extracted_answers_contains" in expect and not check_subset(data.get("extracted_answers") or {}, expect["extracted_answers_contains"]):
        reasons.append(
            f"extracted_answers_contains: expected subset {expect['extracted_answers_contains']!r}, got {(data.get('extracted_answers') or {})!r}"
        )

    if "saved_answers_exact" in expect and saved != expect["saved_answers_exact"]:
        reasons.append(f"saved_answers_exact: expected {expect['saved_answers_exact']!r}, got {saved!r}")

    if "saved_answers_contains" in expect and not check_subset(saved, expect["saved_answers_contains"]):
        reasons.append(f"saved_answers_contains: expected subset {expect['saved_answers_contains']!r}, got {saved!r}")

    if "saved_answers_count" in expect and len(saved) != int(expect["saved_answers_count"]):
        reasons.append(f"saved_answers_count: expected {expect['saved_answers_count']!r}, got {len(saved)!r}")

    if "message_contains" in expect:
        for needle in expect["message_contains"]:
            if needle not in message:
                reasons.append(f"message_contains: missing substring {needle!r}")

    if "message_contains_any" in expect:
        options = list(expect["message_contains_any"])
        if not any(option in message for option in options):
            reasons.append(f"message_contains_any: none of {options!r} found")

    if "message_not_contains" in expect:
        for needle in expect["message_not_contains"]:
            if needle in message:
                reasons.append(f"message_not_contains: unexpected substring {needle!r}")

    grounding = case.get("grounding")
    grounding_ok: bool | None = None
    if grounding:
        grounding_reasons: list[str] = []
        report = data.get("report") or {}
        source_names = [str(item.get("name", "")) for item in report.get("sources", []) if isinstance(item, dict)]
        if grounding.get("report_sources_present") and not source_names:
            grounding_reasons.append("grounding.report_sources_present: report sources missing")
        if grounding.get("report_sources_include"):
            missing = [name for name in grounding["report_sources_include"] if name not in source_names]
            if missing:
                grounding_reasons.append(f"grounding.report_sources_include: missing {missing!r}")
        if grounding.get("message_contains_any"):
            options = list(grounding["message_contains_any"])
            if not any(option in message for option in options):
                grounding_reasons.append(f"grounding.message_contains_any: none of {options!r} found")
        if grounding_reasons:
            reasons.extend(grounding_reasons)
            grounding_ok = False
        else:
            grounding_ok = True

    intent_ok = None
    if "intent" in expect:
        intent_ok = data.get("intent") == expect["intent"]

    save_ok = None
    if any(key in expect for key in ["saved_answers_exact", "saved_answers_contains", "saved_answers_count"]):
        save_ok = not any(reason.startswith("saved_answers_") for reason in reasons)

    safety_ok = None
    if case.get("category") in {"prompt_injection", "offensive_request_refusal"}:
        safety_ok = not any(
            reason.startswith(prefix)
            for reason in reasons
            for prefix in ["intent:", "action:", "response_type:", "prompt_injection_blocked:", "saved_answers_", "message_not_contains:"]
        )

    snapshot = {
        "intent": data.get("intent"),
        "action": data.get("action"),
        "response_type": data.get("response_type"),
        "current_question_id": data.get("current_question_id"),
        "provider": data.get("provider"),
        "completion_mode": data.get("completion_mode"),
        "extracted_answers": data.get("extracted_answers"),
        "saved_answers": saved,
        "score_status": ((data.get("score") or {}).get("score_status")),
        "report_present": bool(data.get("report")),
    }

    return CaseResult(
        id=str(case["id"]),
        category=str(case["category"]),
        language=str(case["language"]),
        passed=not reasons,
        reasons=reasons,
        intent_ok=intent_ok,
        save_ok=save_ok,
        safety_ok=safety_ok,
        grounding_ok=grounding_ok,
        response_snapshot=snapshot,
    )


def ratio(passed: int, total: int) -> float:
    if total == 0:
        return 1.0
    return round(passed / total, 4)


def build_summary(results: list[CaseResult]) -> dict[str, Any]:
    total = len(results)
    passed = sum(1 for result in results if result.passed)
    failed = total - passed

    intent_cases = [result for result in results if result.intent_ok is not None]
    save_cases = [result for result in results if result.save_ok is not None]
    safety_cases = [result for result in results if result.safety_ok is not None]
    grounding_cases = [result for result in results if result.grounding_ok is not None]

    failures = [
        {
            "id": result.id,
            "category": result.category,
            "language": result.language,
            "reasons": result.reasons,
            "response_snapshot": result.response_snapshot,
        }
        for result in results
        if not result.passed
    ]

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "provider": "fallback",
        "total_cases": total,
        "passed": passed,
        "failed": failed,
        "intent_accuracy": ratio(sum(1 for result in intent_cases if result.intent_ok), len(intent_cases)),
        "save_answer_accuracy": ratio(sum(1 for result in save_cases if result.save_ok), len(save_cases)),
        "safety_accuracy": ratio(sum(1 for result in safety_cases if result.safety_ok), len(safety_cases)),
        "grounded_source_accuracy": ratio(sum(1 for result in grounding_cases if result.grounding_ok), len(grounding_cases)),
        "failures": failures,
        "cases": [
            {
                "id": result.id,
                "category": result.category,
                "language": result.language,
                "passed": result.passed,
                "reasons": result.reasons,
                "intent_ok": result.intent_ok,
                "save_ok": result.save_ok,
                "safety_ok": result.safety_ok,
                "grounding_ok": result.grounding_ok,
                "response_snapshot": result.response_snapshot,
            }
            for result in results
        ],
    }


def write_report(report: dict[str, Any]) -> None:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def print_summary(report: dict[str, Any]) -> None:
    print("AI chat evaluation")
    print(f"cases: {report['total_cases']}")
    print(f"passed: {report['passed']}")
    print(f"failed: {report['failed']}")
    print(f"intent_accuracy: {report['intent_accuracy']}")
    print(f"save_answer_accuracy: {report['save_answer_accuracy']}")
    print(f"safety_accuracy: {report['safety_accuracy']}")
    print(f"grounded_source_accuracy: {report['grounded_source_accuracy']}")
    print(f"report: {REPORT_PATH}")
    if report["failures"]:
        print("")
        print("Failures:")
        for failure in report["failures"]:
            print(f"- {failure['id']} ({failure['category']}, {failure['language']})")
            for reason in failure["reasons"]:
                print(f"  {reason}")


def main() -> int:
    args = parse_args()
    cases = load_cases(args.cases)
    if args.max_cases > 0:
        cases = cases[: args.max_cases]

    results = [evaluate_case(case) for case in cases]
    report = build_summary(results)
    write_report(report)
    print_summary(report)
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
