from __future__ import annotations

import json
import os
from typing import Any

import pandas as pd
import requests
import streamlit as st

API_BASE = os.getenv("API_BASE", "http://127.0.0.1:8000")
API_TIMEOUT_SECONDS = float(os.getenv("API_TIMEOUT_SECONDS", "120"))

st.set_page_config(page_title="Ransomware Readiness AI Assistant", layout="wide")

st.markdown(
    """
<style>
.block-container { padding-top: 1rem; padding-bottom: 2rem; max-width: 1180px; }
.rr-header {
  border-bottom: 1px solid rgba(127, 127, 127, 0.22);
  padding: 6px 0 18px 0;
  margin-bottom: 14px;
}
.rr-header h1 {
  margin: 0;
  font-size: 1.65rem;
  line-height: 1.25;
  letter-spacing: 0;
  color: var(--text-color);
}
.rr-header p {
  margin: 6px 0 0 0;
  color: rgba(127, 127, 127, 0.95);
  font-size: 0.95rem;
}
.rr-card {
  background: var(--secondary-background-color);
  border: 1px solid rgba(127, 127, 127, 0.2);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
}
.rr-small { color: rgba(127, 127, 127, 0.95); font-size: 0.9rem; }
.rr-chip {
  display: inline-block;
  border: 1px solid rgba(127, 127, 127, 0.28);
  background: transparent;
  color: var(--text-color);
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 0.8rem;
  margin: 2px 4px 2px 0;
}
.rr-risk-low, .rr-risk-medium, .rr-risk-high, .rr-risk-critical { font-weight: 650; }
div[data-testid="stChatMessage"] {
  border: 1px solid rgba(127, 127, 127, 0.18);
  border-radius: 8px;
  padding: 0.25rem 0.4rem;
  background: transparent;
}
div[data-testid="stChatInput"] textarea { border-radius: 8px; }
section[data-testid="stSidebar"] { border-right: 1px solid rgba(127, 127, 127, 0.16); }
div.stButton > button {
  background: transparent;
  color: var(--text-color);
  border: 1px solid rgba(127, 127, 127, 0.28);
  border-radius: 8px;
  box-shadow: none;
}
div.stButton > button:hover {
  color: var(--primary-color);
  border-color: var(--primary-color);
  background: transparent;
}
div.stButton > button[kind="primary"] {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}
</style>
""",
    unsafe_allow_html=True,
)


def api(method: str, path: str, **kwargs) -> Any:
    response = requests.request(method, f"{API_BASE}{path}", timeout=API_TIMEOUT_SECONDS, **kwargs)
    response.raise_for_status()
    return response.json()


def safe_api(method: str, path: str, **kwargs) -> Any | None:
    try:
        return api(method, path, **kwargs)
    except Exception as exc:  # noqa: BLE001
        st.error(f"API viga: {exc}")
        return None


def reset_session() -> None:
    for key in ["session_id", "chat_history", "last_chat_response"]:
        st.session_state.pop(key, None)


def start_ai_interview() -> bool:
    data = safe_api("POST", "/chat", json={"message": ""})
    if not data:
        return False
    st.session_state["session_id"] = data["session_id"]
    st.session_state["chat_history"] = data.get("chat_history", [])
    st.session_state["last_chat_response"] = data
    return True


def ensure_ai_interview() -> None:
    if "session_id" not in st.session_state:
        start_ai_interview()
        return
    if "chat_history" not in st.session_state:
        data = safe_api("POST", "/chat", json={"session_id": st.session_state["session_id"], "message": ""})
        if data:
            st.session_state["chat_history"] = data.get("chat_history", [])
            st.session_state["last_chat_response"] = data


def send_chat_message(message: str) -> bool:
    if "session_id" not in st.session_state and not start_ai_interview():
        return False
    data = safe_api("POST", "/chat", json={"session_id": st.session_state["session_id"], "message": message})
    if not data:
        return False
    st.session_state["session_id"] = data["session_id"]
    st.session_state["chat_history"] = data.get("chat_history", [])
    st.session_state["last_chat_response"] = data
    return True


