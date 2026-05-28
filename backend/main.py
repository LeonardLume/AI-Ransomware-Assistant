from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.adaptive import (
    decide_followup,
    get_next_required_question,
    make_followup_question,
)
from backend.ai_trace import (
    trace_answer_saved,
    trace_guardrail,
    trace_intent_decision,
)
from backend.cai_adapter import cai_security_manifest
from backend.chat import ChatController
from backend.chat.transparency import build_assistant_transparency
from backend.chat_interview import (
    answer_client_question_with_llm,
    answer_general_advisory_with_llm,
    answer_smalltalk_with_llm,
    decide_chat_turn_with_llm,
    defensive_refusal,
    detect_language,
    extract_answers_with_llm,
    generate_next_question,
    infer_explicit_short_answer,
    is_acknowledgement_or_smalltalk,
    looks_like_offensive_request,
    missing_domain_labels,
    missing_required_question_ids,
    next_missing_question,
    should_generate_preliminary_report,
)
from backend.config import (
    ai_fallback_user_visible,
    allow_scripted_ai_fallback,
    get_cors_settings,
    get_security_settings,
    llm_status,
    use_langgraph_dialog,
)
from backend.dialog_contracts import DialogGraphState

try:
    from backend.dialog_graph import run_dialog_graph
except ModuleNotFoundError:
    run_dialog_graph = None

from backend.dialog_intent import classify_dialog_intent
from backend.exposure import build_external_exposure_self_check
from backend.hygiene import load_employee_hygiene_checklist
from backend.prompt_firewall import detect_prompt_injection, safe_prompt_injection_response
from backend.questions import (
    load_demo_profiles,
    load_questions,
    load_source_notes,
    question_map,
)
from backend.report import generate_report
from backend.scoring import calculate_scores
from backend.security import (
    RATE_LIMITER,
    is_public_path,
    is_request_authorized,
    resolve_client_ip,
)
from backend.security_agent import security_agent_profile
from backend.storage import SessionConflictError, SessionState, load_session, save_session

app = FastAPI(
    title="Ransomware Readiness Assistant",
    description="MVP: adaptive ransomware-readiness interview, rule-based scoring, optional LLM report layer.",
    version="0.2.0-mvp",
)

CHAT_CONTROLLER = ChatController()

PUBLIC_PATH_PREFIXES = {
    "/",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/llm/status",
    "/provider/status",
}

cors_settings = get_cors_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_settings["allow_origins"],
    allow_origin_regex=cors_settings["allow_origin_regex"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(SessionConflictError)
def handle_session_conflict(_: Request, exc: SessionConflictError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.middleware("http")
async def protect_and_rate_limit(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-ID") or str(uuid4())
    if request.method == "OPTIONS":
        return await call_next(request)

    settings = get_security_settings()
    path = request.url.path

    if settings["auth_enabled"] and not is_public_path(path, PUBLIC_PATH_PREFIXES):
        expected_token = str(settings["api_auth_token"])
        if not is_request_authorized(request, expected_token):
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    rate_limit = _rate_limit_for_path(path, settings)
    if rate_limit > 0:
        client_ip = resolve_client_ip(
            request,
            trust_proxy_headers=bool(settings["trust_proxy_headers"]),
        )
        retry_after = RATE_LIMITER.check(
            key=f"{path}:{client_ip}",
            limit=rate_limit,
        )
        if retry_after is not None:
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(retry_after)},
                content={"detail": "Rate limit exceeded. Please retry shortly."},
            )

    return await call_next(request)


class SessionCreateIn(BaseModel):
    organization_name: str | None = None
    organization_size: str | None = None
    it_model: str | None = None
    critical_systems: str | None = None


class AnswerIn(BaseModel):
    session_id: str | None = None
    question_id: str
    answer: str = Field(..., description="One of: yes, partial, no, unsure")
    details: str = ""


class FreeTextAnswerIn(BaseModel):
    session_id: str
    question_id: str
    text: str


class DemoProfileIn(BaseModel):
    profile_id: str = "weak_sme"


class ChatIn(BaseModel):
    session_id: str | None = None
    message: str = ""
    intent_mode: str | None = None
    selected_answer: str | None = None


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "ransomware-readiness",
        "version": "0.2.0-mvp",
        "docs": "/docs",
        "llm": llm_status(),
    }


@app.get("/llm/status")
def get_llm_status():
    return llm_status()


@app.get("/provider/status")
def get_provider_status():
    return llm_status()


@app.post("/session")
def create_session(payload: SessionCreateIn | None = None):
    sid = str(uuid4())
    org_info = payload.model_dump(exclude_none=True) if payload else {}
    state = SessionState(session_id=sid, org_info=org_info)
    save_session(state)
    return {"session_id": sid, "org_info": org_info}


@app.get("/questions")
def get_questions():
    return load_questions()


@app.get("/sources")
def get_sources():
    return load_source_notes()


@app.get("/demo-profiles")
def get_demo_profiles():
    profiles = load_demo_profiles()
    return {pid: {"name": p["name"], "org_info": p["org_info"]} for pid, p in profiles.items()}


@app.post("/demo/load-profile")
def load_demo_profile(payload: DemoProfileIn):
    profiles = load_demo_profiles()
    if payload.profile_id not in profiles:
        raise HTTPException(status_code=404, detail="Demo profile not found")
    profile = profiles[payload.profile_id]
    sid = str(uuid4())
    state = SessionState(session_id=sid, org_info=profile["org_info"])
    state.answers = profile["answers"]
    state.report = None
    state.events.append({"type": "demo_profile_loaded", "profile_id": payload.profile_id})
    save_session(state)
    return {"session_id": sid, "profile_name": profile["name"], "org_info": state.org_info}


