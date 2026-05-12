"""Endpoint-level smoke test using FastAPI TestClient."""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app  # noqa: E402


client = TestClient(app)


def assert_ok(response, label: str) -> dict:
    assert response.status_code == 200, f"{label} failed: {response.status_code} {response.text}"
    return response.json()


def main() -> None:
    root = assert_ok(client.get("/"), "GET /")
    print("GET /:", root["status"], root["version"])

    provider = assert_ok(client.get("/provider/status"), "GET /provider/status")
    print("provider:", provider["provider"], provider["provider_ready"])

    start = assert_ok(client.post("/chat", json={"message": ""}), "POST /chat start")
    session_id = start["session_id"]
    print("session_id:", session_id)
    print("first_question:", start["current_question_id"])

    clarification = assert_ok(
        client.post("/chat", json={"session_id": session_id, "message": "Mida tähendab MFA?"}),
        "POST /chat clarification",
    )
    assert clarification["intent"] == "clarification"
    assert clarification["extracted_answers"] == {}
    print("clarification_intent:", clarification["intent"])

    answer = assert_ok(
        client.post(
            "/chat",
            json={
                "session_id": session_id,
                "message": "Meil on varukoopiad olemas, aga taastamist pole testitud.",
            },
        ),
        "POST /chat backup answer",
    )
    assert answer["extracted_answers"]["backups_exist"] == "yes"
    assert answer["extracted_answers"]["restore_tested"] == "no"
    print("extracted:", answer["extracted_answers"])

    questions = assert_ok(client.get("/questions"), "GET /questions")
    print("questions:", len(questions))

    score = assert_ok(client.get(f"/score/{session_id}"), "GET /score/{session_id}")
    print("score:", score["overall_score"], score["score_status"], score["completion_rate"])

    report = assert_ok(client.get(f"/report/{session_id}"), "GET /report/{session_id}")
    assert report["top_risks"]
    print("report:", report["overall_score"], report["risk_level"])

    print("OK")


if __name__ == "__main__":
    main()
