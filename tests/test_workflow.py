import json
import os

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

import pytest
from fastapi.testclient import TestClient

import backend.main as main_module
from backend.llm_client import LLMResult
from backend.main import app
from backend.redaction import has_sensitive_data, redact_sensitive_text
from backend.report import generate_report
from backend.scoring import calculate_scores
from backend.security import RATE_LIMITER
from backend.skills import build_action_plan_from_skills, load_skills, match_skills
from backend.storage import load_session

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_runtime_env(monkeypatch: pytest.MonkeyPatch):
    for key in [
        "API_AUTH_TOKEN",
        "RATE_LIMIT_CHAT_PER_MINUTE",
        "RATE_LIMIT_REPORT_PER_MINUTE",
        "RATE_LIMIT_DEMO_PER_MINUTE",
        "TRUST_PROXY_HEADERS",
    ]:
        monkeypatch.delenv(key, raising=False)
    RATE_LIMITER.clear()
    yield
    RATE_LIMITER.clear()


def test_demo_profile_end_to_end():
    response = client.post("/demo/load-profile", json={"profile_id": "weak_sme"})
    assert response.status_code == 200
    sid = response.json()["session_id"]

    score = client.get(f"/score/{sid}").json()
    report = client.get(f"/report/{sid}").json()

    assert score["completion_rate"] == 100
    assert score["overall_score"] < 70
    assert report["top_risks"]
    assert report["action_plan"]
    assert report["evidence_checklist"]
    assert report["llm"]["provider"] == "backend_rule_based"
    assert report["llm"]["used_real_llm"] is False


def test_report_is_cached_per_session_until_answers_change(monkeypatch: pytest.MonkeyPatch):
    sid = client.post("/session", json={"organization_name": "Test"}).json()["session_id"]
    save = client.post("/answer", json={"session_id": sid, "question_id": "backups_exist", "answer": "yes"})
    assert save.status_code == 200

    call_count = 0
    real_generate_report = main_module.generate_report

    def tracked_generate_report(*args: object, **kwargs: object):
        nonlocal call_count
        call_count += 1
        return real_generate_report(*args, **kwargs)

    monkeypatch.setattr(main_module, "generate_report", tracked_generate_report)

    first = client.get(f"/report/{sid}")
    second = client.get(f"/report/{sid}")
    session_data = client.get(f"/session/{sid}")

    assert first.status_code == 200
    assert second.status_code == 200
    assert session_data.status_code == 200
    assert call_count == 1
    assert first.json() == second.json()
    assert session_data.json()["report"] == first.json()

    changed = client.post("/answer", json={"session_id": sid, "question_id": "restore_tested", "answer": "no"})
    assert changed.status_code == 200
    assert client.get(f"/session/{sid}").json()["report"] is None

    third = client.get(f"/report/{sid}")
    assert third.status_code == 200
    assert call_count == 2


def test_skills_load_correctly():
    skills = load_skills()
    ids = {skill["id"] for skill in skills}
    assert len(skills) == 11
    assert "ransomware-backup-strategy" in ids
    assert "detection-monitoring" in ids
    assert "employee-security-hygiene" in ids
    assert "external-exposure-self-check" in ids
    assert all(skill["safe_use"] == "defensive_only" for skill in skills)
    assert all(skill.get("nist_csf") for skill in skills)


def test_domain_maps_to_expected_skills():
    backup_skills = [skill["id"] for skill in match_skills("backups", {}, top_k=3)]
    assert backup_skills[:2] == ["ransomware-backup-strategy", "ransomware-recovery"]

    mfa_skills = [skill["id"] for skill in match_skills("mfa", {}, top_k=3)]
    assert mfa_skills == ["mfa-access-control"]

    detection_skills = [skill["id"] for skill in match_skills("detection_monitoring", {}, top_k=3)]
    assert detection_skills == ["detection-monitoring"]


def test_report_contains_action_plan_and_evidence_checklist():
    answers = {
        "backups_exist": {"answer": "yes", "details": ""},
        "restore_tested": {"answer": "no", "details": ""},
        "backup_isolated": {"answer": "no", "details": ""},
    }

    report = generate_report(answers, {"organization_name": "Test"})

    assert report["action_plan"]
    assert report["evidence_checklist"]
    assert any(item["based_on_skill"] == "ransomware-backup-strategy" for item in report["action_plan"])
    assert any(group["based_on_skill"] == "ransomware-backup-strategy" for group in report["evidence_checklist"])


def test_report_sections_do_not_affect_numeric_score():
    answers = {
        "backups_exist": {"answer": "yes", "details": ""},
        "restore_tested": {"answer": "no", "details": ""},
        "mfa_admin": {"answer": "partial", "details": ""},
    }
    score_before = calculate_scores(answers)
    action_plan = build_action_plan_from_skills(score_before, answers)
    score_after = calculate_scores(answers)
    report = generate_report(answers)

    assert action_plan
    assert score_after == score_before
    assert report["overall_score"] == score_before["overall_score"]
    assert report["domain_scores"] == score_before["domain_scores"]