@app.post("/chat")
def chat(payload: ChatIn, request: Request):
    state, is_new = _get_or_create_chat_state(payload.session_id)
    message = payload.message.strip()
    user_message_recorded = False
    request_id = getattr(request.state, "request_id", "")

    if is_new and message:
        state.chat_history.append({"role": "user", "content": message})
        user_message_recorded = True

    if message and not user_message_recorded:
        state.chat_history.append({"role": "user", "content": message})
        user_message_recorded = True

    base_answers = _base_answers_only(state.answers)
    qmap = question_map()
    current_question = qmap.get(state.current_question_id or "")
    if current_question is None or current_question["id"] in base_answers:
        current_question = next_missing_question(base_answers)

    simplified_response = _chat_simplified_flow(
        state=state,
        is_new=is_new,
        message=message,
        request_id=request_id,
        current_question=current_question,
        base_answers=base_answers,
        intent_mode=payload.intent_mode,
        selected_answer=payload.selected_answer,
    )
    if simplified_response is None:
        raise RuntimeError("Simplified chat flow did not return a response.")
    return simplified_response

    routed_response = _handle_preclassified_dialog_intent(
        state=state,
        is_new=is_new,
        message=message,
        request_id=request_id,
        current_question=current_question,
        base_answers=base_answers,
        intent_mode=payload.intent_mode or "auto",
        selected_answer=payload.selected_answer,
    )
    if routed_response is not None:
        return routed_response

    if use_langgraph_dialog():
        return _chat_via_dialog_graph(
            state=state,
            is_new=is_new,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
        )

    decision = CHAT_CONTROLLER.decide_action(
        message=message,
        is_new_session=is_new,
        current_question=current_question,
    )
    trace_intent_decision(
        session_id=state.session_id,
        request_id=request_id,
        intent=decision.intent,
        response_type=decision.action,
        provider="router",
        used_fallback=False,
        current_question_id=(current_question or {}).get("id"),
        current_domain=(current_question or {}).get("domain"),
        user_message=message,
        should_save_answer=decision.action == "extract_answer",
        confidence=decision.intent_confidence,
    )

    if decision.action == "prompt_injection_blocked":
        state.events.append(
            {
                "type": "prompt_injection_blocked",
                "reason": decision.prompt_injection_reason,
                "current_question_id": state.current_question_id,
            }
        )
        trace_guardrail(
            session_id=state.session_id,
            request_id=request_id,
            response_type="prompt_injection_blocked",
            provider="guardrail",
            used_fallback=True,
            current_question_id=(current_question or {}).get("id"),
            current_domain=(current_question or {}).get("domain"),
            user_message=message,
        )
        return _chat_response(
            state,
            assistant_message=safe_prompt_injection_response(_language_code(message)),
            extracted_answers={},
            score=None,
            report=None,
            provider="guardrail",
            used_fallback=True,
            response_type="prompt_injection_blocked",
            intent=decision.intent,
            action=decision.action,
            intent_confidence=decision.intent_confidence,
            prompt_injection_blocked=True,
            prompt_injection_reason=decision.prompt_injection_reason,
            redactions_applied=[],
            redacted_for_llm=False,
        )

    if decision.action == "ask_next_question":
        if not base_answers:
            return _ask_next_chat_question(
                state,
                greeting=True,
                assistant_prefix="Tere! Viin sind lühidalt läbi lunavara valmisoleku intervjuu.",
                intent=decision.intent,
                action=decision.action,
                intent_confidence=decision.intent_confidence,
            )
        return _ask_next_chat_question(
            state,
            greeting=False,
            intent=decision.intent,
            action=decision.action,
            intent_confidence=decision.intent_confidence,
        )

    if decision.action == "guardrail_refusal":
        if current_question is not None:
            state.current_question_id = current_question["id"]
            state.current_domain = current_question["domain"]
        guardrail = defensive_refusal(message, current_question)
        state.events.append(
            {
                "type": "guardrail_refusal",
                "current_question_id": (current_question or {}).get("id"),
                "provider": guardrail.get("provider", "guardrail"),
            }
        )
        trace_guardrail(
            session_id=state.session_id,
            request_id=request_id,
            response_type="guardrail",
            provider=guardrail.get("provider", "guardrail"),
            used_fallback=True,
            current_question_id=(current_question or {}).get("id"),
            current_domain=(current_question or {}).get("domain"),
            user_message=message,
        )
        return _chat_response(
            state,
            assistant_message=guardrail["message"],
            extracted_answers={},
            score=None,
            report=None,
            provider=guardrail.get("provider", "guardrail"),
            used_fallback=True,
            response_type="guardrail",
            intent=decision.intent,
            action=decision.action,
            intent_confidence=decision.intent_confidence,
        )

    intent = decision.intent

    if decision.action == "finish_or_continue_report":
        return _finish_or_continue_chat(
            state,
            intent=intent,
            action=decision.action,
            intent_confidence=decision.intent_confidence,
            language=_language_code(message),
        )

    if current_question is None:
        return _complete_chat(
            state,
            completion_mode="full",
            intent=intent,
            action="complete_chat",
            intent_confidence=decision.intent_confidence,
        )

    if decision.action == "answer_general_advisory":
        advisory = answer_general_advisory_with_llm(
            user_message=message,
            current_question=current_question,
            current_answers=base_answers,
            org_info=state.org_info,
            trace_context=_trace_context(state, request_id, current_question, message),
        )
        state.events.append(
            {
                "type": "general_advisory_chat",
                "current_question_id": state.current_question_id,
                "provider": advisory.get("provider", "fallback"),
                "used_fallback": advisory.get("used_fallback", True),
            }
        )
        return _chat_response(
            state,
            assistant_message=advisory["message"],
            extracted_answers={},
            score=None,
            report=None,
            provider=advisory.get("provider", "fallback"),
            used_fallback=advisory.get("used_fallback", True),
            response_type="general_advisory_chat",
            intent=decision.intent,
            action=decision.action,
            intent_confidence=decision.intent_confidence,
            redactions_applied=advisory.get("redactions_applied", []),
            redacted_for_llm=bool(advisory.get("redacted_for_llm", False)),
        )

    if decision.action == "answer_clarification":
        state.current_question_id = current_question["id"]
        state.current_domain = current_question["domain"]
        advisory = answer_client_question_with_llm(
            user_message=message,
            current_question=current_question,
            current_answers=base_answers,
            org_info=state.org_info,
            trace_context=_trace_context(state, request_id, current_question, message),
        )
        state.events.append(
            {
                "type": "client_question_answered",
                "current_question_id": current_question["id"],
                "provider": advisory.get("provider", "fallback"),
                "used_fallback": advisory.get("used_fallback", True),
            }
        )
        return _chat_response(
            state,
            assistant_message=advisory["message"],
            extracted_answers={},
            score=None,
            report=None,
            provider=advisory.get("provider", "fallback"),
            used_fallback=advisory.get("used_fallback", True),
            response_type="client_question",
            intent=intent,
            action=decision.action,
            intent_confidence=decision.intent_confidence,
            redactions_applied=advisory.get("redactions_applied", []),
            redacted_for_llm=bool(advisory.get("redacted_for_llm", False)),
        )

    if decision.action == "answer_smalltalk":
        state.current_question_id = current_question["id"]
        state.current_domain = current_question["domain"]
        smalltalk = answer_smalltalk_with_llm(
            message,
            current_question,
            base_answers,
            state.org_info,
            trace_context=_trace_context(state, request_id, current_question, message),
        )
        return _chat_response(
            state,
            assistant_message=smalltalk["message"],
            extracted_answers={},
            score=None,
            report=None,
            provider=smalltalk.get("provider", "fallback"),
            used_fallback=smalltalk.get("used_fallback", True),
            response_type=intent,
            intent=intent,
            action=decision.action,
            intent_confidence=decision.intent_confidence,
        )

    extraction = extract_answers_with_llm(
        user_message=message,
        questions=load_questions(),
        current_answers=base_answers,
        current_question=current_question,
        trace_context=_trace_context(state, request_id, current_question, message),
    )
    extraction_intent = extraction.get("intent", intent)
    interpretation = CHAT_CONTROLLER.build_answer_interpretation(
        extraction.get("extracted_answers", {}) if isinstance(extraction.get("extracted_answers", {}), dict) else {},
        extraction.get("confidence", {}),
        load_questions(),
    )

    if extraction_intent == "clarification":
        state.current_question_id = current_question["id"]
        state.current_domain = current_question["domain"]
        advisory = answer_client_question_with_llm(
            user_message=message,
            current_question=current_question,
            current_answers=base_answers,
            org_info=state.org_info,
            trace_context=_trace_context(state, request_id, current_question, message),
        )
        return _chat_response(
            state,
            assistant_message=advisory["message"],
            extracted_answers={},
            score=None,
            report=None,
            provider=advisory.get("provider", "fallback"),
            used_fallback=advisory.get("used_fallback", True),
            response_type="client_question",
            intent=extraction_intent,
            action="answer_clarification",
            intent_confidence="medium",
            redactions_applied=advisory.get("redactions_applied", []),
            redacted_for_llm=bool(advisory.get("redacted_for_llm", False)),
        )

    if extraction_intent in {"smalltalk", "unknown"}:
        state.current_question_id = current_question["id"]
        state.current_domain = current_question["domain"]
        smalltalk = answer_smalltalk_with_llm(
            message,
            current_question,
            base_answers,
            state.org_info,
            trace_context=_trace_context(state, request_id, current_question, message),
        )
        return _chat_response(
            state,
            assistant_message=smalltalk["message"],
            extracted_answers={},
            score=None,
            report=None,
            provider=smalltalk.get("provider", "fallback"),
            used_fallback=smalltalk.get("used_fallback", True),
            response_type=extraction_intent,
            intent=extraction_intent,
            action="answer_smalltalk",
            intent_confidence="medium",
        )

    extracted_answers, unclear_questions = _apply_chat_extraction(
        state=state,
        extraction=extraction,
        qmap=qmap,
        message=message,
        request_id=request_id,
        current_question=current_question,
        intent=intent,
    )

    base_answers = _base_answers_only(state.answers)
    if not missing_required_question_ids(base_answers):
        return _complete_chat(
            state,
            completion_mode="full",
            extracted_answers=extracted_answers,
            provider=extraction.get("provider", "fallback"),
            used_fallback=extraction.get("used_fallback", True),
            intent=extraction.get("intent", intent),
            action="complete_chat",
            intent_confidence=decision.intent_confidence,
            answer_interpretation=interpretation.summary if interpretation else "",
            answer_confidence=interpretation.confidence_label if interpretation else "",
            redactions_applied=extraction.get("redactions_applied", []),
            redacted_for_llm=bool(extraction.get("redacted_for_llm", False)),
        )

    if extraction.get("needs_clarification") and unclear_questions:
        target_id = unclear_questions[0]
        target_question = qmap[target_id]
        state.current_question_id = target_id
        state.current_domain = target_question["domain"]
        clarification_question = extraction.get("clarification_question") or (
            f"Kas saad palun täpsustada: {target_question['question']}"
        )
        assistant_message = CHAT_CONTROLLER.build_clarification_message(
            clarification_question=clarification_question,
            interpretation=interpretation,
        )
        return _chat_response(
            state,
            assistant_message=assistant_message,
            extracted_answers=extracted_answers,
            score=None,
            report=None,
            provider=extraction.get("provider", "fallback"),
            used_fallback=extraction.get("used_fallback", True),
            response_type="clarification",
            intent=extraction.get("intent", intent),
            action="extract_answer",
            intent_confidence=decision.intent_confidence,
            answer_interpretation=interpretation.summary if interpretation else "",
            answer_confidence=interpretation.confidence_label if interpretation else "",
            redactions_applied=extraction.get("redactions_applied", []),
            redacted_for_llm=bool(extraction.get("redacted_for_llm", False)),
        )

    next_q = next_missing_question(base_answers)
    if next_q is None:
        return _complete_chat(
            state,
            completion_mode="full",
            extracted_answers=extracted_answers,
            provider=extraction.get("provider", "fallback"),
            used_fallback=extraction.get("used_fallback", True),
            intent=extraction.get("intent", intent),
            action="complete_chat",
            intent_confidence=decision.intent_confidence,
            answer_interpretation=interpretation.summary if interpretation else "",
            answer_confidence=interpretation.confidence_label if interpretation else "",
            redactions_applied=extraction.get("redactions_applied", []),
            redacted_for_llm=bool(extraction.get("redacted_for_llm", False)),
        )

    state.current_question_id = next_q["id"]
    state.current_domain = next_q["domain"]
    question_result = generate_next_question(next_q, {"answers": base_answers}, _trace_context(state, request_id, next_q, message))
    assistant_message = _saved_answer_message(_language_code(message), question_result["message"])
    return _chat_response(
        state,
        assistant_message=assistant_message,
        extracted_answers=extracted_answers,
        score=None,
        report=None,
        provider=extraction.get("provider") or question_result.get("provider", "fallback"),
        used_fallback=bool(extraction.get("used_fallback", True) or question_result.get("used_fallback", True)),
        response_type="interview_answer",
        intent=extraction.get("intent", intent),
        action="extract_answer",
        intent_confidence=decision.intent_confidence,
        answer_interpretation=interpretation.summary if interpretation else "",
        answer_confidence=interpretation.confidence_label if interpretation else "",
        redactions_applied=extraction.get("redactions_applied", []),
        redacted_for_llm=bool(extraction.get("redacted_for_llm", False)),
    )


