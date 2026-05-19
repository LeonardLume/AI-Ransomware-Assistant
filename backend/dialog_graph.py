from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from backend.chat_interview import (
    _infer_current_question_reply,
    classify_user_intent,
    infer_answer,
    looks_like_current_question_clarification,
    looks_like_offensive_request,
)
from backend.dialog_contracts import DialogDecision, DialogGraphState
from backend.dialog_policy import apply_dialog_policy
from backend.prompt_firewall import detect_prompt_injection
from backend.questions import load_source_notes


class GraphState(TypedDict, total=False):
    session_id: str
    message: str
    current_question_id: str | None
    current_question_text: str | None
    current_domain: str | None
    completion_rate: float
    interview_complete: bool
    route: str | None
    decision: DialogDecision | None
    knowledge_sources: list[dict[str, Any]]
    assistant_message: str | None
    provider: str | None
    used_fallback: bool
    safety_blocked: bool
    error: str | None


def run_dialog_graph(state: DialogGraphState) -> DialogGraphState:
    result = DIALOG_GRAPH.invoke(state.model_dump())
    return DialogGraphState.model_validate(result)


def guardrail_node(state: GraphState) -> GraphState:
    message = str(state.get("message") or "")
    if message.strip():
        firewall = detect_prompt_injection(message)
        if firewall["detected"]:
            return {
                "route": "refuse",
                "safety_blocked": True,
                "provider": "guardrail",
                "error": "prompt_injection_blocked",
                "decision": DialogDecision(
                    route="refuse",
                    should_save_answer=False,
                    should_advance_question=False,
                    question_id=None,
                    answer=None,
                    needs_knowledge=False,
                    confidence=1.0,
                    reason=str(firewall.get("reason", "prompt injection detected")),
                    soft_bridge_to_assessment=False,
                ),
            }

    if looks_like_offensive_request(message):
        return {
            "route": "refuse",
            "safety_blocked": True,
            "provider": "guardrail",
            "error": "guardrail_refusal",
            "decision": DialogDecision(
                route="refuse",
                should_save_answer=False,
                should_advance_question=False,
                question_id=None,
                answer=None,
                needs_knowledge=False,
                confidence=1.0,
                reason="Unsafe cyber request detected.",
                soft_bridge_to_assessment=False,
            ),
        }

    return {}


def deterministic_router_node(state: GraphState) -> GraphState:
    if state.get("route"):
        return {}

    message = str(state.get("message") or "")
    current_question = _current_question(state)
    text = message.strip()

    if not text:
        return {
            "decision": DialogDecision(
                route="ask_assessment_question",
                should_save_answer=False,
                should_advance_question=False,
                question_id=None,
                answer=None,
                needs_knowledge=False,
                confidence=1.0,
                reason="Empty message starts or resumes the assessment.",
                soft_bridge_to_assessment=False,
            )
        }

    if _looks_like_grounded_question(text):
        return {
            "decision": DialogDecision(
                route="answer_grounded_knowledge",
                should_save_answer=False,
                should_advance_question=False,
                question_id=None,
                answer=None,
                needs_knowledge=True,
                confidence=0.86,
                reason="The message asks for evidence or source-grounded explanation.",
                soft_bridge_to_assessment=True,
            )
        }

    if current_question and looks_like_current_question_clarification(text, current_question):
        return {
            "decision": DialogDecision(
                route="explain_current_question",
                should_save_answer=False,
                should_advance_question=False,
                question_id=current_question["id"],
                answer=None,
                needs_knowledge=False,
                confidence=0.92,
                reason="The message clearly asks to explain the current assessment question.",
                soft_bridge_to_assessment=True,
            )
        }

    if current_question:
        inferred_answer, score = _infer_current_question_reply(text, current_question)
        if inferred_answer:
            return {
                "decision": DialogDecision(
                    route="save_assessment_answer",
                    should_save_answer=True,
                    should_advance_question=True,
                    question_id=current_question["id"],
                    answer=inferred_answer,
                    needs_knowledge=False,
                    confidence=score,
                    reason="The message looks like a direct answer to the active assessment question.",
                    soft_bridge_to_assessment=False,
                )
            }

    intent = classify_user_intent(text, current_question)
    if intent == "report_request":
        return {
            "decision": DialogDecision(
                route="generate_report",
                should_save_answer=False,
                should_advance_question=True,
                question_id=None,
                answer=None,
                needs_knowledge=False,
                confidence=0.95,
                reason="The message requests a report or result.",
                soft_bridge_to_assessment=False,
            )
        }
    if intent == "general_advisory_chat":
        return {
            "decision": DialogDecision(
                route="answer_general_advisory",
                should_save_answer=False,
                should_advance_question=False,
                question_id=None,
                answer=None,
                needs_knowledge=False,
                confidence=0.8,
                reason="The message asks for general defensive guidance.",
                soft_bridge_to_assessment=True,
            )
        }
    if intent == "clarification":
        return {
            "decision": DialogDecision(
                route="explain_current_question",
                should_save_answer=False,
                should_advance_question=False,
                question_id=state.get("current_question_id"),
                answer=None,
                needs_knowledge=False,
                confidence=0.78,
                reason="The message is a clarification request.",
                soft_bridge_to_assessment=True,
            )
        }
    if intent == "smalltalk":
        return {
            "decision": DialogDecision(
                route="smalltalk",
                should_save_answer=False,
                should_advance_question=False,
                question_id=None,
                answer=None,
                needs_knowledge=False,
                confidence=0.9,
                reason="The message is smalltalk or acknowledgement.",
                soft_bridge_to_assessment=True,
            )
        }

    return {}