def test_llm_rewrites_action_plan_text_without_changing_structure(monkeypatch: pytest.MonkeyPatch):
    answers = {
        "backups_exist": {"answer": "yes", "details": ""},
        "restore_tested": {"answer": "no", "details": "Restore test has not been run."},
        "backup_isolated": {"answer": "no", "details": ""},
    }
    score_before = calculate_scores(answers)
    base_plan = build_action_plan_from_skills(score_before, answers)
    assert base_plan

    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

    from backend import action_plan_llm

    def fake_generate_text(*_: object, **__: object) -> LLMResult:
        return LLMResult(
            text=json.dumps(
                {
                    "action_plan": [
                        {
                            "id": 0,
                            "title": "Run a controlled restore test and record the result",
                            "owner_suggestion": "IT / MSP",
                            "deadline": "14 days",
                            "effort": "Medium",
                            "evidence_required": ["Restore test report", "List of restored systems"],
                        }
                    ]
                }
            ),
            provider="openai",
            model="gpt-test",
            used_real_llm=True,
        )

    monkeypatch.setattr(action_plan_llm, "generate_text", fake_generate_text)

    report = generate_report(answers, {"organization_name": "Test"})
    first = report["action_plan"][0]

    assert first["title"] == "Run a controlled restore test and record the result"
    assert first["owner_suggestion"] == "IT / MSP"
    assert first["domain"] == base_plan[0]["domain"]
    assert first["based_on_skill"] == base_plan[0]["based_on_skill"]
    assert report["next_steps"][0] == "Run a controlled restore test and record the result"
    assert report["llm"]["provider"] == "openai"
    assert report["llm"]["used_real_llm"] is True


def test_redaction_redacts_email_ip_and_secret():
    text = "Contact admin@example.com, VPN 203.0.113.10, api_key=secret123."
    redacted, applied = redact_sensitive_text(text)

    assert "[EMAIL]" in redacted
    assert "[IP_ADDRESS]" in redacted
    assert "[SECRET]" in redacted
    assert {"EMAIL", "IP_ADDRESS", "SECRET"}.issubset(set(applied))
    assert has_sensitive_data(text) is True


def test_answer_validation():
    sid = client.post("/session", json={"organization_name": "Test"}).json()["session_id"]

    bad_q = client.post("/answer", json={"session_id": sid, "question_id": "banana", "answer": "yes"})
    bad_answer = client.post("/answer", json={"session_id": sid, "question_id": "backups_exist", "answer": "banana"})

    assert bad_q.status_code == 400
    assert bad_answer.status_code == 400


def test_preliminary_score_has_completion_rate():
    sid = client.post("/session", json={"organization_name": "Test"}).json()["session_id"]
    client.post("/answer", json={"session_id": sid, "question_id": "backups_exist", "answer": "yes"})

    score = client.get(f"/score/{sid}").json()

    assert score["score_status"] == "preliminary"
    assert score["completion_rate"] < 100


def test_session_storage_tracks_version_and_timestamps():
    sid = client.post("/session", json={"organization_name": "Test"}).json()["session_id"]
    state = load_session(sid)
    assert state is not None
    assert state.version >= 1
    assert state.created_at
    assert state.updated_at

    client.post("/answer", json={"session_id": sid, "question_id": "backups_exist", "answer": "yes"})
    updated_state = load_session(sid)
    assert updated_state is not None
    assert updated_state.version > state.version
    assert updated_state.updated_at >= updated_state.created_at


def test_chat_starts_interview_and_quick_answer_still_works():
    start = client.post("/chat", json={"message": ""})
    assert start.status_code == 200
    start_data = start.json()
    sid = start_data["session_id"]
    assert start_data["current_question_id"] == "org_critical_systems_known"

    answer = client.post(
        "/chat",
        json={
            "session_id": sid,
            "message": "Yes",
            "intent_mode": "direct_answer",
            "selected_answer": "yes",
        },
    )
    assert answer.status_code == 200
    data = answer.json()
    assert data["response_type"] == "interview_answer"
    assert data["extracted_answers"] == {"org_critical_systems_known": "yes"}


def test_external_exposure_checklist_endpoint_works():
    response = client.get("/external-exposure/checklist")
    assert response.status_code == 200
    data = response.json()
    assert data["scanning_performed"] is False
    assert data["external_services_queried"] is False
    assert data["items"]


def test_security_agent_profile_is_defensive_and_bounded():
    response = client.get("/security-agent/profile")
    assert response.status_code == 200
    data = response.json()

    assert data["name"] == "Ransomware Readiness Security Agent"
    assert data["framework_status"]["package"] == "cai-framework"
    assert data["framework_status"]["execution_enabled"] is False
    assert any(agent["id"] == "safety_reviewer" for agent in data["agents"])
    assert "exploit execution" in data["inspiration"]["not_enabled"]
    assert any("backend-owned" in guardrail for guardrail in data["guardrails"])


def test_cai_bridge_is_optional_and_never_executes_tools(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CAI_AGENT_ENABLED", raising=False)
    monkeypatch.delenv("CAI_ALLOW_TOOL_EXECUTION", raising=False)

    response = client.get("/security-agent/cai")
    assert response.status_code == 200
    data = response.json()

    assert data["name"] == "CAI Defensive Bridge"
    assert data["status"]["package"] == "cai-framework"
    assert data["status"]["enabled"] is False
    assert data["status"]["execution_enabled"] is False
    assert "exploit_execution" in data["status"]["blocked_capabilities"]
    assert any("structured interview remains" in rule for rule in data["routing_policy"])


def test_auth_can_be_enabled_without_touching_public_healthcheck(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("API_AUTH_TOKEN", "topsecret")

    assert client.get("/").status_code == 200
    assert client.post("/session", json={"organization_name": "Test"}).status_code == 401

    authorized = client.post(
        "/session",
        json={"organization_name": "Test"},
        headers={"Authorization": "Bearer topsecret"},
    )
    assert authorized.status_code == 200


def test_cors_preflight_allows_vite_fallback_port_when_auth_enabled(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("API_AUTH_TOKEN", "topsecret")

    response = client.options(
        "/questions",
        headers={
            "Origin": "http://localhost:5174",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5174"
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_chat_rate_limit_returns_429(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("RATE_LIMIT_CHAT_PER_MINUTE", "1")

    first = client.post("/chat", json={"message": ""})
    second = client.post("/chat", json={"message": ""})

    assert first.status_code == 200
    assert second.status_code == 429