def load_demo_profile(profile_id: str) -> bool:
    data = safe_api("POST", "/demo/load-profile", json={"profile_id": profile_id})
    if not data:
        return False
    st.session_state["session_id"] = data["session_id"]
    st.session_state["chat_history"] = [
        {
            "role": "assistant",
            "content": f"Demo profiil '{data.get('profile_name', profile_id)}' on laaditud. Raport on valmis vaatamiseks.",
        }
    ]
    st.session_state["last_chat_response"] = {
        "session_id": data["session_id"],
        "assistant_message": st.session_state["chat_history"][0]["content"],
        "chat_history": st.session_state["chat_history"],
        "intent": "demo_profile",
        "extracted_answers": {},
        "provider": "not_called",
        "used_fallback": False,
        "response_type": "demo_profile",
    }
    return True


def current_session() -> dict[str, Any] | None:
    sid = st.session_state.get("session_id")
    if not sid:
        return None
    return safe_api("GET", f"/session/{sid}")


def current_score() -> dict[str, Any] | None:
    sid = st.session_state.get("session_id")
    if not sid:
        return None
    return safe_api("GET", f"/score/{sid}")


def current_report() -> dict[str, Any] | None:
    sid = st.session_state.get("session_id")
    if not sid:
        return None
    return safe_api("GET", f"/report/{sid}")


def risk_class(level: str) -> str:
    return f"rr-risk-{level.lower()}"


def provider_caption(data: dict[str, Any]) -> str:
    provider = data.get("provider") or "unknown"
    fallback = data.get("used_fallback")
    intent = data.get("intent") or data.get("response_type", "interview")
    return f"Extraction/generation provider: {provider} · fallback used: {fallback} · intent: {intent}"


def render_header() -> None:
    st.markdown(
        """
<div class="rr-header">
  <h1>Ransomware Readiness AI Assistant</h1>
  <p>Controlled AI interview · Rule-based scoring · Readiness report</p>
</div>
""",
        unsafe_allow_html=True,
    )


def render_answers_table(session: dict[str, Any] | None) -> None:
    if not session or not session.get("answers"):
        st.caption("Struktureeritud vastuseid veel ei ole.")
        return
    rows = []
    for qid, record in session["answers"].items():
        if qid.startswith("followup__"):
            continue
        rows.append({"Question ID": qid, "Answer": record.get("answer"), "Source": record.get("source", "form")})
    if rows:
        st.dataframe(pd.DataFrame(rows), hide_index=True, use_container_width=True)
    else:
        st.caption("Põhiküsimustele pole veel struktureeritud vastuseid.")


def render_status_panel(session: dict[str, Any] | None, last_response: dict[str, Any], score: dict[str, Any] | None) -> None:
    with st.container(border=True):
        st.markdown("##### Status")
        progress = session.get("progress", {}) if session else {}
        completion = int(progress.get("completion_rate", last_response.get("completion_rate", 0)))
        st.progress(completion / 100)
        st.metric("Completion rate", f"{completion}%")

        current_domain = session.get("current_domain") if session else last_response.get("current_domain")
        current_question = last_response.get("current_question") or {}
        current_question_id = (session or {}).get("current_question_id") or last_response.get("current_question_id")
        st.markdown(f"<span class='rr-chip'>Domain: {current_domain or '-'}</span>", unsafe_allow_html=True)
        st.markdown(f"<span class='rr-chip'>Question: {current_question_id or '-'}</span>", unsafe_allow_html=True)
        if current_question.get("question"):
            st.caption(current_question["question"])

        answered = progress.get("answered_required", 0)
        total = progress.get("total_required", 0)
        st.caption(f"Answered required questions: {answered} / {total}")

        if score:
            st.metric("Score status", score.get("score_status", "preliminary"))
        if last_response:
            st.caption(provider_caption(last_response))

        with st.expander("Known structured answers", expanded=False):
            render_answers_table(session)


def render_metric_cards(report: dict[str, Any]) -> None:
    c1, c2, c3 = st.columns(3)
    with c1:
        st.metric("Overall score", f"{report['overall_score']}/100")
    with c2:
        st.metric("Risk level", report["risk_level"])
    with c3:
        st.metric("Completion rate", f"{report['completion_rate']}%")