def _chat_simplified_flow(
    *,
    state: SessionState,
    is_new: bool,
    message: str,
    request_id: str,
    current_question: dict[str, Any] | None,
    base_answers: dict[str, dict[str, Any]],
    intent_mode: str | None,
    selected_answer: str | None,
) -> dict[str, Any] | None:
    if is_new and not message:
        return _ask_next_chat_question(state, greeting=True)

    if message:
        firewall = detect_prompt_injection(message)
        if firewall["detected"]:
            state.events.append(
                {
                    "type": "prompt_injection_blocked",
                    "reason": str(firewall.get("reason", "")),
                    "current_question_id": state.current_question_id,
                }
            )
            trace_guardrail(
                session_id=state.session_id,
                request_id=request_id,
                response_type="prompt_injection_blocked",
                provider="guardrail",
                used_fallback=False,
                current_question_id=(current_question or {}).get("id"),
                current_domain=(current_question or {}).get("domain"),
                user_message=message,
            )
            return _chat_response(
                state,
                assistant_message=safe_prompt_injection_response(_language_code(message)),
                extracted_answers={},
                score=None,
                report=None,
                provider="guardrail",
                used_fallback=False,
                response_type="prompt_injection_blocked",
                intent="guardrail",
                action="refuse",
                intent_confidence="high",
                prompt_injection_blocked=True,
                prompt_injection_reason=str(firewall.get("reason", "")),
            )

        if current_question is not None and looks_like_offensive_request(message):
            state.current_question_id = current_question["id"]
            state.current_domain = current_question["domain"]
            guardrail = defensive_refusal(message, current_question)
            state.events.append(
                {
                    "type": "guardrail_refusal",
                    "current_question_id": current_question["id"],
                    "provider": guardrail.get("provider", "guardrail"),
                }
            )
            trace_guardrail(
                session_id=state.session_id,
                request_id=request_id,
                response_type="guardrail",
                provider=guardrail.get("provider", "guardrail"),
                used_fallback=False,
                current_question_id=current_question["id"],
                current_domain=current_question.get("domain"),
                user_message=message,
            )
            return _chat_response(
                state,
                assistant_message=guardrail["message"],
                extracted_answers={},
                score=None,
                report=None,
                provider=guardrail.get("provider", "guardrail"),
                used_fallback=False,
                response_type="guardrail",
                intent="guardrail",
                action="refuse",
                intent_confidence="high",
            )

    if intent_mode == "direct_answer" and selected_answer and current_question is not None:
        return _handle_direct_answer_turn(
            state=state,
            message=message or selected_answer,
            request_id=request_id,
            current_question=current_question,
            answer=selected_answer,
            confidence=1.0,
            answer_source="quick_answer",
        )

    if intent_mode in {"clarification", "advisory", "context_note"} and current_question is not None:
        if intent_mode == "clarification":
            return _handle_clarification_turn(
                state=state,
                message=message,
                request_id=request_id,
                current_question=current_question,
                base_answers=base_answers,
                intent="clarification",
                action="answer_clarification",
                intent_confidence="high",
            )
        if intent_mode == "advisory":
            return _handle_general_advisory_turn(
                state=state,
                message=message,
                request_id=request_id,
                current_question=current_question,
                base_answers=base_answers,
                intent="general_advisory_chat",
                action="answer_advisory",
                intent_confidence="high",
            )
        return _handle_context_note_turn(
            state=state,
            message=message,
            current_question=current_question,
            intent_confidence="high",
            assistant_message=_context_note_message(_language_code(message)),
        )

    if state.pending_answer and current_question is not None and message:
        pending_response = _handle_pending_answer_resolution_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
        )
        if pending_response is not None:
            return pending_response

    correction_target = _should_route_correction_to_previous_question(
        state=state,
        message=message,
        current_question=current_question,
    )
    if correction_target is not None:
        decision_result = decide_chat_turn_with_llm(
            user_message=message,
            current_question=correction_target,
            current_answers=base_answers,
            pending_answer=None,
            chat_history=state.chat_history,
            is_new_session=False,
            org_info=state.org_info,
            trace_context=_trace_context(state, request_id, correction_target, message),
        )
        decision = decision_result.get("decision")
        if decision_result.get("available", False) and isinstance(decision, dict):
            action = str(decision.get("action") or "smalltalk")
            confidence = float(decision.get("confidence") or 0.0)
            normalized_answer = str(decision.get("normalized_answer") or "").strip().lower() or None
            if action == "save_answer" and normalized_answer in {"yes", "partial", "no", "unsure"} and confidence >= 0.75:
                return _handle_direct_answer_turn(
                    state=state,
                    message=message,
                    request_id=request_id,
                    current_question=correction_target,
                    answer=normalized_answer,
                    confidence=confidence,
                    answer_source="ai_interview",
                )
            if action == "ask_confirmation" and normalized_answer in {"yes", "partial", "no", "unsure"}:
                return _handle_pending_answer_confirmation_turn(
                    state=state,
                    message=message,
                    current_question=correction_target,
                    suggested_answer=normalized_answer,
                    confidence=confidence,
                    reason=str(decision.get("reason") or ""),
                    intent_confidence=_dialog_confidence_label(confidence),
                    assistant_preface=_decision_response_text(decision, fallback=""),
                )

    if current_question is not None and message:
        explicit_answer, explicit_confidence = infer_explicit_short_answer(message)
        if explicit_answer in {"yes", "partial", "no", "unsure"}:
            trace_intent_decision(
                session_id=state.session_id,
                request_id=request_id,
                intent="answer",
                response_type="save_answer",
                provider="router",
                used_fallback=False,
                current_question_id=current_question["id"],
                current_domain=current_question.get("domain"),
                user_message=message,
                should_save_answer=True,
                confidence=_dialog_confidence_label(explicit_confidence),
            )
            return _handle_direct_answer_turn(
                state=state,
                message=message,
                request_id=request_id,
                current_question=current_question,
                answer=explicit_answer,
                confidence=explicit_confidence,
                answer_source="router",
            )

    if current_question is None:
        return _complete_chat(
            state,
            completion_mode="full",
            intent="report_request",
            action="complete_chat",
            intent_confidence="high",
        )

    if not message:
        return _ask_next_chat_question(state, greeting=not base_answers)

    decision_result = decide_chat_turn_with_llm(
        user_message=message,
        current_question=current_question,
        current_answers=base_answers,
        pending_answer=state.pending_answer,
        chat_history=state.chat_history,
        is_new_session=is_new,
        org_info=state.org_info,
        trace_context=_trace_context(state, request_id, current_question, message),
    )
    decision = decision_result.get("decision")
    provider = str(decision_result.get("provider") or "fallback")
    used_fallback = bool(decision_result.get("used_fallback", False))

    if not decision_result.get("available", False) or not isinstance(decision, dict):
        return _ai_unavailable_response(state, current_question, provider=provider)

    action = str(decision.get("action") or "smalltalk")
    confidence = float(decision.get("confidence") or 0.0)
    normalized_answer = decision.get("normalized_answer")
    intent_confidence = _dialog_confidence_label(confidence)
    intent = _intent_from_chat_action(action)

    trace_intent_decision(
        session_id=state.session_id,
        request_id=request_id,
        intent=intent,
        response_type=action,
        provider=provider,
        used_fallback=used_fallback,
        current_question_id=current_question["id"],
        current_domain=current_question.get("domain"),
        user_message=message,
        should_save_answer=bool(decision.get("should_save_answer", False)),
        confidence=intent_confidence,
    )

    if action == "generate_report":
        return _finish_or_continue_chat(
            state,
            intent="report_request",
            action="generate_report",
            intent_confidence=intent_confidence,
            language=_language_code(message),
        )

    if action == "refuse":
        guardrail = defensive_refusal(message, current_question)
        return _chat_response(
            state,
            assistant_message=guardrail["message"],
            extracted_answers={},
            score=None,
            report=None,
            provider=guardrail.get("provider", "guardrail"),
            used_fallback=False,
            response_type="guardrail",
            intent="guardrail",
            action="refuse",
            intent_confidence="high",
        )

    if action == "save_answer" and normalized_answer in {"yes", "partial", "no", "unsure"}:
        if confidence >= 0.75:
            return _handle_direct_answer_turn(
                state=state,
                message=message,
                request_id=request_id,
                current_question=current_question,
                answer=normalized_answer,
                confidence=confidence,
                answer_source="ai_interview",
            )
        if confidence >= 0.45:
            return _handle_pending_answer_confirmation_turn(
                state=state,
                message=message,
                current_question=current_question,
                suggested_answer=normalized_answer,
                confidence=confidence,
                reason=str(decision.get("reason") or ""),
                intent_confidence=intent_confidence,
                assistant_preface=_decision_response_text(decision, fallback=""),
            )
        return _handle_context_note_turn(
            state=state,
            message=message,
            current_question=current_question,
            intent_confidence=intent_confidence,
            assistant_message=_soft_bridge_message(_language_code(message)),
        )

    if action == "ask_confirmation":
        return _handle_pending_answer_confirmation_turn(
            state=state,
            message=message,
            current_question=current_question,
            suggested_answer=normalized_answer if normalized_answer in {"yes", "partial", "no", "unsure"} else None,
            confidence=confidence,
            reason=str(decision.get("reason") or ""),
            intent_confidence=intent_confidence,
            assistant_preface=_decision_response_text(decision, fallback=""),
        )

    if action == "keep_context":
        if is_acknowledgement_or_smalltalk(message):
            return _handle_smalltalk_turn(
                state=state,
                message=message,
                request_id=request_id,
                current_question=current_question,
                base_answers=base_answers,
                intent="smalltalk",
                action="smalltalk",
                intent_confidence=intent_confidence,
                is_new_session=is_new,
            )
        return _handle_context_note_turn(
            state=state,
            message=message,
            current_question=current_question,
            intent_confidence=intent_confidence,
            assistant_message=_decision_response_text(
                decision,
                fallback=_context_saved_message(_language_code(message)),
            ),
        )

    if action == "answer_clarification":
        return _handle_clarification_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
            intent="clarification",
            action="answer_clarification",
            intent_confidence=intent_confidence,
        )

    if action == "answer_advisory":
        return _handle_general_advisory_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
            intent="general_advisory_chat",
            action="answer_advisory",
            intent_confidence=intent_confidence,
        )

    return _handle_smalltalk_turn(
        state=state,
        message=message,
        request_id=request_id,
        current_question=current_question,
        base_answers=base_answers,
        intent="smalltalk",
        action="smalltalk",
        intent_confidence=intent_confidence,
        is_new_session=is_new,
    )