def llm_router_node(state: GraphState) -> GraphState:
    if state.get("decision") is not None:
        return {}

    message = str(state.get("message") or "")
    current_question = _current_question(state)
    intent = classify_user_intent(message, current_question)
    route = "answer_general_advisory"
    needs_knowledge = False

    if intent == "answer":
        answer, score = (infer_answer(message, str(state.get("current_question_id") or "")))
        if answer and state.get("current_question_id"):
            return {
                "decision": DialogDecision(
                    route="save_assessment_answer",
                    should_save_answer=True,
                    should_advance_question=True,
                    question_id=str(state.get("current_question_id")),
                    answer=answer,
                    needs_knowledge=False,
                    confidence=score,
                    reason="The fallback router inferred a direct assessment answer.",
                    soft_bridge_to_assessment=False,
                )
            }
        route = "ask_clarifying_followup"
    elif intent == "report_request":
        route = "generate_report"
    elif intent == "clarification":
        route = "explain_current_question"
    elif intent == "smalltalk":
        route = "smalltalk"
    elif _looks_like_grounded_question(message):
        route = "answer_grounded_knowledge"
        needs_knowledge = True

    return {
        "decision": DialogDecision(
            route=route,
            should_save_answer=False,
            should_advance_question=route == "generate_report",
            question_id=None,
            answer=None,
            needs_knowledge=needs_knowledge,
            confidence=0.6,
            reason="The graph used the fallback router to choose a safe route.",
            soft_bridge_to_assessment=route in {
                "answer_general_advisory",
                "answer_grounded_knowledge",
                "smalltalk",
                "explain_current_question",
            },
        )
    }


def policy_node(state: GraphState) -> GraphState:
    decision = state.get("decision")
    if decision is None:
        return {
            "decision": DialogDecision(
                route="ask_clarifying_followup",
                should_save_answer=False,
                should_advance_question=False,
                question_id=state.get("current_question_id"),
                answer=None,
                needs_knowledge=False,
                confidence=0.4,
                reason="No valid dialog decision was produced.",
                soft_bridge_to_assessment=False,
            )
        }

    applied = apply_dialog_policy(
        decision,
        {
            "current_question_id": state.get("current_question_id"),
            "current_domain": state.get("current_domain"),
        },
        str(state.get("message") or ""),
    )
    return {"decision": applied}


def save_answer_node(state: GraphState) -> GraphState:
    return {"route": "save_assessment_answer", "provider": "dialog_graph", "used_fallback": True}


def ask_assessment_question_node(state: GraphState) -> GraphState:
    return {"route": "ask_assessment_question", "provider": "dialog_graph", "used_fallback": True}


def clarification_node(state: GraphState) -> GraphState:
    return {"route": "explain_current_question", "provider": "dialog_graph", "used_fallback": True}


def advisory_node(state: GraphState) -> GraphState:
    return {"route": "answer_general_advisory", "provider": "dialog_graph", "used_fallback": True}


