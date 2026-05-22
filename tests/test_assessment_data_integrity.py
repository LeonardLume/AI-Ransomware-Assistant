from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from backend.questions import (
    load_assessment_methodology,
    load_demo_profiles,
    load_questions,
    load_scoring_rationale,
    load_scoring_rules,
    load_source_registry,
    source_registry_map,
)
from backend.report import generate_report
from backend.scoring import calculate_scores


ROOT = Path(__file__).resolve().parents[1]


def test_question_ids_are_unique() -> None:
    question_ids = [question["id"] for question in load_questions()]
    assert len(question_ids) == len(set(question_ids))


def test_required_questions_have_scoring_rules() -> None:
    rules = load_scoring_rules()
    missing = [question["id"] for question in load_questions() if question.get("required", True) and question["id"] not in rules]
    assert missing == []


def test_scoring_rules_only_reference_existing_questions() -> None:
    question_ids = {question["id"] for question in load_questions()}
    missing = sorted(set(load_scoring_rules()) - question_ids)
    assert missing == []


def test_source_refs_resolve_through_source_registry() -> None:
    registry = source_registry_map()
    unresolved = []
    for question in load_questions():
        for ref_id in question.get("source_refs", []):
            if ref_id not in registry:
                unresolved.append((question["id"], ref_id))
    assert unresolved == []


def test_scoring_rationale_covers_all_scored_answers() -> None:
    rationale = load_scoring_rationale()
    for question_id, rule in load_scoring_rules().items():
        assert question_id in rationale
        assert set(rationale[question_id]) == set(rule)


def test_demo_profile_scores_remain_unchanged() -> None:
    profiles = load_demo_profiles()
    weak = calculate_scores(profiles["weak_sme"]["answers"])
    better = calculate_scores(profiles["better_sme"]["answers"])

    assert weak["overall_score"] == 24
    assert weak["domain_scores"] == {
        "incident_response": 18,
        "backups": 28,
        "mfa_access": 35,
        "patching": 24,
        "admin_rights": 24,
        "detection_monitoring": 12,
    }
    assert better["overall_score"] == 75
    assert better["domain_scores"] == {
        "incident_response": 57,
        "backups": 80,
        "mfa_access": 93,
        "patching": 85,
        "admin_rights": 74,
        "detection_monitoring": 63,
    }


def test_report_includes_methodology_version_and_ai_note() -> None:
    profile = load_demo_profiles()["better_sme"]["answers"]
    report = generate_report(profile)

    assert report["methodology"]["methodology_version"] == "0.3.0"
    assert "ametlikku skoori ei arvuta ega muuda AI" in report["report_text"]


def test_optional_hygiene_questions_remain_non_scoring() -> None:
    rules = load_scoring_rules()
    hygiene_questions = [
        question["id"]
        for question in load_questions()
        if question["domain"] == "employee_security_hygiene"
    ]
    assert hygiene_questions
    assert all(question_id not in rules for question_id in hygiene_questions)


def test_methodology_loader_returns_versions() -> None:
    methodology = load_assessment_methodology()
    assert methodology["methodology_version"] == "0.3.0"
    assert methodology["questions_version"] == "2026-05-22"
    assert methodology["scoring_version"] == "2026-05-22"


def test_validation_script_passes() -> None:
    result = subprocess.run(
        [sys.executable, "scripts/validate_assessment_data.py"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + "\n" + result.stderr
    assert "[OK]" in result.stdout


def test_source_registry_is_non_empty_and_has_stable_ids() -> None:
    registry = load_source_registry()
    ids = [item["id"] for item in registry]
    assert registry
    assert len(ids) == len(set(ids))
