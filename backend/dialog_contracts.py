from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

DialogRoute = Literal[
    "save_assessment_answer",
    "ask_assessment_question",
    "explain_current_question",
    "answer_general_advisory",
    "answer_grounded_knowledge",
    "ask_clarifying_followup",
    "generate_report",
    "smalltalk",
    "refuse",
]

DialogAnswer = Literal["yes", "partial", "no", "unsure"]


class DialogDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    route: DialogRoute
    should_save_answer: bool
    should_advance_question: bool
    question_id: str | None = None
    answer: DialogAnswer | None = None
    needs_knowledge: bool
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str = ""
    soft_bridge_to_assessment: bool

    @model_validator(mode="after")
    def validate_contract(self) -> "DialogDecision":
        if self.route != "save_assessment_answer" and self.answer is not None:
            raise ValueError("answer must be null unless route == save_assessment_answer")

        if self.route in {
            "answer_general_advisory",
            "answer_grounded_knowledge",
            "ask_clarifying_followup",
            "smalltalk",
            "refuse",
            "explain_current_question",
        } and self.should_save_answer:
            raise ValueError("should_save_answer must be false for non-assessment routes")

        if self.route not in {"save_assessment_answer", "generate_report"} and self.should_advance_question:
            raise ValueError("should_advance_question must be false unless saving or generating report")

        return self


class DialogGraphState(BaseModel):
    model_config = ConfigDict(extra="allow")

    session_id: str
    message: str
    current_question_id: str | None = None
    current_question_text: str | None = None
    current_domain: str | None = None
    completion_rate: float = 0.0
    interview_complete: bool = False
    route: str | None = None
    decision: DialogDecision | None = None
    knowledge_sources: list[dict[str, Any]] = Field(default_factory=list)
    assistant_message: str | None = None
    provider: str | None = None
    used_fallback: bool = True
    safety_blocked: bool = False
    error: str | None = None