def grounded_node(state: GraphState) -> GraphState:
    return {
        "route": "answer_grounded_knowledge",
        "provider": "dialog_graph",
        "used_fallback": True,
        "knowledge_sources": load_source_notes(),
    }


def followup_node(state: GraphState) -> GraphState:
    return {"route": "ask_clarifying_followup", "provider": "dialog_graph", "used_fallback": True}


def report_node(state: GraphState) -> GraphState:
    return {"route": "generate_report", "provider": "dialog_graph", "used_fallback": True}


def smalltalk_node(state: GraphState) -> GraphState:
    return {"route": "smalltalk", "provider": "dialog_graph", "used_fallback": True}


def refusal_node(state: GraphState) -> GraphState:
    return {"route": "refuse", "provider": "guardrail", "used_fallback": True, "safety_blocked": True}


def _should_call_llm_router(state: GraphState) -> str:
    return "llm_router_node" if state.get("decision") is None and not state.get("route") else "policy_node"


def _after_policy_route(state: GraphState) -> str:
    decision = state.get("decision")
    return str(decision.route if decision else "ask_clarifying_followup")


def _current_question(state: GraphState) -> dict[str, Any] | None:
    question_id = str(state.get("current_question_id") or "").strip()
    question_text = str(state.get("current_question_text") or "").strip()
    current_domain = str(state.get("current_domain") or "").strip()
    if not question_id:
        return None
    return {"id": question_id, "question": question_text, "domain": current_domain, "options": ["yes", "partial", "no", "unsure"]}


def _looks_like_grounded_question(message: str) -> bool:
    text = str(message or "").lower()
    hints = [
        "what evidence",
        "which evidence",
        "what proves",
        "show sources",
        "source",
        "sources",
        "mida toendab",
        "mis toendab",
        "mis tõendab",
        "allikas",
        "allikad",
        "доказ",
        "источник",
    ]
    return any(hint in text for hint in hints)


def _build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("guardrail_node", guardrail_node)
    graph.add_node("deterministic_router_node", deterministic_router_node)
    graph.add_node("llm_router_node", llm_router_node)
    graph.add_node("policy_node", policy_node)
    graph.add_node("save_answer_node", save_answer_node)
    graph.add_node("ask_assessment_question_node", ask_assessment_question_node)
    graph.add_node("clarification_node", clarification_node)
    graph.add_node("advisory_node", advisory_node)
    graph.add_node("grounded_node", grounded_node)
    graph.add_node("followup_node", followup_node)
    graph.add_node("report_node", report_node)
    graph.add_node("smalltalk_node", smalltalk_node)
    graph.add_node("refusal_node", refusal_node)

    graph.add_edge(START, "guardrail_node")
    graph.add_conditional_edges(
        "guardrail_node",
        lambda state: "refusal_node" if state.get("route") == "refuse" else "deterministic_router_node",
        {"refusal_node": "refusal_node", "deterministic_router_node": "deterministic_router_node"},
    )
    graph.add_conditional_edges(
        "deterministic_router_node",
        _should_call_llm_router,
        {"llm_router_node": "llm_router_node", "policy_node": "policy_node"},
    )
    graph.add_edge("llm_router_node", "policy_node")
    graph.add_conditional_edges(
        "policy_node",
        _after_policy_route,
        {
            "save_assessment_answer": "save_answer_node",
            "ask_assessment_question": "ask_assessment_question_node",
            "explain_current_question": "clarification_node",
            "answer_general_advisory": "advisory_node",
            "answer_grounded_knowledge": "grounded_node",
            "ask_clarifying_followup": "followup_node",
            "generate_report": "report_node",
            "smalltalk": "smalltalk_node",
            "refuse": "refusal_node",
        },
    )
    graph.add_edge("save_answer_node", END)
    graph.add_edge("ask_assessment_question_node", END)
    graph.add_edge("clarification_node", END)
    graph.add_edge("advisory_node", END)
    graph.add_edge("grounded_node", END)
    graph.add_edge("followup_node", END)
    graph.add_edge("report_node", END)
    graph.add_edge("smalltalk_node", END)
    graph.add_edge("refusal_node", END)
    return graph.compile()


DIALOG_GRAPH = _build_graph()
