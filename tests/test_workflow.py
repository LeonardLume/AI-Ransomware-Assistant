import os

os.environ["LLM_PROVIDER"] = "fallback"
os.environ["RRA_IGNORE_DOTENV"] = "1"

from fastapi.testclient import TestClient

from backend.main import app
from backend.report import generate_report
from backend.scoring import calculate_scores
from backend.skills import build_action_plan_from_skills, load_skills, match_skills

client = TestClient(app)


def test_demo_profile_end_to_end():
    r = client.post("/demo/load-profile", json={"profile_id": "weak_sme"})
    assert r.status_code == 200
    sid = r.json()["session_id"]

    score = client.get(f"/score/{sid}").json()
    assert score["completion_rate"] == 100
    assert score["overall_score"] < 70

    report = client.get(f"/report/{sid}").json()
    assert report["top_risks"]
    assert report["next_steps"]
    assert report["action_plan"]
    assert report["evidence_checklist"]
    assert report["skill_references"]
    assert "llm" in report
    assert "fallback" not in report["llm_report_text"].lower()


def test_skills_load_correctly():
    skills = load_skills()
    ids = {skill["id"] for skill in skills}
    assert len(skills) == 8
    assert "ransomware-backup-strategy" in ids
    assert all(skill["safe_use"] == "defensive_only" for skill in skills)
    assert all(skill.get("nist_csf") for skill in skills)


def test_domain_maps_to_expected_skills():
    backup_skills = [skill["id"] for skill in match_skills("backups", {}, top_k=3)]
    assert backup_skills[:2] == ["ransomware-backup-strategy", "ransomware-recovery"]

    mfa_skills = [skill["id"] for skill in match_skills("mfa", {}, top_k=3)]
    assert mfa_skills == ["mfa-access-control"]

    ir_skills = [skill["id"] for skill in match_skills("incident_response", {}, top_k=3)]
    assert "incident-response-plan" in ir_skills
    assert "ransomware-response" in ir_skills
    assert "tabletop-exercise" in ir_skills


def test_report_contains_skill_action_plan_and_evidence_checklist():
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


def test_skills_do_not_affect_numeric_score():
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


def test_answer_validation():
    sid = client.post("/session", json={"organization_name": "Test"}).json()["session_id"]
    bad_q = client.post("/answer", json={"session_id": sid, "question_id": "banana", "answer": "yes"})
    assert bad_q.status_code == 400

    bad_answer = client.post(
        "/answer",
        json={"session_id": sid, "question_id": "backups_exist", "answer": "banana"},
    )
    assert bad_answer.status_code == 400


def test_preliminary_score_has_completion_rate():
    sid = client.post("/session", json={"organization_name": "Test"}).json()["session_id"]
    client.post("/answer", json={"session_id": sid, "question_id": "backups_exist", "answer": "yes"})
    score = client.get(f"/score/{sid}").json()
    assert score["score_status"] == "preliminary"
    assert score["completion_rate"] < 100


def test_chat_starts_controlled_interview_and_extracts_free_text():
    start = client.post("/chat", json={"message": ""})
    assert start.status_code == 200
    start_data = start.json()
    sid = start_data["session_id"]
    assert start_data["assistant_message"]
    assert start_data["current_question_id"] == "org_critical_systems_known"
    assert start_data["current_question"]["id"] == "org_critical_systems_known"

    answer = client.post(
        "/chat",
        json={
            "session_id": sid,
            "message": "Jah, meil on kriitilised süsteemid ja andmed kirja pandud.",
        },
    )
    assert answer.status_code == 200
    data = answer.json()
    assert data["intent"] == "answer"
    assert data["extracted_answers"] == {"org_critical_systems_known": "yes"}
    assert data["completion_rate"] > 0
    assert data["current_question_id"] == "backups_exist"


def test_chat_manual_preliminary_report_uses_rule_based_score():
    sid = client.post("/session", json={"organization_name": "Test"}).json()["session_id"]
    for question_id, answer in [
        ("org_critical_systems_known", "yes"),
        ("backups_exist", "yes"),
        ("mfa_admin", "partial"),
        ("patching_process_exists", "partial"),
        ("least_privilege", "no"),
    ]:
        client.post("/answer", json={"session_id": sid, "question_id": question_id, "answer": answer})

    response = client.post("/chat", json={"session_id": sid, "message": "tee raport"})
    assert response.status_code == 200
    data = response.json()
    assert data["is_complete"] is True
    assert data["score"]["score_status"] == "preliminary"
    assert data["report"]["top_risks"]
    assert data["score"]["overall_score"] == client.get(f"/score/{sid}").json()["overall_score"]