def _chat_via_dialog_graph(
    *,
    state: SessionState,
    is_new: bool,
    message: str,
    request_id: str,
    current_question: dict[str, Any] | None,
    base_answers: dict[str, dict[str, Any]],
):
    graph_state = run_dialog_graph(
        DialogGraphState(
            session_id=state.session_id,
            message=message,
            current_question_id=(current_question or {}).get("id"),
            current_question_text=(current_question or {}).get("question"),
            current_domain=(current_question or {}).get("domain"),
            completion_rate=float(_progress(state)["completion_rate"]),
            interview_complete=state.interview_complete,
        )
    )
    decision = graph_state.decision
    route = str(graph_state.route or (decision.route if decision else "smalltalk"))
    intent = _intent_from_dialog_route(route)
    intent_confidence = _dialog_confidence_label((decision.confidence if decision else 0.6))

    trace_intent_decision(
        session_id=state.session_id,
        request_id=request_id,
        intent=intent,
        response_type=route,
        provider=graph_state.provider or "dialog_graph",
        used_fallback=graph_state.used_fallback,
        current_question_id=(current_question or {}).get("id"),
        current_domain=(current_question or {}).get("domain"),
        user_message=message,
        should_save_answer=bool(decision and decision.should_save_answer),
        confidence=intent_confidence,
    )

    if route == "refuse":
        if graph_state.error == "prompt_injection_blocked":
            state.events.append(
                {
                    "type": "prompt_injection_blocked",
                    "reason": (decision.reason if decision else ""),
                    "current_question_id": state.current_question_id,
                }
            )
            trace_guardrail(
                session_id=state.session_id,
                request_id=request_id,
                response_type="prompt_injection_blocked",
                provider="guardrail",
                used_fallback=True,
                current_question_id=(current_question or {}).get("id"),
                current_domain=(current_question or {}).get("domain"),
                user_message=message,
            )
            return _chat_response(
                state,
                assistant_message=safe_prompt_injection_response(_language_code(message)),
                extracted_answers={},
                score=None,
                report=None,
                provider="guardrail",
                used_fallback=True,
                response_type="prompt_injection_blocked",
                intent="guardrail",
                action="prompt_injection_blocked",
                intent_confidence="high",
                prompt_injection_blocked=True,
                prompt_injection_reason=(decision.reason if decision else ""),
                redactions_applied=[],
                redacted_for_llm=False,
            )

        if current_question is not None:
            state.current_question_id = current_question["id"]
            state.current_domain = current_question["domain"]
        guardrail = defensive_refusal(message, current_question)
        state.events.append(
            {
                "type": "guardrail_refusal",
                "current_question_id": (current_question or {}).get("id"),
                "provider": guardrail.get("provider", "guardrail"),
            }
        )
        trace_guardrail(
            session_id=state.session_id,
            request_id=request_id,
            response_type="guardrail",
            provider=guardrail.get("provider", "guardrail"),
            used_fallback=True,
            current_question_id=(current_question or {}).get("id"),
            current_domain=(current_question or {}).get("domain"),
            user_message=message,
        )
        return _chat_response(
            state,
            assistant_message=guardrail["message"],
            extracted_answers={},
            score=None,
            report=None,
            provider=guardrail.get("provider", "guardrail"),
            used_fallback=True,
            response_type="guardrail",
            intent="guardrail",
            action="guardrail_refusal",
            intent_confidence="high",
        )

    if route == "ask_assessment_question":
        if not base_answers:
            return _ask_next_chat_question(
                state,
                greeting=True,
                assistant_prefix="Tere! Viin sind lühidalt läbi lunavara valmisoleku intervjuu.",
                intent=intent,
                action="ask_next_question",
                intent_confidence=intent_confidence,
            )
        return _ask_next_chat_question(
            state,
            greeting=False,
            intent=intent,
            action="ask_next_question",
            intent_confidence=intent_confidence,
        )

    if route == "generate_report":
        if current_question is None:
            return _complete_chat(
                state,
                completion_mode="full",
                intent="report_request",
                action="complete_chat",
                intent_confidence=intent_confidence,
            )
        return _finish_or_continue_chat(
            state,
            intent="report_request",
            action="complete_chat",
            intent_confidence=intent_confidence,
            language=_language_code(message),
        )

    if current_question is None:
        return _complete_chat(
            state,
            completion_mode="full",
            intent=intent,
            action="complete_chat",
            intent_confidence=intent_confidence,
        )

    if route == "answer_general_advisory":
        return _handle_general_advisory_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
            intent=intent,
            action="answer_general_advisory",
            intent_confidence=intent_confidence,
        )

    if route == "answer_grounded_knowledge":
        return _handle_general_advisory_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
            intent="knowledge_grounded_answer",
            action="answer_grounded_knowledge",
            intent_confidence=intent_confidence,
            knowledge_sources=graph_state.knowledge_sources,
        )

    if route == "explain_current_question":
        return _handle_clarification_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
            intent="clarification",
            action="answer_clarification",
            intent_confidence=intent_confidence,
        )

    if route == "ask_clarifying_followup":
        state.current_question_id = current_question["id"]
        state.current_domain = current_question["domain"]
        clarification_question = (decision.reason if decision else "").strip() or (
            f"Kas saad täpsustada selle küsimuse kohta? Võid vastata yes, partial, no või unsure: {current_question['question']}"
        )
        return _chat_response(
            state,
            assistant_message=clarification_question,
            extracted_answers={},
            score=None,
            report=None,
            provider=graph_state.provider or "dialog_graph",
            used_fallback=True,
            response_type="clarification",
            intent="clarification",
            action="ask_clarifying_followup",
            intent_confidence=intent_confidence,
        )

    if route == "smalltalk":
        return _handle_smalltalk_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
            intent="smalltalk",
            action="answer_smalltalk",
            intent_confidence=intent_confidence,
        )

    return _handle_chat_answer_turn(
        state=state,
        message=message,
        request_id=request_id,
        current_question=current_question,
        base_answers=base_answers,
        intent="answer",
        intent_confidence=intent_confidence,
    )


@app.get("/interview/{session_id}/current")
def current_question(session_id: str):
    state = _get_state(session_id)

    # If there is an unanswered generated follow-up, show it first.
    for fq in state.followups:
        if fq["id"] not in state.answers:
            return {"status": "followup", "question": fq, "progress": _progress(state)}

    next_q = get_next_required_question(state.answers)
    if not next_q:
        return {"status": "complete", "question": None, "progress": _progress(state)}
    return {"status": "question", "question": next_q, "progress": _progress(state)}


@app.post("/answer")
def submit_answer(payload: AnswerIn):
    sid = payload.session_id
    if sid is None:
        sid = str(uuid4())
        state = SessionState(session_id=sid)
        save_session(state)
    else:
        state = _get_state(sid)

    qmap = question_map()
    if payload.question_id not in qmap:
        raise HTTPException(status_code=400, detail=f"Unknown question_id: {payload.question_id}")

    q = qmap[payload.question_id]
    allowed = q.get("options", [])
    if payload.answer not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid answer. Allowed options: {allowed}")

    state.answers[payload.question_id] = {
        "answer": payload.answer,
        "details": payload.details,
        "source": "manual",
        "confidence": 1.0,
    }
    _invalidate_cached_report(state)
    followup_decision = decide_followup(q, payload.answer, payload.details)

    generated_followup = None
    if followup_decision.get("needs_followup"):
        followup_id = f"followup__{payload.question_id}"
        # Avoid duplicate follow-up if answer is edited/re-submitted.
        existing_ids = {f["id"] for f in state.followups}
        if followup_id not in existing_ids:
            generated_followup = make_followup_question(payload.question_id, followup_decision.get("followup_question", ""))
            state.followups.append(generated_followup)

    state.events.append(
        {
            "type": "answer_saved",
            "question_id": payload.question_id,
            "answer": payload.answer,
            "followup_generated": bool(generated_followup),
        }
    )
    save_session(state)

    return {
        "session_id": sid,
        "saved": {payload.question_id: {"answer": payload.answer, "details": payload.details}},
        "answers_count": len(state.answers),
        "followup_decision": followup_decision,
        "generated_followup": generated_followup,
        "progress": _progress(state),
    }


@app.post("/followup-answer")
def submit_followup_answer(payload: FreeTextAnswerIn):
    state = _get_state(payload.session_id)
    followup_ids = {f["id"] for f in state.followups}
    if payload.question_id not in followup_ids:
        raise HTTPException(status_code=400, detail="Unknown follow-up question_id")
    state.answers[payload.question_id] = {"answer": "free_text", "details": payload.text}
    _invalidate_cached_report(state)
    state.events.append({"type": "followup_answer_saved", "question_id": payload.question_id})
    save_session(state)
    return {"session_id": payload.session_id, "saved": {payload.question_id: payload.text}, "progress": _progress(state)}


@app.get("/score/{session_id}")
def get_score(session_id: str):
    state = _get_state(session_id)
    return calculate_scores(_base_answers_only(state.answers))


@app.get("/report/{session_id}")
def get_report(session_id: str):
    state = _get_state(session_id)
    return _get_or_build_session_report(state)


@app.get("/external-exposure/checklist")
def get_external_exposure_checklist():
    return build_external_exposure_self_check()


@app.get("/employee-security-hygiene/checklist")
def get_employee_security_hygiene_checklist():
    return {
        "domain": "employee_security_hygiene",
        "type": "optional_advisory_checklist",
        "scoring_impact": "none",
        "items": load_employee_hygiene_checklist(),
    }


@app.get("/security-agent/profile")
def get_security_agent_profile():
    return security_agent_profile()


@app.get("/security-agent/cai")
def get_security_agent_cai_manifest():
    return cai_security_manifest()


@app.get("/session/{session_id}")
def get_session(session_id: str):
    state = _get_state(session_id)
    return {
        "session_id": state.session_id,
        "org_info": state.org_info,
        "answers": state.answers,
        "report": state.report,
        "followups": state.followups,
        "events": state.events,
        "chat_history": state.chat_history,
        "context_notes": state.context_notes,
        "pending_answer": state.pending_answer,
        "unclear_question_ids": state.unclear_question_ids,
        "current_question_id": state.current_question_id,
        "current_domain": state.current_domain,
        "interview_complete": state.interview_complete,
        "completion_mode": state.completion_mode,
        "progress": _progress(state),
    }


@app.get("/technical/flow")
def technical_flow():
    return {
        "workflow": [
            "1. Kasutaja loob sessiooni ja sisestab organisatsiooni üldinfo.",
            "2. /chat kontrollib prompt injection mustreid enne intent classification'i ja enne LLM-kutseid.",
            "3. Kui prompt injection tuvastatakse, LLM-i ei kutsuta, vastust ei salvestata skooritava vastusena ja aktiivne küsimus ei muutu.",
            "4. /chat valib järgmise puuduva küsimuse failist data/questions.json, sh detection_monitoring domeeni küsimused.",
            "5. Enne välist LLM-kutset redigeeritakse kasutaja sõnumist e-postid, IP-d, URL-id, domeenid, saladused ja pikad ID-d.",
            "6. Kui kasutaja küsib selgitust, vastab LLM või fallback kliendi küsimusele lihtsas keeles ja intervjuu jääb sama küsimuse juurde.",
            "7. Kui kasutaja vastab, teisendab LLM või fallback vabateksti question_id -> yes/partial/no/unsure kujule.",
            "8. Backend valideerib extracted answers vastu questions.json options väärtusi.",
            "9. Kui kõik nõutud küsimused on vastatud, arvutab backend score'i data/scoring_rules.json põhjal.",
            "10. Raport ühendab reeglipõhise score'i, top-riskid, finding cards, confidence'i ja LLM/fallback sõnastuse.",
            "11. External exposure self-check on ainult self-reported checklist; skaneerimist, OSINT-i ega väliste teenuste päringuid ei tehta.",
        ],
        "ai_parts": [
            "backend/chat_interview.py: answer_client_question_with_llm()",
            "backend/chat_interview.py: answer_general_advisory_with_llm()",
            "backend/chat_interview.py: extract_answers_with_llm()",
            "backend/chat_interview.py: generate_next_question()",
            "backend/adaptive.py: decide_followup()",
        ],
        "prompts": [
            "prompts/interview_system_prompt.txt",
            "prompts/extraction_prompt.txt",
            "prompts/advisor_prompt.txt",
            "prompts/chat_turn_prompt.txt",
            "prompts/general_advisory_prompt.txt",
            "prompts/followup_prompt.txt",
            "prompts/report_prompt.txt",
        ],
        "rule_based_parts": [
            "data/questions.json",
            "data/scoring_rules.json",
            "backend/scoring.py",
            "backend/prompt_firewall.py",
            "backend/redaction.py",
            "backend/findings.py",
            "backend/confidence.py",
            "backend/exposure.py",
        ],
    }


