from __future__ import annotations

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
from backend.chat import ChatController
from backend.chat.transparency import build_assistant_transparency
from backend.chat_interview import (
    answer_client_question_with_llm,
    answer_general_advisory_with_llm,
    answer_smalltalk_with_llm,
    defensive_refusal,
    detect_language,
    extract_answers_with_llm,
    generate_next_question,
    missing_domain_labels,
    missing_required_question_ids,
    next_missing_question,
    should_generate_preliminary_report,
)
from backend.config import get_security_settings, llm_status, use_langgraph_dialog
from backend.dialog_contracts import DialogGraphState
from backend.dialog_graph import run_dialog_graph
from backend.exposure import build_external_exposure_self_check
from backend.hygiene import load_employee_hygiene_checklist
from backend.prompt_firewall import safe_prompt_injection_response
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:8501",
        "http://127.0.0.1:8501",
    ],
    allow_origin_regex=r"https?://([a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\]):(5173|4173|8501)",
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
        intent_confidence=decision.intent_confidence,
        answer_interpretation=interpretation.summary if interpretation else "",
        answer_confidence=interpretation.confidence_label if interpretation else "",
        redactions_applied=extraction.get("redactions_applied", []),
        redacted_for_llm=bool(extraction.get("redacted_for_llm", False)),
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

    state.answers[payload.question_id] = {"answer": payload.answer, "details": payload.details}
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
    return generate_report(_base_answers_only(state.answers), state.org_info)


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


@app.get("/session/{session_id}")
def get_session(session_id: str):
    state = _get_state(session_id)
    return {
        "session_id": state.session_id,
        "org_info": state.org_info,
        "answers": state.answers,
        "followups": state.followups,
        "events": state.events,
        "chat_history": state.chat_history,
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
    question_result = generate_next_question(q, {"answers": base_answers})
    assistant_message = (
        "Raporti jaoks on veel liiga vähe infot. "
        f"Puudu on vähemalt üks vastus nendes domeenides: {missing_domains}. "
        f"Jätkame ühe küsimusega: {question_result['message']}"
    )
    return _chat_response(
        state,
        assistant_message=assistant_message,
        extracted_answers={},
        score=None,
        report=None,
        provider=question_result.get("provider", "fallback"),
        used_fallback=question_result.get("used_fallback", True),
        response_type="report_request_blocked",
        intent=intent,
        action=action,
        intent_confidence=intent_confidence,
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
    report = generate_report(base_answers, state.org_info)

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
    state.chat_history.append({"role": "assistant", "content": assistant_message})
    save_session(state)
    progress = _progress(state)
    base_answers = _base_answers_only(state.answers)
    is_complete = bool(report) or state.interview_complete or progress["is_complete"]
    current_question = question_map().get(state.current_question_id or "")
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


def _get_state(session_id: str) -> SessionState:
    state = load_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return state


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
        state.answers[qid] = {
            "answer": answer,
            "details": message,
            "source": "ai_interview",
        }
        state.events.append(
            {
                "type": "chat_answer_saved",
                "question_id": qid,
                "answer": answer,
                "details": message,
                "source": "ai_interview",
                "previous_answer": (previous or {}).get("answer"),
                "confidence_score": confidence.get(qid),
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
            confidence=confidence.get(qid),
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
    return _chat_response(
        state,
        assistant_message=advisory["message"],
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
):
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
        action=action,
        intent_confidence=intent_confidence,
    )


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
