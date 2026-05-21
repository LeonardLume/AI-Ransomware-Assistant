from __future__ import annotations

import logging
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

LOGGER = logging.getLogger(__name__)

IntentName = Literal[
    "interview_answer",
    "clarification",
    "general_advisory_chat",
    "knowledge_grounded_answer",
    "report_request",
    "smalltalk",
    "guardrail",
    "unknown",
]

AssessmentAnswer = Literal["yes", "partial", "no", "unsure"]
ChatDecisionAction = Literal[
    "save_answer",
    "answer_clarification",
    "answer_advisory",
    "keep_context",
    "ask_confirmation",
    "generate_report",
    "smalltalk",
    "refuse",
]


class ChatDecisionModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: ChatDecisionAction
    normalized_answer: AssessmentAnswer | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reason: str = ""
    user_visible_response: str = ""
    should_advance_question: bool = False
    should_save_answer: bool = False

    @field_validator("reason", "user_visible_response")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_answer_policy(self) -> "ChatDecisionModel":
        if self.action == "save_answer" and self.normalized_answer is None:
            raise ValueError("save_answer requires normalized_answer.")
        if self.should_save_answer and self.normalized_answer is None:
            raise ValueError("should_save_answer requires normalized_answer.")
        if self.action != "save_answer" and self.should_save_answer and self.normalized_answer is None:
            raise ValueError("normalized_answer must be present when should_save_answer is true.")
        return self


class IntentDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: IntentName
    should_save_answer: bool
    question_id: str | None = None
    answer: AssessmentAnswer | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reason: str = ""
    needs_knowledge: bool = False

    @field_validator("question_id")
    @classmethod
    def strip_question_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_answer_fields(self) -> "IntentDecision":
        if self.should_save_answer and (self.question_id is None or self.answer is None):
            raise ValueError("Saving an answer requires both question_id and answer.")
        if not self.should_save_answer and self.answer is not None and self.question_id is None:
            raise ValueError("answer cannot be set without question_id.")
        return self


class ExtractedAssessmentAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str
    answer: AssessmentAnswer
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    details: str = ""
    should_advance: bool = True

    @field_validator("question_id")
    @classmethod
    def validate_question_id(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("question_id must not be empty.")
        return cleaned

    @field_validator("details")
    @classmethod
    def normalize_details(cls, value: str) -> str:
        return value.strip()


class GroundedAnswerQuality(BaseModel):
    model_config = ConfigDict(extra="forbid")

    used_knowledge: bool
    source_count: int = Field(ge=0)
    missing_context: bool
    safety_blocked: bool
    answer_language: str

    @field_validator("answer_language")
    @classmethod
    def validate_answer_language(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("answer_language must not be empty.")
        return cleaned


def validate_intent_decision(data: Any) -> IntentDecision | None:
    return _validate_model(IntentDecision, data, "IntentDecision")


def validate_chat_decision(data: Any) -> ChatDecisionModel | None:
    return _validate_model(ChatDecisionModel, data, "ChatDecisionModel")


def validate_extracted_answer(data: Any) -> ExtractedAssessmentAnswer | None:
    return _validate_model(ExtractedAssessmentAnswer, data, "ExtractedAssessmentAnswer")


def validate_grounded_answer_quality(data: Any) -> GroundedAnswerQuality | None:
    return _validate_model(GroundedAnswerQuality, data, "GroundedAnswerQuality")


def _validate_model(model: type[BaseModel], data: Any, label: str) -> Any | None:
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        LOGGER.warning("%s validation failed: %s", label, exc)
        return None