def _get_or_create_chat_state(session_id: str | None) -> tuple[SessionState, bool]:
    if session_id:
        return _get_state(session_id), False
    sid = str(uuid4())
    state = SessionState(session_id=sid)
    save_session(state)
    return state, True


def _rate_limit_for_path(path: str, settings: dict[str, object]) -> int:
    if path == "/chat":
        return int(settings["rate_limit_chat_per_minute"])
    if path.startswith("/report/"):
        return int(settings["rate_limit_report_per_minute"])
    if path == "/demo/load-profile":
        return int(settings["rate_limit_demo_per_minute"])
    return 0


def _ask_next_chat_question(
    state: SessionState,
    greeting: bool = False,
    assistant_prefix: str = "",
    intent: str = "smalltalk",
    action: str = "ask_next_question",
    intent_confidence: str = "high",
):
    base_answers = _base_answers_only(state.answers)
    if not missing_required_question_ids(base_answers):
        return _complete_chat(state, completion_mode="full")

    q = next_missing_question(base_answers)
    if q is None:
        return _complete_chat(state, completion_mode="full")

    state.current_question_id = q["id"]
    state.current_domain = q["domain"]
    question_result = generate_next_question(q, {"answers": base_answers})
    assistant_message = question_result["message"]
    if greeting:
        prefix = assistant_prefix or "Alustame lunavara valmisoleku intervjuuga."
        assistant_message = f"{prefix}\n\n{assistant_message}"

    return _chat_response(
        state,
        assistant_message=assistant_message,
        extracted_answers={},
        score=None,
        report=None,
        provider=question_result.get("provider", "fallback"),
        used_fallback=question_result.get("used_fallback", True),
        intent=intent,
        action=action,
        intent_confidence=intent_confidence,
    )


def _finish_or_continue_chat(
    state: SessionState,
    intent: str = "report_request",
    action: str = "finish_or_continue_report",
    intent_confidence: str = "high",
    language: str = "en",
):
    base_answers = _base_answers_only(state.answers)
    full = not missing_required_question_ids(base_answers)
    if full:
        return _complete_chat(
            state,
            completion_mode="full",
            intent=intent,
            action="complete_chat",
            intent_confidence=intent_confidence,
        )

    if should_generate_preliminary_report(base_answers):
        return _complete_chat(
            state,
            completion_mode="preliminary",
            intent=intent,
            action="complete_chat",
            intent_confidence=intent_confidence,
        )

    missing_domains = ", ".join(missing_domain_labels(base_answers))
    q = next_missing_question(base_answers)
    if q is None:
        return _complete_chat(
            state,
            completion_mode="preliminary",
            intent=intent,
            action="complete_chat",
            intent_confidence=intent_confidence,
        )

    state.current_question_id = q["id"]
    state.current_domain = q["domain"]
    assistant_message = _report_request_blocked_message(language, missing_domains)
    return _chat_response(
        state,
        assistant_message=assistant_message,
        extracted_answers={},
        score=None,
        report=None,
        provider="router",
        used_fallback=False,
        response_type="report_request_blocked",
        intent=intent,
        action=action,
        intent_confidence=intent_confidence,
    )


def _report_request_blocked_message(language: str, missing_domains: str) -> str:
    if language == "ru":
        return (
            "Для отчёта пока недостаточно данных. "
            f"У нас всё ещё не хватает хотя бы одного ответа в этих областях: {missing_domains}. "
            "Давайте продолжим с текущим вопросом оценки, который уже показан в чате."
        )
    if language == "et":
        return (
            "Raporti koostamiseks on veel liiga vara. "
            f"Mul on endiselt puudu vähemalt üks vastus nendes valdkondades: {missing_domains}. "
            "Jätkame praeguse hindamisküsimusega, mis on juba vestluses näha."
        )
    return (
        "It is still a bit early to generate the report. "
        f"I am still missing at least one answer in these areas: {missing_domains}. "
        "Let us continue with the current assessment question already shown in the chat."
    )


def _complete_chat(
    state: SessionState,
    completion_mode: str,
    extracted_answers: dict[str, str] | None = None,
    provider: str = "fallback",
    used_fallback: bool = True,
    intent: str = "answer",
    action: str = "complete_chat",
    intent_confidence: str = "high",
    answer_interpretation: str = "",
    answer_confidence: str = "",
    redactions_applied: list[str] | None = None,
    redacted_for_llm: bool = False,
):
    base_answers = _base_answers_only(state.answers)
    state.interview_complete = True
    state.completion_mode = completion_mode
    state.current_question_id = None
    state.current_domain = None
    score = calculate_scores(base_answers)
    report = state.report or generate_report(base_answers, state.org_info)
    state.report = report

    assistant_message = "Intervjuu on valmis. Koostasin esmase readiness raporti."
    if completion_mode == "preliminary":
        assistant_message += f" Raport on esialgne: completion rate on {score['completion_rate']}%."

    return _chat_response(
        state,
        assistant_message=assistant_message,
        extracted_answers=extracted_answers or {},
        score=score,
        report=report,
        provider=provider,
        used_fallback=used_fallback,
        response_type="report",
        intent=intent,
        action=action,
        intent_confidence=intent_confidence,
        answer_interpretation=answer_interpretation,
        answer_confidence=answer_confidence,
        redactions_applied=redactions_applied or [],
        redacted_for_llm=redacted_for_llm,
    )


def _handle_preclassified_dialog_intent(
    *,
    state: SessionState,
    is_new: bool,
    message: str,
    request_id: str,
    current_question: dict[str, Any] | None,
    base_answers: dict[str, dict[str, Any]],
    intent_mode: str,
    selected_answer: str | None,
) -> dict[str, Any] | None:
    if is_new and not message and intent_mode in {"", "auto", None}:
        return None

    decision = classify_dialog_intent(
        message=message,
        current_question=current_question,
        chat_context=state.chat_history,
        intent_mode=intent_mode or "auto",
        selected_answer=selected_answer,
    )

    if decision.route == "report_request":
        if current_question is None:
            return _complete_chat(
                state,
                completion_mode="full",
                intent="report_request",
                action="complete_chat",
                intent_confidence=_dialog_confidence_label(decision.confidence),
            )
        return _finish_or_continue_chat(
            state,
            intent="report_request",
            action="complete_chat",
            intent_confidence=_dialog_confidence_label(decision.confidence),
            language=_language_code(message),
        )

    if current_question is None:
        return None

    if decision.route == "direct_assessment_answer" and decision.should_save_answer and decision.suggested_answer:
        return _handle_direct_answer_turn(
            state=state,
            message=message or decision.suggested_answer,
            request_id=request_id,
            current_question=current_question,
            answer=decision.suggested_answer,
            confidence=decision.confidence,
            answer_source="router",
        )

    if decision.route == "clarification_current_question":
        return _handle_clarification_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
            intent="clarification",
            action="answer_clarification",
            intent_confidence=_dialog_confidence_label(decision.confidence),
        )

    if decision.route == "context_note":
        return _handle_context_note_turn(
            state=state,
            message=message,
            current_question=current_question,
            intent_confidence=_dialog_confidence_label(decision.confidence),
        )

    if decision.route in {"general_advisory_chat", "knowledge_grounded_answer"}:
        return _handle_general_advisory_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
            intent="knowledge_grounded_answer" if decision.route == "knowledge_grounded_answer" else "general_advisory_chat",
            action="answer_grounded_knowledge" if decision.route == "knowledge_grounded_answer" else "answer_general_advisory",
            intent_confidence=_dialog_confidence_label(decision.confidence),
            knowledge_sources=load_source_notes() if decision.route == "knowledge_grounded_answer" else None,
        )

    if decision.route == "ambiguous_needs_confirmation":
        return _handle_pending_answer_confirmation_turn(
            state=state,
            message=message,
            current_question=current_question,
            suggested_answer=decision.suggested_answer,
            confidence=decision.confidence,
            reason=decision.reason,
            intent_confidence=_dialog_confidence_label(decision.confidence),
        )

    return None


