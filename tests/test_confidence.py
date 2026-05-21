from backend.confidence import (
    _record_confidence,
    calculate_domain_confidence,
    calculate_overall_confidence,
)


def test_explicit_quick_yes_is_high():
    assert _record_confidence({"answer": "yes", "source": "quick_answer", "confidence": 1.0}) == "High"


def test_explicit_quick_no_is_high():
    assert _record_confidence({"answer": "no", "source": "quick_answer", "confidence": 1.0}) == "High"


def test_explicit_quick_partial_is_high():
    assert _record_confidence({"answer": "partial", "source": "quick_answer", "confidence": 1.0}) == "High"


def test_explicit_quick_unsure_is_low():
    assert _record_confidence({"answer": "unsure", "source": "quick_answer", "confidence": 1.0}) == "Low"


def test_ai_interview_no_with_high_numeric_confidence_is_high():
    assert _record_confidence({"answer": "no", "source": "ai_interview", "confidence": 0.92}) == "High"


def test_ai_interview_partial_with_medium_numeric_confidence_is_medium():
    assert _record_confidence({"answer": "partial", "source": "ai_interview", "confidence": 0.7}) == "Medium"


def test_ai_interview_yes_with_low_numeric_confidence_is_low():
    assert _record_confidence({"answer": "yes", "source": "ai_interview", "confidence": 0.4}) == "Low"


def test_evidence_indicators_raise_confidence_to_high():
    record = {"answer": "partial", "details": "Report dated 2026-05-20 with screenshots and audit log."}
    assert _record_confidence(record) == "High"


def test_no_without_evidence_defaults_to_medium():
    assert _record_confidence({"answer": "no", "details": ""}) == "Medium"


def test_non_question_records_do_not_affect_confidence():
    answer_records = {
        "backups_exist": {"answer": "yes", "source": "quick_answer", "confidence": 1.0},
        "context_note__1": {"answer": "no", "source": "manual", "confidence": 1.0},
    }

    assert calculate_domain_confidence(answer_records) == {"backups": "High"}
    assert calculate_overall_confidence(answer_records) == "High"


def test_followup_answers_are_ignored():
    answer_records = {
        "backups_exist": {"answer": "yes", "source": "quick_answer", "confidence": 1.0},
        "followup__backups_exist": {"answer": "no", "source": "manual", "confidence": 1.0},
    }

    assert calculate_domain_confidence(answer_records) == {"backups": "High"}
    assert calculate_overall_confidence(answer_records) == "High"
