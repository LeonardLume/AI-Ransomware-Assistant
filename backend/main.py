from __future__ import annotations

from uuid import uuid4
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.adaptive import decide_followup, get_next_required_question, make_followup_question
from backend.chat_interview import (
    answer_client_question_with_llm,
    answer_smalltalk,
    classify_user_intent,
    defensive_refusal,
    extract_answers_with_llm,
    generate_next_question,
    looks_like_offensive_request,
    missing_domain_labels,
    missing_required_question_ids,
    next_missing_question,
    should_generate_preliminary_report,
)
from backend.config import llm_status
from backend.questions import load_demo_profiles, load_questions, load_source_notes, question_map
from backend.report import generate_report
from backend.scoring import calculate_scores
from backend.storage import SESSIONS, SessionState, save_session, load_session

app = FastAPI(
    title="Ransomware Readiness Assistant",
    description="MVP: adaptive ransomware-readiness interview, rule-based scoring, optional LLM report layer.",
    version="0.2.0-mvp",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8501",
        "http://127.0.0.1:8501",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
def chat(payload: ChatIn):
    state, is_new = _get_or_create_chat_state(payload.session_id)
    message = payload.message.strip()

    if is_new and message:
        state.chat_history.append({"role": "user", "content": message})

    if is_new or not message:
        if not _base_answers_only(state.answers):
            return _ask_next_chat_question(
                state,
                greeting=True,
                assistant_prefix="Tere! Viin sind lühidalt läbi lunavara valmisoleku intervjuu.",
            )
        return _ask_next_chat_question(state, greeting=False)

    state.chat_history.append({"role": "user", "content": message})
    base_answers = _base_answers_only(state.answers)

    qmap = question_map()
    current_question = qmap.get(state.current_question_id or "")
    if current_question is None or current_question["id"] in base_answers:
        current_question = next_missing_question(base_answers)

    if looks_like_offensive_request(message):
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
        )

    intent = classify_user_intent(message, current_question)

    if intent == "report_request":
        return _finish_or_continue_chat(state, intent=intent)

    if current_question is None:
        return _complete_chat(state, completion_mode="full", intent=intent)

    if intent == "clarification":
        state.current_question_id = current_question["id"]
        state.current_domain = current_question["domain"]
        advisory = answer_client_question_with_llm(
            user_message=message,
            current_question=current_question,
            current_answers=base_answers,
            org_info=state.org_info,
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
        )

    if intent in {"smalltalk", "unknown"}:
        state.current_question_id = current_question["id"]
        state.current_domain = current_question["domain"]
        smalltalk = answer_smalltalk(message, current_question)
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
        )

    extraction = extract_answers_with_llm(
        user_message=message,
        questions=load_questions(),
        current_answers=base_answers,
        current_question=current_question,
    )
    extraction_intent = extraction.get("intent", intent)

    if extraction_intent == "clarification":
        state.current_question_id = current_question["id"]
        state.current_domain = current_question["domain"]
        advisory = answer_client_question_with_llm(
            user_message=message,
            current_question=current_question,
            current_answers=base_answers,
            org_info=state.org_info,
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
        )

    if extraction_intent in {"smalltalk", "unknown"}:
        state.current_question_id = current_question["id"]
        state.current_domain = current_question["domain"]
        smalltalk = answer_smalltalk(message, current_question)
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
        )

    extracted_answers = extraction.get("extracted_answers", {})
    if isinstance(extracted_answers, dict):
        for qid, answer in extracted_answers.items():
            q = qmap.get(qid)
            if not q:
                continue
            if answer not in q.get("options", []):
                continue
            state.answers[qid] = {
                "answer": answer,
                "details": message,
                "source": "ai_interview",
            }
            if qid in state.unclear_question_ids:
                state.unclear_question_ids.remove(qid)

    unclear_questions = [
        qid
        for qid in extraction.get("unclear_questions", [])
        if qid in qmap and qid not in _base_answers_only(state.answers)
    ]
    for qid in unclear_questions:
        if qid not in state.unclear_question_ids:
            state.unclear_question_ids.append(qid)

    state.events.append(
        {
            "type": "chat_message_processed",
            "intent": extraction.get("intent", intent),
            "current_question_id": current_question["id"],
            "extracted_answers": extracted_answers,
            "unclear_questions": unclear_questions,
            "provider": extraction.get("provider", "fallback"),
            "used_fallback": extraction.get("used_fallback", True),
        }
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
        )

    if extraction.get("needs_clarification") and unclear_questions:
        target_id = unclear_questions[0]
        target_question = qmap[target_id]
        state.current_question_id = target_id
        state.current_domain = target_question["domain"]
        assistant_message = extraction.get("clarification_question") or (
            f"Kas saad palun täpsustada: {target_question['question']}"
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
        )
    state.current_question_id = next_q["id"]
    state.current_domain = next_q["domain"]
    question_result = generate_next_question(next_q, {"answers": base_answers})
    assistant_message = question_result["message"]
    acknowledgement = _answer_acknowledgement(extracted_answers)
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

    save_session(state)
    state.events.append(
        {
            "type": "answer_saved",
            "question_id": payload.question_id,
            "answer": payload.answer,
            "followup_generated": bool(generated_followup),
        }
    )

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
    return {"session_id": payload.session_id, "saved": {payload.question_id: payload.text}, "progress": _progress(state)}