def _chat_response(
    state: SessionState,
    assistant_message: str,
    extracted_answers: dict[str, str] | None,
    score: dict[str, Any] | None,
    report: dict[str, Any] | None,
    provider: str,
    used_fallback: bool,
    response_type: str = "interview_question",
    intent: str = "answer",
    action: str = "extract_answer",
    intent_confidence: str = "medium",
    answer_interpretation: str = "",
    answer_confidence: str = "",
    redactions_applied: list[str] | None = None,
    redacted_for_llm: bool = False,
    prompt_injection_blocked: bool = False,
    prompt_injection_reason: str = "",
    knowledge_sources: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    assistant_message = _repair_text(assistant_message)
    state.chat_history.append({"role": "assistant", "content": assistant_message})
    save_session(state)
    progress = _progress(state)
    base_answers = _base_answers_only(state.answers)
    is_complete = bool(report) or state.interview_complete or progress["is_complete"]
    current_question = _clean_question_payload(question_map().get(state.current_question_id or ""))
    return {
        "session_id": state.session_id,
        "assistant_message": assistant_message,
        "intent": intent,
        "action": action,
        "intent_confidence": intent_confidence,
        "extracted_answers": extracted_answers or {},
        "answer_interpretation": answer_interpretation,
        "answer_confidence": answer_confidence,
        "missing_required_questions": missing_required_question_ids(base_answers),
        "unclear_questions": list(state.unclear_question_ids),
        "completion_rate": progress["completion_rate"],
        "is_complete": is_complete,
        "score": score,
        "report": report,
        "provider": provider if not used_fallback else "fallback",
        "used_fallback": used_fallback,
        "response_type": response_type,
        "current_question_id": state.current_question_id,
        "current_question": current_question,
        "current_domain": state.current_domain,
        "completion_mode": state.completion_mode,
        "context_notes": state.context_notes,
        "pending_answer": state.pending_answer,
        "redactions_applied": redactions_applied or [],
        "redacted_for_llm": redacted_for_llm,
        "prompt_injection_blocked": prompt_injection_blocked,
        "prompt_injection_reason": prompt_injection_reason,
        "knowledge_sources": knowledge_sources or [],
        "assistant_transparency": build_assistant_transparency(
            response_type=response_type,
            current_question=current_question,
            current_question_id=state.current_question_id,
            extracted_answers=extracted_answers or {},
            knowledge_sources=knowledge_sources or [],
            report=report,
            prompt_injection_blocked=prompt_injection_blocked,
        ),
        "chat_history": state.chat_history,
    }


def _language_code(message: str) -> str:
    language = detect_language(message)
    return {"Russian": "ru", "English": "en"}.get(language, "et")


def _repair_text(value: str) -> str:
    text = str(value or "")
    if not text or not any(marker in text for marker in ("Ã", "â", "Ð", "Ñ")):
        return text
    try:
        repaired = text.encode("latin1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text
    return repaired or text


def _clean_question_payload(question: dict[str, Any] | None) -> dict[str, Any] | None:
    if not question:
        return question
    cleaned = dict(question)
    for key in ("question", "help", "domain"):
        if isinstance(cleaned.get(key), str):
            cleaned[key] = _repair_text(cleaned[key])
    if isinstance(cleaned.get("source_refs"), list):
        cleaned["source_refs"] = [
            _repair_text(item) if isinstance(item, str) else item
            for item in cleaned["source_refs"]
        ]
    return cleaned


def _get_state(session_id: str) -> SessionState:
    state = load_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return state


def _invalidate_cached_report(state: SessionState) -> None:
    state.report = None


def _get_or_build_session_report(state: SessionState) -> dict[str, Any]:
    if state.report is None:
        state.report = generate_report(_base_answers_only(state.answers), state.org_info)
        save_session(state)
    return state.report


def _base_answers_only(answers: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {qid: value for qid, value in answers.items() if not qid.startswith("followup__")}


def _apply_chat_extraction(
    *,
    state: SessionState,
    extraction: dict[str, Any],
    qmap: dict[str, dict[str, Any]],
    message: str,
    request_id: str,
    current_question: dict[str, Any],
    intent: str,
    answer_source: str = "ai_interview",
) -> tuple[dict[str, str], list[str]]:
    extracted_answers = _extracted_answer_map(extraction)
    confidence = _extraction_confidence(extraction)
    used_fallback = bool(extraction.get("used_fallback", True))
    trace_provider = "fallback" if used_fallback else str(extraction.get("provider", "fallback"))

    for qid, answer in extracted_answers.items():
        q = qmap.get(qid)
        if not q or answer not in q.get("options", []):
            continue

        previous = state.answers.get(qid)
        confidence_score = _coerce_confidence_score(confidence.get(qid))
        state.answers[qid] = {
            "answer": answer,
            "details": message,
            "source": answer_source,
            "confidence": confidence_score,
        }
        if previous != state.answers[qid]:
            _invalidate_cached_report(state)
        state.events.append(
            {
                "type": "chat_answer_saved",
                "question_id": qid,
                "answer": answer,
                "details": message,
                "source": answer_source,
                "previous_answer": (previous or {}).get("answer"),
                "confidence_score": confidence_score,
            }
        )
        trace_answer_saved(
            session_id=state.session_id,
            request_id=request_id,
            intent=extraction.get("intent", intent),
            response_type="interview_answer",
            provider=trace_provider,
            used_fallback=used_fallback,
            current_question_id=qid,
            current_domain=q.get("domain"),
            user_message=message,
            saved_answer={"question_id": qid, "answer": answer},
            confidence=confidence_score,
        )
        if qid in state.unclear_question_ids:
            state.unclear_question_ids.remove(qid)

    unclear_questions = _sync_unclear_questions(state, extraction, qmap)
    state.events.append(
        {
            "type": "chat_message_processed",
            "intent": extraction.get("intent", intent),
            "current_question_id": current_question["id"],
            "extracted_answers": extracted_answers,
            "unclear_questions": unclear_questions,
            "provider": extraction.get("provider", "fallback"),
            "used_fallback": used_fallback,
        }
    )
    return extracted_answers, unclear_questions


def _extracted_answer_map(extraction: dict[str, Any]) -> dict[str, str]:
    raw_answers = extraction.get("extracted_answers", {})
    if not isinstance(raw_answers, dict):
        return {}
    return {
        str(qid): str(answer)
        for qid, answer in raw_answers.items()
        if str(qid).strip() and str(answer).strip()
    }


def _extraction_confidence(extraction: dict[str, Any]) -> dict[str, Any]:
    confidence = extraction.get("confidence", {})
    return confidence if isinstance(confidence, dict) else {}


def _coerce_confidence_score(value: Any) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, numeric))


def _sync_unclear_questions(
    state: SessionState,
    extraction: dict[str, Any],
    qmap: dict[str, dict[str, Any]],
) -> list[str]:
    raw_unclear_questions = extraction.get("unclear_questions", [])
    if not isinstance(raw_unclear_questions, list):
        return []

    base_answers = _base_answers_only(state.answers)
    unclear_questions = [
        str(qid)
        for qid in raw_unclear_questions
        if str(qid) in qmap and str(qid) not in base_answers
    ]
    for qid in unclear_questions:
        if qid not in state.unclear_question_ids:
            state.unclear_question_ids.append(qid)
    return unclear_questions


def _progress(state: SessionState) -> dict[str, Any]:
    base_answers = _base_answers_only(state.answers)
    scores = calculate_scores(base_answers)
    return {
        "answered_required": scores["answered_questions"],
        "total_required": scores["total_questions"],
        "completion_rate": scores["completion_rate"],
        "is_complete": scores["is_complete"],
        "followups_total": len(state.followups),
        "followups_answered": len([qid for qid in state.answers if qid.startswith("followup__")]),
    }


def _trace_context(
    state: SessionState,
    request_id: str,
    current_question: dict[str, Any] | None,
    user_message: str,
) -> dict[str, Any]:
    return {
        "session_id": state.session_id,
        "request_id": request_id,
        "current_question_id": (current_question or {}).get("id"),
        "current_domain": (current_question or {}).get("domain"),
        "user_message": user_message,
    }


def _intent_from_dialog_route(route: str) -> str:
    return {
        "save_assessment_answer": "answer",
        "ask_assessment_question": "smalltalk",
        "explain_current_question": "clarification",
        "answer_general_advisory": "general_advisory_chat",
        "answer_grounded_knowledge": "knowledge_grounded_answer",
        "ask_clarifying_followup": "clarification",
        "generate_report": "report_request",
        "smalltalk": "smalltalk",
        "refuse": "guardrail",
    }.get(route, "unknown")


def _dialog_confidence_label(confidence: float) -> str:
    if confidence >= 0.85:
        return "high"
    if confidence >= 0.55:
        return "medium"
    return "low"


def _handle_general_advisory_turn(
    *,
    state: SessionState,
    message: str,
    request_id: str,
    current_question: dict[str, Any],
    base_answers: dict[str, dict[str, Any]],
    intent: str,
    action: str,
    intent_confidence: str,
    knowledge_sources: list[dict[str, Any]] | None = None,
):
    advisory = answer_general_advisory_with_llm(
        user_message=message,
        current_question=current_question,
        current_answers=base_answers,
        org_info=state.org_info,
        trace_context=_trace_context(state, request_id, current_question, message),
    )
    state.events.append(
        {
            "type": intent,
            "current_question_id": state.current_question_id,
            "provider": advisory.get("provider", "fallback"),
            "used_fallback": advisory.get("used_fallback", True),
        }
    )
    if advisory.get("available") is False:
        return _ai_unavailable_response(state, current_question, provider=str(advisory.get("provider", "fallback")))
    if _should_hide_scripted_ai_response(advisory):
        return _ai_unavailable_response(state, current_question, provider=str(advisory.get("provider", "fallback")))
    return _chat_response(
        state,
        assistant_message=_with_early_question_reminder(
            _with_soft_bridge(
                advisory["message"],
                _soft_bridge_message(_language_code(message)),
            ),
            current_question=current_question,
            language=_language_code(message),
            has_saved_answers=bool(base_answers),
        ),
        extracted_answers={},
        score=None,
        report=None,
        provider=advisory.get("provider", "fallback"),
        used_fallback=advisory.get("used_fallback", True),
        response_type="general_advisory_chat",
        intent=intent,
        action=action,
        intent_confidence=intent_confidence,
        redactions_applied=advisory.get("redactions_applied", []),
        redacted_for_llm=bool(advisory.get("redacted_for_llm", False)),
        knowledge_sources=knowledge_sources or [],
    )


def _handle_clarification_turn(
    *,
    state: SessionState,
    message: str,
    request_id: str,
    current_question: dict[str, Any],
    base_answers: dict[str, dict[str, Any]],
    intent: str,
    action: str,
    intent_confidence: str,
):
    state.current_question_id = current_question["id"]
    state.current_domain = current_question["domain"]
    advisory = answer_client_question_with_llm(
        user_message=message,
        current_question=current_question,
        current_answers=base_answers,
        org_info=state.org_info,
        trace_context=_trace_context(state, request_id, current_question, message),
    )
    state.events.append(
        {
            "type": "client_question_answered",
            "current_question_id": current_question["id"],
            "provider": advisory.get("provider", "fallback"),
            "used_fallback": advisory.get("used_fallback", True),
        }
    )
    if advisory.get("available") is False:
        return _ai_unavailable_response(state, current_question, provider=str(advisory.get("provider", "fallback")))
    if _should_hide_scripted_ai_response(advisory):
        return _ai_unavailable_response(state, current_question, provider=str(advisory.get("provider", "fallback")))
    return _chat_response(
        state,
        assistant_message=_with_early_question_reminder(
            _with_soft_bridge(
                advisory["message"],
                _soft_bridge_message(_language_code(message)),
            ),
            current_question=current_question,
            language=_language_code(message),
            has_saved_answers=bool(base_answers),
        ),
        extracted_answers={},
        score=None,
        report=None,
        provider=advisory.get("provider", "fallback"),
        used_fallback=advisory.get("used_fallback", True),
        response_type="client_question",
        intent=intent,
        action=action,
        intent_confidence=intent_confidence,
        redactions_applied=advisory.get("redactions_applied", []),
        redacted_for_llm=bool(advisory.get("redacted_for_llm", False)),
    )


def _handle_smalltalk_turn(
    *,
    state: SessionState,
    message: str,
    request_id: str,
    current_question: dict[str, Any],
    base_answers: dict[str, dict[str, Any]],
    intent: str,
    action: str,
    intent_confidence: str,
    is_new_session: bool = False,
):
    state.current_question_id = current_question["id"]
    state.current_domain = current_question["domain"]
    smalltalk = answer_smalltalk_with_llm(
        message,
        current_question,
        base_answers,
        state.org_info,
        chat_history=state.chat_history,
        is_new_session=is_new_session,
        trace_context=_trace_context(state, request_id, current_question, message),
    )
    if smalltalk.get("available") is False:
        return _ai_unavailable_response(state, current_question, provider=str(smalltalk.get("provider", "fallback")))
    if _should_hide_scripted_ai_response(smalltalk):
        return _ai_unavailable_response(state, current_question, provider=str(smalltalk.get("provider", "fallback")))
    if is_new_session and not base_answers:
        assistant_prefix = _decision_response_text(
            {"user_visible_response": smalltalk["message"]},
            fallback="Alustame lunavara valmisoleku intervjuuga.",
        )
        return _ask_next_chat_question(
            state,
            greeting=True,
            assistant_prefix=assistant_prefix,
            intent="smalltalk",
            action="ask_next_question",
            intent_confidence=intent_confidence,
        )
    return _chat_response(
        state,
        assistant_message=_with_early_question_reminder(
            _decision_response_text(
                {
                    "user_visible_response": _decision_response_text(
                        {"user_visible_response": smalltalk["message"]},
                        fallback=_soft_bridge_message(_language_code(message)),
                    )
                },
                fallback=_soft_bridge_message(_language_code(message)),
            ),
            current_question=current_question,
            language=_language_code(message),
            has_saved_answers=bool(base_answers),
        ),
        extracted_answers={},
        score=None,
        report=None,
        provider=smalltalk.get("provider", "fallback"),
        used_fallback=smalltalk.get("used_fallback", True),
        response_type=intent,
        intent=intent,
        action=action,
        intent_confidence=intent_confidence,
    )


def _handle_direct_answer_turn(
    *,
    state: SessionState,
    message: str,
    request_id: str,
    current_question: dict[str, Any],
    answer: str,
    confidence: float,
    answer_source: str,
):
    state.current_question_id = current_question["id"]
    state.current_domain = current_question["domain"]
    state.pending_answer = None
    qmap = question_map()
    extraction = {
        "intent": "answer",
        "extracted_answers": {current_question["id"]: answer},
        "unclear_questions": [],
        "confidence": {current_question["id"]: confidence},
        "needs_clarification": False,
        "clarification_question": "",
        "provider": "router",
        "used_fallback": False,
        "answer_source": answer_source,
    }
    extracted_answers, _ = _apply_chat_extraction(
        state=state,
        extraction=extraction,
        qmap=qmap,
        message=message,
        request_id=request_id,
        current_question=current_question,
        intent="answer",
        answer_source=answer_source,
    )
    refreshed_answers = _base_answers_only(state.answers)

    if not missing_required_question_ids(refreshed_answers):
        return _complete_chat(
            state,
            completion_mode="full",
            extracted_answers=extracted_answers,
            provider="router",
            used_fallback=False,
            intent="answer",
            action="complete_chat",
            intent_confidence=_dialog_confidence_label(confidence),
        )

    next_q = next_missing_question(refreshed_answers)
    if next_q is None:
        return _complete_chat(
            state,
            completion_mode="full",
            extracted_answers=extracted_answers,
            provider="router",
            used_fallback=False,
            intent="answer",
            action="complete_chat",
            intent_confidence=_dialog_confidence_label(confidence),
        )

    state.current_question_id = next_q["id"]
    state.current_domain = next_q["domain"]
    question_result = generate_next_question(next_q, {"answers": refreshed_answers}, _trace_context(state, request_id, next_q, message))
    assistant_message = _saved_answer_message(_language_code(message), question_result["message"])
    return _chat_response(
        state,
        assistant_message=assistant_message,
        extracted_answers=extracted_answers,
        score=None,
        report=None,
        provider="router",
        used_fallback=False,
        response_type="interview_answer",
        intent="answer",
        action="extract_answer",
        intent_confidence=_dialog_confidence_label(confidence),
    )


def _latest_saved_answer_question(state: SessionState) -> dict[str, Any] | None:
    qmap = question_map()
    for event in reversed(state.events):
        if event.get("type") not in {"chat_answer_saved", "answer_saved"}:
            continue
        question_id = str(event.get("question_id") or "").strip()
        if question_id in qmap:
            return qmap[question_id]
    return None


def _should_route_correction_to_previous_question(
    *,
    state: SessionState,
    message: str,
    current_question: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not current_question or not message.strip():
        return None
    previous_question = _latest_saved_answer_question(state)
    if not previous_question or previous_question["id"] == current_question["id"]:
        return None
    normalized = message.strip().lower()
    if not (
        normalized.startswith("ei,")
        or normalized.startswith("no,")
        or normalized.startswith("tegelikult")
        or normalized.startswith("actually")
        or normalized.startswith("pigem")
    ):
        return None
    return previous_question


def _handle_context_note_turn(
    *,
    state: SessionState,
    message: str,
    current_question: dict[str, Any],
    intent_confidence: str,
    assistant_message: str | None = None,
):
    state.current_question_id = current_question["id"]
    state.current_domain = current_question["domain"]
    note = {
        "id": str(uuid4()),
        "question_id": current_question["id"],
        "domain": current_question["domain"],
        "text": message,
        "created_at": datetime.now(UTC).isoformat(),
        "source": "user",
    }
    state.context_notes.append(note)
    state.pending_answer = None
    state.events.append({"type": "context_note_added", **note})
    return _chat_response(
        state,
        assistant_message=assistant_message or _context_note_message(_language_code(message)),
        extracted_answers={},
        score=None,
        report=None,
        provider="router",
        used_fallback=False,
        response_type="context_note",
        intent="context_note",
        action="record_context_note",
        intent_confidence=intent_confidence,
    )


def _handle_pending_answer_confirmation_turn(
    *,
    state: SessionState,
    message: str,
    current_question: dict[str, Any],
    suggested_answer: str | None,
    confidence: float,
    reason: str,
    intent_confidence: str,
    assistant_preface: str | None = None,
):
    state.current_question_id = current_question["id"]
    state.current_domain = current_question["domain"]
    state.pending_answer = {
        "question_id": current_question["id"],
        "domain": current_question["domain"],
        "suggested_answer": suggested_answer,
        "confidence": confidence,
        "reason": reason,
        "created_at": datetime.now(UTC).isoformat(),
    }
    state.events.append(
        {
            "type": "pending_answer_confirmation",
            "question_id": current_question["id"],
            "suggested_answer": suggested_answer,
            "confidence": confidence,
            "reason": reason,
        }
    )
    assistant_message = _pending_confirmation_message_plain(
        _language_code(message),
        suggested_answer,
        preface=assistant_preface,
    )
    return _chat_response(
        state,
        assistant_message=assistant_message,
        extracted_answers={},
        score=None,
        report=None,
        provider="router",
        used_fallback=False,
        response_type="pending_answer_confirmation",
        intent="ambiguous_needs_confirmation",
        action="ask_answer_confirmation",
        intent_confidence=intent_confidence,
    )


def _pending_answer_resolution(message: str) -> str | None:
    text = message.strip().lower()
    confirm_values = {
        "yes",
        "y",
        "save",
        "save it",
        "yes save",
        "yes, save",
        "yes save it",
        "yes, save it",
        "confirm",
        "ok save",
        "okay save",
        "ok, save it",
        "okay, save it",
        "jah",
        "salvesta",
        "да",
        "подтверждаю",
        "сохрани",
        "сохранить",
    }
    reject_values = {
        "no",
        "n",
        "keep as context",
        "context",
        "do not save",
        "ei",
        "ara salvesta",
        "kontekst",
        "нет",
        "не сохраняй",
        "только контекст",
    }
    if text in confirm_values:
        return "confirm"
    if text in reject_values:
        return "reject"
    return None


def _decision_response_text(decision: dict[str, Any], fallback: str) -> str:
    text = str(decision.get("user_visible_response") or "").strip()
    return text or fallback


def _with_soft_bridge(message: str, bridge: str) -> str:
    clean = message.strip()
    if not clean:
        return bridge
    if bridge and bridge not in clean:
        return f"{clean}\n\n{bridge}"
    return clean


def _ai_unavailable_response(
    state: SessionState,
    current_question: dict[str, Any],
    *,
    provider: str,
) -> dict[str, Any]:
    state.current_question_id = current_question["id"]
    state.current_domain = current_question["domain"]
    return _chat_response(
        state,
        assistant_message=(
            "AI provider is unavailable. You can still continue the structured assessment using the quick answer buttons, "
            "but free-text advisory chat is disabled until a real LLM provider is configured."
        ),
        extracted_answers={},
        score=None,
        report=None,
        provider=provider,
        used_fallback=False,
        response_type="ai_unavailable",
        intent="ai_unavailable",
        action="ai_unavailable",
        intent_confidence="high",
    )


def _should_hide_scripted_ai_response(result: dict[str, Any]) -> bool:
    return bool(result.get("used_fallback")) and not (allow_scripted_ai_fallback() and ai_fallback_user_visible())


def _intent_from_chat_action(action: str) -> str:
    return {
        "save_answer": "answer",
        "answer_clarification": "clarification",
        "answer_advisory": "general_advisory_chat",
        "keep_context": "context_note",
        "ask_confirmation": "ambiguous_needs_confirmation",
        "generate_report": "report_request",
        "smalltalk": "smalltalk",
        "refuse": "guardrail",
    }.get(action, "unknown")


def _handle_chat_answer_turn(
    *,
    state: SessionState,
    message: str,
    request_id: str,
    current_question: dict[str, Any],
    base_answers: dict[str, dict[str, Any]],
    intent: str,
    intent_confidence: str,
):
    qmap = question_map()
    extraction = extract_answers_with_llm(
        user_message=message,
        questions=load_questions(),
        current_answers=base_answers,
        current_question=current_question,
        trace_context=_trace_context(state, request_id, current_question, message),
    )
    extraction_intent = extraction.get("intent", intent)
    interpretation = CHAT_CONTROLLER.build_answer_interpretation(
        extraction.get("extracted_answers", {}) if isinstance(extraction.get("extracted_answers", {}), dict) else {},
        extraction.get("confidence", {}),
        load_questions(),
    )

    if extraction_intent == "clarification":
        return _handle_clarification_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
            intent="clarification",
            action="answer_clarification",
            intent_confidence="medium",
        )

    if extraction_intent in {"smalltalk", "unknown"}:
        return _handle_smalltalk_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=current_question,
            base_answers=base_answers,
            intent=extraction_intent,
            action="answer_smalltalk",
            intent_confidence="medium",
        )

    extracted_answers, unclear_questions = _apply_chat_extraction(
        state=state,
        extraction=extraction,
        qmap=qmap,
        message=message,
        request_id=request_id,
        current_question=current_question,
        intent=intent,
    )

    refreshed_answers = _base_answers_only(state.answers)
    if not missing_required_question_ids(refreshed_answers):
        return _complete_chat(
            state,
            completion_mode="full",
            extracted_answers=extracted_answers,
            provider=extraction.get("provider", "fallback"),
            used_fallback=extraction.get("used_fallback", True),
            intent=extraction.get("intent", intent),
            action="complete_chat",
            intent_confidence=intent_confidence,
            answer_interpretation=interpretation.summary if interpretation else "",
            answer_confidence=interpretation.confidence_label if interpretation else "",
            redactions_applied=extraction.get("redactions_applied", []),
            redacted_for_llm=bool(extraction.get("redacted_for_llm", False)),
        )

    if extraction.get("needs_clarification") and unclear_questions:
        target_id = unclear_questions[0]
        target_question = qmap[target_id]
        state.current_question_id = target_id
        state.current_domain = target_question["domain"]
        clarification_question = extraction.get("clarification_question") or (
            f"Kas saad palun täpsustada: {target_question['question']}"
        )
        assistant_message = CHAT_CONTROLLER.build_clarification_message(
            clarification_question=clarification_question,
            interpretation=interpretation,
        )
        return _chat_response(
            state,
            assistant_message=assistant_message,
            extracted_answers=extracted_answers,
            score=None,
            report=None,
            provider=extraction.get("provider", "fallback"),
            used_fallback=extraction.get("used_fallback", True),
            response_type="clarification",
            intent=extraction.get("intent", intent),
            action="extract_answer",
            intent_confidence=intent_confidence,
            answer_interpretation=interpretation.summary if interpretation else "",
            answer_confidence=interpretation.confidence_label if interpretation else "",
            redactions_applied=extraction.get("redactions_applied", []),
            redacted_for_llm=bool(extraction.get("redacted_for_llm", False)),
        )

    next_q = next_missing_question(refreshed_answers)
    if next_q is None:
        return _complete_chat(
            state,
            completion_mode="full",
            extracted_answers=extracted_answers,
            provider=extraction.get("provider", "fallback"),
            used_fallback=extraction.get("used_fallback", True),
            intent=extraction.get("intent", intent),
            action="complete_chat",
            intent_confidence=intent_confidence,
            answer_interpretation=interpretation.summary if interpretation else "",
            answer_confidence=interpretation.confidence_label if interpretation else "",
            redactions_applied=extraction.get("redactions_applied", []),
            redacted_for_llm=bool(extraction.get("redacted_for_llm", False)),
        )

    state.current_question_id = next_q["id"]
    state.current_domain = next_q["domain"]
    question_result = generate_next_question(next_q, {"answers": refreshed_answers}, _trace_context(state, request_id, next_q, message))
    assistant_message = question_result["message"]
    acknowledgement = CHAT_CONTROLLER.build_answer_acknowledgement(interpretation)
    if acknowledgement:
        assistant_message = f"{acknowledgement}\n\nJärgmine küsimus: {assistant_message}"
    return _chat_response(
        state,
        assistant_message=assistant_message,
        extracted_answers=extracted_answers,
        score=None,
        report=None,
        provider=extraction.get("provider") or question_result.get("provider", "fallback"),
        used_fallback=bool(extraction.get("used_fallback", True) or question_result.get("used_fallback", True)),
        response_type="interview_answer",
        intent=extraction.get("intent", intent),
        action="extract_answer",
        intent_confidence=intent_confidence,
        answer_interpretation=interpretation.summary if interpretation else "",
        answer_confidence=interpretation.confidence_label if interpretation else "",
        redactions_applied=extraction.get("redactions_applied", []),
        redacted_for_llm=bool(extraction.get("redacted_for_llm", False)),
    )


