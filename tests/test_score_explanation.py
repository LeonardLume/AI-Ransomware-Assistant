from __future__ import annotations

from backend.report import generate_report
from backend.scoring import calculate_scores, explain_score


def test_explain_score_returns_points_and_matches_official_score() -> None:
    answers = {
        "backups_exist": {"answer": "yes", "details": ""},
        "restore_tested": {"answer": "no", "details": ""},
        "mfa_admin": {"answer": "partial", "details": ""},
    }

    score = calculate_scores(answers)
    explanation = explain_score(answers)

    assert explanation["overall_score"] == score["overall_score"]
    assert explanation["score_status"] == score["score_status"]

    backups = next(domain for domain in explanation["domains"] if domain["domain"] == "backups")
    restore = next(item for item in backups["questions"] if item["question_id"] == "restore_tested")

    assert restore["answer"] == "no"
    assert restore["points_awarded"] == 0
    assert restore["max_points"] == 30
    assert restore["points_lost"] == 30
    assert restore["rationale"]
    assert restore["deduction_explanation"]
    assert restore["source_refs"]
    assert restore["framework_mappings"]
    assert restore["evidence_examples"]


def test_explain_score_does_not_recalculate_with_different_values() -> None:
    answers = {
        "backups_exist": {"answer": "partial", "details": ""},
        "backup_frequency_defined": {"answer": "yes", "details": ""},
        "restore_tested": {"answer": "partial", "details": ""},
    }

    score = calculate_scores(answers)
    explanation = explain_score(answers)

    backup_domain = next(domain for domain in explanation["domains"] if domain["domain"] == "backups")
    expected_earned = 10 + 15 + 15
    expected_max = 20 + 15 + 30 + 25 + 10

    assert backup_domain["earned_points"] == expected_earned
    assert backup_domain["max_points"] == expected_max
    assert backup_domain["score"] == score["domain_scores"]["backups"]


def test_report_contains_score_explanation_and_methodology() -> None:
    answers = {
        "backups_exist": {"answer": "yes", "details": ""},
        "restore_tested": {"answer": "no", "details": ""},
        "backup_isolated": {"answer": "no", "details": ""},
    }

    report = generate_report(answers)

    assert report["methodology"]["methodology_name"] == "Ransomware Readiness Assessment"
    assert report["score_explanation"]["methodology_version"] == "0.3.0"
    assert report["score_explanation"]["domains"]

    finding = next(item for item in report["findings"] if item["id"] == "finding_restore_capability_unproven")
    assert finding["source_refs"]
    assert finding["framework_mappings"]
    assert finding["scoring_rationale_summary"]
    assert finding["evidence_examples"]

    risk = report["top_risks"][0]
    assert risk["source_refs"]
    assert risk["framework_mappings"]
    assert risk["scoring_rationale_summary"]