def render_report(report: dict[str, Any]) -> None:
    render_metric_cards(report)
    status = report.get("score_status", "preliminary")
    if status == "preliminary":
        st.warning("Raport on esialgne, sest kõik põhiküsimused ei ole vastatud.")
    else:
        st.success("Raport on final, sest kõik põhiküsimused on vastatud.")

    st.markdown("#### Kliendile sõnastatud kokkuvõte")
    st.info(report["llm_report_text"])

    st.markdown("#### Domeenide skoorid")
    for domain, value in report["domain_scores"].items():
        st.caption(f"{domain}: {value}/100")
        st.progress(int(value) / 100)

    left, right = st.columns(2, gap="large")
    with left:
        st.markdown("#### Peamised riskid")
        for risk in report["top_risks"]:
            st.warning(f"{risk['title']} ({risk['score']}/100): {risk['risk']}")
            if risk.get("nist_csf"):
                st.caption("NIST CSF: " + ", ".join(risk["nist_csf"]))
            if risk.get("skill_references"):
                st.caption("Skills: " + ", ".join(risk["skill_references"]))
    with right:
        st.markdown("#### Järgmised sammud")
        for step in report["next_steps"]:
            st.markdown(f"<div class='rr-card'>[ ] {step}</div>", unsafe_allow_html=True)

    action_plan = report.get("action_plan", [])
    if action_plan:
        st.markdown("#### Action plan")
        for item in action_plan:
            with st.container(border=True):
                st.markdown(f"**{item.get('title', 'Action')}**")
                st.caption(
                    " | ".join(
                        [
                            f"Priority: {item.get('priority', '-')}",
                            f"Domain: {item.get('domain', '-')}",
                            f"Owner: {item.get('owner_suggestion', '-')}",
                            f"Deadline: {item.get('deadline', '-')}",
                            f"Effort: {item.get('effort', '-')}",
                            f"Skill: {item.get('based_on_skill', '-')}",
                        ]
                    )
                )
                evidence = item.get("evidence_required") or []
                if evidence:
                    st.markdown("Evidence required: " + "; ".join(evidence))

    evidence_checklist = report.get("evidence_checklist", [])
    if evidence_checklist:
        st.markdown("#### Evidence checklist")
        for group in evidence_checklist:
            label = f"{group.get('title', group.get('based_on_skill', 'Evidence'))} ({group.get('domain', '-')})"
            with st.expander(label, expanded=False):
                if group.get("nist_csf"):
                    st.caption("NIST CSF: " + ", ".join(group["nist_csf"]))
                for item in group.get("items", []):
                    st.markdown(f"- [ ] {item}")

    skill_references = report.get("skill_references", [])
    if skill_references:
        with st.expander("Skill references", expanded=False):
            for ref in skill_references:
                st.markdown(f"**{ref.get('title', ref.get('id'))}**")
                st.caption(
                    " | ".join(
                        [
                            ref.get("id", "-"),
                            f"domain: {ref.get('domain', '-')}",
                            f"safe_use: {ref.get('safe_use', '-')}",
                        ]
                    )
                )
                if ref.get("nist_csf"):
                    st.caption("NIST CSF: " + ", ".join(ref["nist_csf"]))

    st.download_button(
        "Laadi raport JSON",
        data=json.dumps(report, ensure_ascii=False, indent=2),
        file_name="readiness_report.json",
        mime="application/json",
        use_container_width=True,
    )


render_header()

tab_chat, tab_report, tab_demo, tab_tech = st.tabs(
    ["AI intervjuu", "Raport", "Demo ja testimine", "Tehniline läbipaistvus"]
)