def _display_answer_label(language: str, answer: str | None) -> str:
    normalized = str(answer or "").strip().lower()
    labels = {
        "en": {"yes": "yes", "partial": "partial", "no": "no", "unsure": "unsure"},
        "et": {"yes": "jah", "partial": "osaliselt", "no": "ei", "unsure": "ei tea"},
        "ru": {"yes": "да", "partial": "частично", "no": "нет", "unsure": "не знаю"},
    }
    return labels.get(language, labels["en"]).get(normalized, normalized or "partial")


def _context_note_message(language: str) -> str:
    if language == "ru":
        return (
            "Я сохранил это как контекст для текущего вопроса. Это не меняет score.\n\n"
            "Когда будете готовы, ответьте: да, частично, нет или не знаю."
        )
    if language == "et":
        return (
            "Jätsin selle praeguse küsimuse kontekstiks. See ei muuda skoori.\n\n"
            "Kui oled valmis, vasta: jah, osaliselt, ei või ei tea."
        )
    return (
        "I kept this as context for the current question. It does not change the score.\n\n"
        "When you are ready, answer yes, partial, no, or unsure."
    )


def _pending_confirmation_message(language: str, suggested_answer: str | None, preface: str | None = None) -> str:
    suggestion = suggested_answer or "partial"
    display = _display_answer_label(language, suggestion)
    if language == "ru":
        base = (
            f"Похоже, это может быть ответ «{display}», но я не хочу сохранять его автоматически.\n\n"
            f"Сохранить как «{display}» или оставить только как контекст?"
        )
    elif language == "et":
        base = (
            f"Mulle tundub, et see võib olla vastus «{display}», aga ma ei taha seda automaatselt salvestada.\n\n"
            f"Kas salvestan selle vastusena «{display}» või jätan ainult kontekstiks?"
        )
    else:
        base = (
            f"I think this may be a {display} answer, but I do not want to save it automatically.\n\n"
            f"Should I save it as {display}, or keep it only as context?"
        )
    if preface:
        return f"{preface.strip()}\n\n{base}"
    return base