@app.get("/score/{session_id}")
def get_score(session_id: str):
    state = _get_state(session_id)
    return calculate_scores(_base_answers_only(state.answers))


@app.get("/report/{session_id}")
def get_report(session_id: str):
    state = _get_state(session_id)
    return generate_report(_base_answers_only(state.answers), state.org_info)


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
            "2. /chat valib järgmise puuduva küsimuse failist data/questions.json.",
            "3. Kui kasutaja küsib selgitust, vastab LLM kliendi küsimusele lihtsas keeles ja intervjuu jääb sama küsimuse juurde.",
            "4. Kui kasutaja vastab, teisendab LLM või fallback vabateksti question_id -> yes/partial/no/unsure kujule.",
            "5. Backend valideerib extracted answers vastu questions.json options väärtusi.",
            "6. Kui vastus on ebaselge, küsitakse üks täpsustav küsimus.",
            "7. Kui kõik nõutud küsimused on vastatud, arvutab backend score'i data/scoring_rules.json põhjal.",
            "8. Raport ühendab reeglipõhise score'i, top-riskid ja LLM/fallback sõnastuse.",
        ],
        "ai_parts": [
            "backend/chat_interview.py: answer_client_question_with_llm()",
            "backend/chat_interview.py: extract_answers_with_llm()",
            "backend/chat_interview.py: generate_next_question()",
            "backend/adaptive.py: decide_followup()",
            "backend/report.py: generate_report() -> llm_report_text",
        ],
        "prompts": [
            "prompts/interview_system_prompt.txt",
            "prompts/extraction_prompt.txt",
            "prompts/advisor_prompt.txt",
            "prompts/followup_prompt.txt",
            "prompts/report_prompt.txt",
        ],
        "rule_based_parts": ["data/questions.json", "backend/scoring.py", "data/scoring_rules.json"],
    }


def _get_or_create_chat_state(session_id: str | None) -> tuple[SessionState, bool]:
    if session_id:
        return _get_state(session_id), False
    sid = str(uuid4())
    state = SessionState(session_id=sid)
    save_session(state)
    return state, True


def _ask_next_chat_question(
    state: SessionState,
    greeting: bool = False,
    assistant_prefix: str = "",
    intent: str = "smalltalk",
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
    )


def _finish_or_continue_chat(state: SessionState, intent: str = "report_request"):
    base_answers = _base_answers_only(state.answers)
    full = not missing_required_question_ids(base_answers)
    if full:
        return _complete_chat(state, completion_mode="full", intent=intent)

    if should_generate_preliminary_report(base_answers):
        return _complete_chat(state, completion_mode="preliminary", intent=intent)

    missing_domains = ", ".join(missing_domain_labels(base_answers))
    q = next_missing_question(base_answers)
    if q is None:
        return _complete_chat(state, completion_mode="preliminary")

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
    )


def _complete_chat(
    state: SessionState,
    completion_mode: str,
    extracted_answers: dict[str, str] | None = None,
    provider: str = "fallback",
    used_fallback: bool = True,
    intent: str = "answer",
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
        "extracted_answers": extracted_answers or {},
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
        "chat_history": state.chat_history,
    }


def _answer_acknowledgement(extracted_answers: dict[str, str] | None) -> str:
    if not extracted_answers:
        return ""
    pairs = [f"{qid} = {answer}" for qid, answer in extracted_answers.items()]
    if len(pairs) == 1:
        return f"Selge, märkisin vastuse: {pairs[0]}."
    return "Selge, märkisin vastused: " + "; ".join(pairs) + "."


def _get_state(session_id: str) -> SessionState:
    state = load_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return state


def _base_answers_only(answers: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {qid: value for qid, value in answers.items() if not qid.startswith("followup__")}


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
