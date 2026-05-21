from backend.dialog_contracts import DialogDecision
from backend.dialog_policy import apply_dialog_policy


def test_invalid_dialog_decision_cannot_save_answer():
    decision = DialogDecision(
        route="save_assessment_answer",
        should_save_answer=True,
        should_advance_question=True,
        question_id=None,
        answer="yes",
        needs_knowledge=False,
        confidence=0.8,
        reason="try save",
        soft_bridge_to_assessment=False,
    )

    applied = apply_dialog_policy(decision, {"current_question_id": None}, "yes")

    assert applied.route == "ask_clarifying_followup"
    assert applied.should_save_answer is False


def test_low_confidence_save_becomes_clarifying_followup():
    decision = DialogDecision(
        route="save_assessment_answer",
        should_save_answer=True,
        should_advance_question=True,
        question_id="backups_exist",
        answer="yes",
        needs_knowledge=False,
        confidence=0.4,
        reason="weak signal",
        soft_bridge_to_assessment=False,
    )

    applied = apply_dialog_policy(decision, {"current_question_id": "backups_exist"}, "yes")

    assert applied.route == "ask_clarifying_followup"
    assert applied.should_save_answer is False