def _pending_confirmation_message_plain(language: str, suggested_answer: str | None, preface: str | None = None) -> str:
    return _pending_confirmation_message(language, suggested_answer, preface)


def _handle_pending_answer_resolution_turn(
    *,
    state: SessionState,
    message: str,
    request_id: str,
    current_question: dict[str, Any],
) -> dict[str, Any] | None:
    pending = state.pending_answer or {}
    pending_question_id = str(pending.get("question_id") or "").strip()
    target_question = question_map().get(pending_question_id) if pending_question_id else None
    target_question = target_question or current_question
    suggested_answer = str(pending.get("suggested_answer") or "").strip().lower() or None
    confidence = float(pending.get("confidence") or 0.6)
    resolution = _pending_answer_resolution(message)
    if resolution == "confirm" and suggested_answer in {"yes", "partial", "no", "unsure"}:
        state.pending_answer = None
        return _handle_direct_answer_turn(
            state=state,
            message=message,
            request_id=request_id,
            current_question=target_question,
            answer=suggested_answer,
            confidence=confidence,
            answer_source="ai_interview",
        )
    if resolution == "reject":
        state.pending_answer = None
        return _handle_context_note_turn(
            state=state,
            message=message,
            current_question=target_question,
            intent_confidence="medium",
            assistant_message=_context_saved_message(_language_code(message)),
        )
    if suggested_answer in {"yes", "partial", "no", "unsure"}:
        decision_result = decide_chat_turn_with_llm(
            user_message=message,
            current_question=target_question,
            current_answers=_base_answers_only(state.answers),
            pending_answer=pending,
            chat_history=state.chat_history,
            is_new_session=False,
            org_info=state.org_info,
            trace_context=_trace_context(state, request_id, target_question, message),
        )
        decision = decision_result.get("decision")
        if decision_result.get("available", False) and isinstance(decision, dict):
            action = str(decision.get("action") or "")
            normalized_answer = str(decision.get("normalized_answer") or "").strip().lower() or None
            if action == "save_answer" and normalized_answer == suggested_answer:
                state.pending_answer = None
                return _handle_direct_answer_turn(
                    state=state,
                    message=message,
                    request_id=request_id,
                    current_question=target_question,
                    answer=suggested_answer,
                    confidence=max(confidence, float(decision.get("confidence") or 0.0)),
                    answer_source="ai_interview",
                )
            if action == "keep_context":
                state.pending_answer = None
                return _handle_context_note_turn(
                    state=state,
                    message=message,
                    current_question=target_question,
                    intent_confidence="medium",
                    assistant_message=_context_saved_message(_language_code(message)),
                )
    return None


def _context_saved_message(language: str) -> str:
    if language == "ru":
        return "Я оставил это только как контекст. Когда будете готовы, ответьте: да, частично, нет или не знаю."
    if language == "et":
        return "Jätsin selle ainult kontekstiks. Kui oled valmis, vasta: jah, osaliselt, ei või ei tea."
    return "I kept it as context only. When you are ready, answer yes, partial, no, or unsure."


def _soft_bridge_message(language: str) -> str:
    if language == "ru":
        return "Когда будете готовы, ответьте: да, частично, нет или не знаю."
    if language == "et":
        return "Kui oled valmis, vasta: jah, osaliselt, ei või ei tea."
    return "When you are ready, answer yes, partial, no, or unsure."


def _saved_answer_message(language: str, next_question_text: str) -> str:
    next_question_text = _repair_text(next_question_text)
    if language == "ru":
        return f"Сохранено.\n\nСледующий вопрос: {next_question_text}"
    if language == "et":
        return f"Salvestatud.\n\nJärgmine küsimus: {next_question_text}"
    return f"Saved.\n\nNext question: {next_question_text}"


def _with_early_question_reminder(
    message: str,
    *,
    current_question: dict[str, Any] | None,
    language: str,
    has_saved_answers: bool,
) -> str:
    if has_saved_answers or not current_question:
        return message.strip()
    question_text = _repair_text(str(current_question.get("question") or "").strip())
    if not question_text:
        return message.strip()
    if question_text in message:
        return message.strip()
    if language == "ru":
        prefix = "Текущий вопрос:"
    elif language == "et":
        prefix = "Praegune küsimus:"
    else:
        prefix = "Current question:"
    clean = message.strip()
    if not clean:
        return f"{prefix} {question_text}"
    return f"{clean}\n\n{prefix} {question_text}"