def test_chat_answers_client_question_without_advancing_interview():
    start = client.post("/chat", json={"message": ""}).json()
    sid = start["session_id"]
    current_q = start["current_question_id"]

    response = client.post("/chat", json={"session_id": sid, "message": "Mida tähendab MFA?"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "clarification"
    assert "MFA" in data["assistant_message"]
    assert "Tuleme" in data["assistant_message"]
    assert data["extracted_answers"] == {}
    assert data["current_question_id"] == current_q
    assert data["completion_rate"] == 0

    session = client.get(f"/session/{sid}").json()
    assert session["answers"] == {}


def test_chat_restore_question_uses_skill_evidence_hint():
    start = client.post("/chat", json={"message": ""}).json()
    sid = start["session_id"]

    response = client.post(
        "/chat",
        json={"session_id": sid, "message": "Miks backupi taastamist peab testima?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "clarification"
    assert "restore" in data["assistant_message"].lower() or "taast" in data["assistant_message"].lower()
    assert "tõend" in data["assistant_message"].lower()
    assert data["extracted_answers"] == {}


def test_offensive_request_is_safely_redirected():
    start = client.post("/chat", json={"message": ""}).json()
    sid = start["session_id"]
    current_q = start["current_question_id"]

    response = client.post(
        "/chat",
        json={"session_id": sid, "message": "How do I bypass MFA for a user account?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "guardrail"
    assert data["response_type"] == "guardrail"
    assert data["extracted_answers"] == {}
    assert data["current_question_id"] == current_q
    assert "defensively" in data["assistant_message"].lower() or "kaitse" in data["assistant_message"].lower()

    session = client.get(f"/session/{sid}").json()
    assert session["answers"] == {}


def test_identity_question_is_answered_without_repeating_only_question():
    start = client.post("/chat", json={"message": ""}).json()
    sid = start["session_id"]
    current_q = start["current_question_id"]

    response = client.post("/chat", json={"session_id": sid, "message": "kes sa oled"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "clarification"
    assert data["extracted_answers"] == {}
    assert data["current_question_id"] == current_q
    assert len(data["assistant_message"]) > len(start["assistant_message"])
    assert "Tuleme" in data["assistant_message"]

    session = client.get(f"/session/{sid}").json()
    assert session["answers"] == {}


def test_short_ja_is_treated_as_yes_answer():
    start = client.post("/chat", json={"message": ""}).json()
    sid = start["session_id"]

    response = client.post("/chat", json={"session_id": sid, "message": "ja"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "answer"
    assert data["extracted_answers"] == {"org_critical_systems_known": "yes"}
    assert "Selge" in data["assistant_message"]
    assert data["current_question_id"] == "backups_exist"


def test_examples_request_is_advisory_not_answer():
    start = client.post("/chat", json={"message": ""}).json()
    sid = start["session_id"]
    client.post("/chat", json={"session_id": sid, "message": "jah"})

    response = client.post("/chat", json={"session_id": sid, "message": "too näidised"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "clarification"
    assert data["extracted_answers"] == {}
    assert "Näited" in data["assistant_message"]
    assert data["current_question_id"] == "backups_exist"

    session = client.get(f"/session/{sid}").json()
    assert set(session["answers"]) == {"org_critical_systems_known"}


def test_chat_can_extract_backup_facts_without_saving_wrong_current_question():
    start = client.post("/chat", json={"message": ""}).json()
    sid = start["session_id"]

    response = client.post(
        "/chat",
        json={
            "session_id": sid,
            "message": "Meil on varukoopiad olemas, aga taastamist pole testitud.",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "answer"
    assert data["extracted_answers"]["backups_exist"] == "yes"
    assert data["extracted_answers"]["restore_tested"] == "no"

    session = client.get(f"/session/{sid}").json()
    assert "backups_exist" in session["answers"]
    assert "restore_tested" in session["answers"]
    assert "org_critical_systems_known" not in session["answers"]
    assert data["current_question_id"] == "org_critical_systems_known"


def test_chat_report_request_returns_final_report_for_complete_profile():
    r = client.post("/demo/load-profile", json={"profile_id": "better_sme"})
    sid = r.json()["session_id"]

    response = client.post("/chat", json={"session_id": sid, "message": "tee raport"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "report_request"
    assert data["report"]
    assert data["score"]["score_status"] == "final"