with tab_chat:
    ensure_ai_interview()
    session = current_session()
    score = current_score() if session else None
    last_response = st.session_state.get("last_chat_response", {})

    left, right = st.columns([1.7, 1], gap="large")

    with left:
        st.markdown("#### Vestlus")
        action_cols = st.columns(4)
        quick_actions = [
            ("Mida tähendab MFA?", "quick_mfa"),
            ("Miks peab varukoopia taastamist testima?", "quick_restore"),
            ("Mis on incident response?", "quick_ir"),
            ("Koosta raport praeguste vastuste põhjal", "quick_report"),
        ]
        for col, (text, key) in zip(action_cols, quick_actions):
            with col:
                if st.button(text, key=key, use_container_width=True):
                    if send_chat_message(text):
                        st.rerun()

        control_cols = st.columns(4)
        with control_cols[0]:
            if st.button("Alusta uus intervjuu", key="chat_start_new", type="primary", use_container_width=True):
                reset_session()
                start_ai_interview()
                st.rerun()
        with control_cols[1]:
            if st.button("Laadi nõrk VKE profiil", key="chat_load_weak_profile", use_container_width=True):
                if load_demo_profile("weak_sme"):
                    st.rerun()
        with control_cols[2]:
            if st.button("Laadi parem VKE profiil", key="chat_load_better_profile", use_container_width=True):
                if load_demo_profile("better_sme"):
                    st.rerun()
        with control_cols[3]:
            if st.button("Tühjenda vestlus", key="chat_clear", use_container_width=True):
                reset_session()
                st.rerun()

        for item in st.session_state.get("chat_history", []):
            role = item.get("role", "assistant")
            with st.chat_message("user" if role == "user" else "assistant"):
                st.markdown(item.get("content", ""))

        prompt = st.chat_input("Kirjuta vastus või küsi selgitust...")
        if prompt:
            if send_chat_message(prompt):
                st.rerun()

    with right:
        render_status_panel(session, last_response, score)
        extracted = last_response.get("extracted_answers") or {}
        if extracted:
            st.markdown("#### Viimati tuvastatud")
            for qid, answer in extracted.items():
                st.success(f"{qid} -> {answer}")

    if last_response.get("report"):
        st.divider()
        render_report(last_response["report"])

with tab_report:
    st.markdown("#### Readiness raport")
    if "session_id" not in st.session_state:
        st.info("Alusta intervjuud või laadi demo profiil.")
    else:
        report = current_report()
        if report:
            render_report(report)
            with st.expander("Raporti JSON"):
                st.json(report)

with tab_demo:
    st.markdown("#### Demo ja testimine")
    st.markdown(
        """
1. Start interview.
2. Ask: `Mida tähendab MFA?`
3. Answer one or two questions in free text.
4. Load `weak_sme` profile.
5. Show the report.
"""
    )
    c1, c2 = st.columns(2)
    with c1:
        if st.button("Laadi nõrk VKE profiil ja näita raportit", key="demo_load_weak_profile", type="primary", use_container_width=True):
            if load_demo_profile("weak_sme"):
                st.rerun()
    with c2:
        if st.button("Laadi parem VKE profiil", key="demo_load_better_profile", use_container_width=True):
            if load_demo_profile("better_sme"):
                st.rerun()

    st.markdown("#### Sample prompts")
    st.code("Mida tähendab MFA?")
    st.code("Meil on varukoopiad olemas, aga taastamist pole testitud.")
    st.code("Kas see on suur probleem, kui meil IR plaani pole?")
    st.code("Selgita seda lihtsamalt juhile.")
    st.code("Koosta raport praeguste vastuste põhjal")

with tab_tech:
    st.markdown("#### Tehniline läbipaistvus")
    st.markdown(
        """
- Questions come from `data/questions.json`.
- User free text goes to `POST /chat`.
- The message is classified as answer, clarification, report_request, smalltalk, or unknown.
- The LLM extracts structured answers only for allowed question IDs and options.
- The backend validates `question_id` and allowed answer values.
- Scoring uses `data/scoring_rules.json`.
- The report uses the deterministic score, weak domains, and LLM/fallback wording.
- Fallback mode keeps the demo running if the LLM is unavailable.
"""
    )

    llm = safe_api("GET", "/llm/status")
    if llm:
        st.markdown("#### LLM status")
        st.json(llm)

    flow = safe_api("GET", "/technical/flow")
    if flow:
        with st.expander("Backend workflow details"):
            for step in flow["workflow"]:
                st.markdown(f"- {step}")
            st.markdown("**AI / LLM parts**")
            for part in flow["ai_parts"]:
                st.markdown(f"- `{part}`")
            st.markdown("**Rule-based parts**")
            for part in flow["rule_based_parts"]:
                st.markdown(f"- `{part}`")

    with st.expander("Praeguse sessiooni tehniline JSON"):
        session = current_session()
        if session:
            st.json(session)
        else:
            st.caption("Sessiooni pole.")
