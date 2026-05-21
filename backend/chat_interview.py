from __future__ import annotations

import json
import logging
import re
import unicodedata
from time import perf_counter
from typing import Any

from backend.ai_trace import trace_llm_call as trace_llm_call_event, trace_retrieval as trace_retrieval_event
from backend.config import (
    ai_fallback_user_visible,
    allow_scripted_ai_fallback,
    get_app_env,
    get_llm_settings,
    is_real_llm_configured,
)
from backend.llm_contracts import (
    validate_chat_decision,
    validate_extracted_answer,
    validate_grounded_answer_quality,
    validate_intent_decision,
)
from backend.llm_client import generate_text, load_prompt, parse_json_from_llm
from backend.questions import load_domain_metadata, load_questions, load_source_notes, question_map
from backend.redaction import redact_sensitive_text
from backend.skills import build_skill_context_for_domain

LOGGER = logging.getLogger(__name__)

Intent = str
VALID_INTENTS = {"answer", "clarification", "general_advisory_chat", "report_request", "smalltalk", "unknown"}

COMPACT_CHAT_DECISION_SYSTEM_PROMPT = (
    "Return JSON only with keys action, normalized_answer, confidence, reason, user_visible_response, "
    "should_advance_question, should_save_answer. "
    "Actions: save_answer, answer_clarification, answer_advisory, keep_context, ask_confirmation, "
    "generate_report, smalltalk, refuse. "
    "Use only yes/partial/no/unsure for normalized_answer. "
    "If short direct answer, save_answer. If mixed answer plus question about the active control, ask_confirmation. "
    "If clarification about current question, answer_clarification. If broad advice, answer_advisory. "
    "If acknowledgement, smalltalk. If unsafe, refuse."
)

PRELIMINARY_DOMAINS = [
    "backups",
    "mfa_access",
    "patching",
    "admin_rights",
    "incident_response",
    "detection_monitoring",
]

DOMAIN_LABELS = {
    "backups": "varukoopiad ja taastamine",
    "mfa_access": "MFA ja ligipääsud",
    "patching": "turvauuendused",
    "admin_rights": "administraatoriõigused",
    "incident_response": "incident response",
    "detection_monitoring": "tuvastus ja monitooring",
}

REPORT_HINTS = [
    "lõpeta",
    "lopeta",
    "tee raport",
    "koosta raport",
    "näita tulemust",
    "naita tulemust",
    "tulemus",
    "raport",
    "finish",
    "show result",
    "show report",
    "сделай отчет",
    "сделай отчёт",
    "покажи отчет",
    "покажи отчёт",
    "отчет",
    "отчёт",
    "Ð³Ð´Ðµ",
    "ÐºÐ¾Ð³Ð´Ð°",
    "ÐºÐ°ÐºÐ¾Ð¹",
    "ÐºÐ°ÐºÐ¸Ðµ",
]

CLARIFICATION_HINTS = [
    "kes sa oled",
    "kes oled",
    "too näidis",
    "too naidis",
    "too näidised",
    "too naidised",
    "näidis",
    "naidis",
    "näidised",
    "naidised",
    "näide",
    "naide",
    "mida tähendab",
    "mida tahendab",
    "mis on",
    "miks",
    "kuidas",
    "selgita",
    "seleta",
    "lihtsamalt",
    "juhile",
    "kas see on",
    "kui suur probleem",
    "mis vahe",
    "aita aru saada",
    "what is",
    "who are you",
    "what are you",
    "examples",
    "example",
    "what does",
    "why",
    "how",
    "explain",
    "how serious",
    "что такое",
    "кто ты",
    "кто вы",
    "объясни",
    "почему",
    "как",
    "что значит",
    "насколько",
    "зачем",
]

CURRENT_QUESTION_REFERENCE_HINTS = [
    "see",
    "seda",
    "selle",
    "praegune",
    "kusimus",
    "mida see",
    "miks see",
    "sellele vastata",
    "this",
    "this question",
    "current question",
    "how should i answer",
    "how do i answer",
    "этот вопрос",
    "это",
    "как ответить",
]

CURRENT_QUESTION_CLARIFICATION_HINTS = [
    "mida see tahendab",
    "mida tahendab",
    "miks see oluline",
    "miks see tahtis",
    "too naidis",
    "too näidis",
    "too naide",
    "too naidised",
    "naidis",
    "näidis",
    "naide",
    "selgita lihtsamalt",
    "seleta lihtsamalt",
    "kuidas sellele vastata",
    "what does this mean",
    "what does this question mean",
    "why is this important",
    "give example",
    "give examples",
    "explain this",
    "explain simpler",
    "how should i answer",
    "how do i answer",
    "объясни проще",
    "почему это важно",
    "пример",
    "как ответить",
]

GENERAL_ADVISORY_HINTS = [
    "best",
    "strategy",
    "best practice",
    "should",
    "safer",
    "enough",
    "survive",
    "business impact",
    "management",
    "executive",
    "risk",
    "compare",
    "what should",
    "how often should",
    "small company",
    "sme",
    "cloud backup",
    "local backup",
    "pilves",
    "kohapeal",
    "vaike firma",
    "vaike ettevote",
    "kas vaike",
    "kui suur probleem",
    "mis on olulisem",
    "что важнее",
    "обычной фирме",
    "малой фирме",
    "нужен план",
    "лучше",
    "достаточно",
    "насколько серьезно",
]

GENERAL_ADVISORY_TOPICS = [
    "ransomware",
    "lunavara",
    "backup",
    "varukoop",
    "restore",
    "taast",
    "mfa",
    "2fa",
    "patch",
    "uuendus",
    "admin",
    "privilege",
    "incident",
    "intsident",
    "response",
    "monitor",
    "logging",
    "logid",
    "evidence",
    "toend",
    "risk",
    "business",
    "juhtkond",
    "management",
    "отчет",
    "резерв",
    "реагирован",
    "рис",
]

QUESTION_WORDS = [
    "kes",
    "mis",
    "mida",
    "miks",
    "kuidas",
    "kus",
    "millal",
    "milline",
    "millised",
    "kas",
    "what",
    "who",
    "why",
    "how",
    "where",
    "when",
    "which",
    "что",
    "кто",
    "почему",
    "как",
    "где",
    "когда",
    "какой",
    "какая",
    "какие",
]

SMALLTALK_HINTS = [
    "tere",
    "hei",
    "hello",
    "hi",
    "kuidas laheb",
    "kuidas läheb",
    "how are you",
    "how's it going",
    "hows it going",
    "как дела",
    "aitäh",
    "aitah",
    "tänan",
    "tanan",
    "thanks",
    "спасибо",
    "привет",
]

ACKNOWLEDGEMENT_HINTS = [
    "ok",
    "okei",
    "okey",
    "oke",
    "selge",
    "arusaadav",
    "sain aru",
    "got it",
    "understood",
    "roger",
]

ANSWER_HINTS = [
    "jah",
    "yes",
    "да",
    "on olemas",
    "olemas",
    "kasutame",
    "teeme",
    "tehakse",
    "ei",
    "no",
    "нет",
    "pole",
    "puudub",
    "ei ole",
    "osaliselt",
    "частично",
    "mõnel",
    "monel",
    "ainult",
    "ei tea",
    "unsure",
    "not sure",
    "не знаю",
]

CORRECTION_TURN_HINTS = [
    "tegelikult",
    "pigem",
    "parandan",
    "mootlesin",
    "motlesin",
    "mootlen",
    "motlen",
    "mitte see",
    "vaid",
]

CURRENT_QUESTION_REPLY_STOPWORDS = {
    "kas",
    "mis",
    "mida",
    "miks",
    "kuidas",
    "milline",
    "millised",
    "millal",
    "see",
    "seda",
    "selle",
    "need",
    "ning",
    "voi",
    "on",
    "ega",
}

OFFENSIVE_REQUEST_HINTS = [
    "bypass mfa",
    "bypassing mfa",
    "bypass 2fa",
    "bypassing 2fa",
    "bypass authentication",
    "steal credentials",
    "credential theft",
    "credential stealing",
    "dump passwords",
    "crack passwords",
    "phishing kit",
    "write ransomware",
    "ransomware code",
    "encrypt files for ransom",
    "malware analysis",
    "malware analysis steps",
    "analyze malware",
    "malware reverse engineering",
    "create malware",
    "deploy malware",
    "persistence",
    "evasion",
    "edr bypass",
    "disable antivirus",
    "privilege escalation exploit",
    "lateral movement",
    "reverse shell",
    "shellcode",
    "metasploit",
    "exploit a system",
    "exploit this cve",
    "exploit workflow",
    "red team execution",
    "обойти mfa",
    "обойти 2fa",
    "обойти аутентификацию",
    "украсть учетные данные",
    "украсть учётные данные",
    "вредоносное по",
    "написать ransomware",
    "написать малварь",
    "закрепление в системе",
    "обход edr",
    "отключить антивирус",
    "повышение привилегий",
]

QUESTION_KEYWORDS = {
    "org_critical_systems_known": [
        "kriitilised süsteemid",
        "kriitilised susteemid",
        "kriitilised andmed",
        "andmed",
        "süsteemid",
        "susteemid",
        "critical systems",
    ],
    "backups_exist": ["backup", "backupid", "varukoopia", "varukoopiad", "koopiad"],
    "backup_frequency_defined": ["sagedus", "iga päev", "iga paev", "iga nädal", "iga nadal", "backup job"],
    "restore_tested": ["taastamist", "taastamine", "taastatud", "restore", "restoration", "testitud", "tested"],
    "backup_isolated": ["offline", "immutable", "eraldatud", "isoleeritud", "samas võrgus", "samas vorgus"],
    "rto_rpo_known": ["rto", "rpo", "andmekadu", "kui kiiresti", "taastada"],
    "mfa_admin": ["mfa", "admin", "administraator", "privilegeeritud"],
    "mfa_remote_access": ["mfa", "vpn", "rdp", "kaugligipääs", "kaugligipaas", "remote access"],
    "mfa_email_cloud": ["mfa", "e-post", "email", "pilv", "cloud", "m365", "office"],
    "unused_accounts_removed": ["vanad kontod", "kasutamata kontod", "lahkunud", "offboarding"],
    "patching_process_exists": ["patch", "patchimine", "uuendus", "uuendused", "turvauuendus"],
    "critical_patches_30_days": ["30 päeva", "30 paeva", "kriitilised uuendused", "critical patches"],
    "internet_facing_known": ["internet", "avalik", "internet-facing", "vpn", "rdp", "veebiserver"],
    "unsupported_systems_known": ["vananenud", "tootjatoeta", "unsupported", "legacy"],
    "least_privilege": ["least privilege", "adminõigus", "adminoigus", "admin õigused", "admin oigused"],
    "separate_admin_accounts": ["eraldi admin", "admin-konto", "admin konto", "igapäevane konto", "igapaevane konto"],
    "admin_rights_reviewed": ["õiguste ülevaatus", "oiguste ulevaatus", "üle vaadatakse", "ule vaadatakse"],
    "third_party_access_controlled": ["teenusepakkuja", "partner", "väline", "valine", "third party"],
    "ir_plan_exists": ["incident response", "ir plaan", "ir plan", "intsidendi plaan", "ransomware plaan"],
    "ir_roles_contacts": ["kontaktid", "otsustajad", "eskalatsioon", "roles", "contacts"],
    "ir_plan_tested": ["tabletop", "harjutatud", "läbi harjutatud", "labi harjutatud", "plaani test"],
    "external_reporting_known": ["cert-ee", "jurist", "kindlustus", "õiguskaitse", "oiguskaitse", "reporting"],
    "logs_centralized": ["log", "logid", "logging", "siem", "centralized", "keskelt"],
    "endpoint_alerts_monitored": ["endpoint", "antivirus", "edr", "hoiatus", "alert"],
    "failed_logins_monitored": ["ebaonnestunud", "ebaõnnestunud", "failed login", "sisselogim"],
    "file_integrity_or_mass_change_alerts": ["file integrity", "massiline", "failimuudatus", "kaust", "krupteer"],
    "vulnerability_inventory_known": ["haavatav", "vulnerability", "vananenud", "inventory", "tarkvara"],
    "password_manager_used": ["paroolihaldur", "password manager", "paroolide korduvkasutus"],
    "employee_mfa_enabled": ["töötaja mfa", "tootaja mfa", "employee mfa"],
    "phishing_awareness_basic": ["phishing", "kahtlane kiri", "kahtlane link"],
    "devices_updated": ["brauser", "browser", "tööseade", "tooseade", "operatsioonisüsteem", "operatsioonisusteem"],
    "recovery_codes_stored_safely": ["recovery code", "taastamise kood", "taastamiskood"],
}

RUSSIAN_HINT_RE = re.compile(r"[а-яА-ЯёЁ]")


def required_questions() -> list[dict[str, Any]]:
    return [q for q in load_questions() if q.get("required", True)]


def base_answers_only(answers: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {qid: value for qid, value in answers.items() if not qid.startswith("followup__")}


def missing_required_question_ids(answer_records: dict[str, dict[str, Any]]) -> list[str]:
    return [q["id"] for q in required_questions() if q["id"] not in answer_records]


def next_missing_question(answer_records: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    missing = set(missing_required_question_ids(answer_records))
    for q in required_questions():
        if q["id"] in missing:
            return q
    return None


def preliminary_missing_domains(answer_records: dict[str, dict[str, Any]]) -> list[str]:
    qmap = question_map()
    answered_domains = {qmap[qid]["domain"] for qid in answer_records if qid in qmap}
    return [domain for domain in PRELIMINARY_DOMAINS if domain not in answered_domains]


def has_preliminary_completion(answer_records: dict[str, dict[str, Any]]) -> bool:
    return not preliminary_missing_domains(answer_records)


def should_generate_preliminary_report(answer_records: dict[str, dict[str, Any]]) -> bool:
    return bool(answer_records) and has_preliminary_completion(answer_records)


def looks_like_finish_request(message: str) -> bool:
    return classify_user_intent(message) == "report_request"


def looks_like_advisory_question(message: str) -> bool:
    return classify_user_intent(message) in {"clarification", "general_advisory_chat"}


def _legacy_classify_user_intent(message: str, current_question: dict[str, Any] | None = None) -> Intent:
    text = _normalize(message)
    raw = message.strip()
    if not text:
        return "smalltalk"
    if _contains_any(text, REPORT_HINTS):
        return "report_request"
    if _is_short_yes(text):
        return "answer"
    if _is_smalltalk(text):
        return "smalltalk"

    has_question_mark = "?" in raw or "？" in raw
    has_clarification_hint = _contains_any(text, CLARIFICATION_HINTS)
    has_question_word = _has_question_word(text)
    has_answer_signal = _has_answer_signal(text)

    if has_clarification_hint:
        return "clarification"
    if has_question_mark or has_question_word:
        if has_answer_signal and _looks_like_direct_answer(text, current_question):
            return "answer"
        return "clarification"
    if has_answer_signal or len(text.split()) >= 3:
        return "answer"
    return "unknown"


def answer_client_question_with_llm(
    user_message: str,
    current_question: dict[str, Any] | None,
    current_answers: dict[str, dict[str, Any]],
    org_info: dict[str, Any] | None = None,
    trace_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    language = detect_language(user_message)
    q_context = current_question or next_missing_question(current_answers)
    if looks_like_offensive_request(user_message):
        return defensive_refusal(user_message, q_context)

    source_ids = _knowledge_source_ids()
    _trace_retrieval(
        trace_context,
        intent="clarification",
        response_type="client_question",
        provider="knowledge_base",
        used_fallback=False,
        retrieved_source_count=len(source_ids),
        knowledge_source_ids=source_ids,
    )
    if not is_real_llm_configured():
        _trace_llm_call(
            trace_context,
            intent="clarification",
            response_type="ai_unavailable",
            provider=str(get_llm_settings()["provider"]),
            used_fallback=False,
            retrieved_source_count=len(source_ids),
            knowledge_source_ids=source_ids,
            latency_ms=0,
        )
        return _unavailable_chat_reply(provider=str(get_llm_settings()["provider"]), error="Real LLM provider is not configured.")

    current_answer = _current_question_answer(q_context, current_answers)
    advisory_focus = _advisory_focus(user_message, q_context)
    redacted_message, message_redactions = redact_sensitive_text(user_message)
    redacted_answers, answer_redactions = _redact_answer_records(current_answers)
    redactions = _merge_redactions(message_redactions, answer_redactions)
    context_payload = build_advisor_context(
        user_message=redacted_message,
        language=language,
        current_question=q_context,
        current_answers=redacted_answers,
        org_info=org_info or {},
    )

    started = perf_counter()
    result = generate_text(
        prompt=json.dumps(context_payload, ensure_ascii=False, indent=2),
        system_prompt=load_prompt("advisor_prompt.txt"),
        temperature=0.25,
    )
    latency_ms = (perf_counter() - started) * 1000

    if not result.used_real_llm or not result.text.strip():
        _trace_llm_call(
            trace_context,
            intent="clarification",
            response_type="ai_unavailable",
            provider=result.provider,
            used_fallback=False,
            retrieved_source_count=len(source_ids),
            knowledge_source_ids=source_ids,
            latency_ms=latency_ms,
        )
        return _unavailable_chat_reply(provider=result.provider, error=result.error or "Real LLM provider call failed.")

    message = normalize_assistant_text(result.text.strip(), language, q_context, current_answer)
    if not _is_identity_question(user_message):
        message = _strip_unrequested_identity(message)
    if advisory_focus == "six_month_restore_test":
        message = _ensure_six_month_explanation(message)
    if _is_identity_question(user_message) and not _contains_any(_normalize(message), ["olen ransomware readiness", "i am ransomware readiness"]):
        message = f"{_identity_text(language)}\n\n{message}"
    _trace_llm_call(
        trace_context,
        intent="clarification",
        response_type="client_question",
        provider=result.provider,
        used_fallback=False,
        retrieved_source_count=len(source_ids),
        knowledge_source_ids=source_ids,
        latency_ms=latency_ms,
    )

    return {
        "message": message,
        "provider": result.provider,
        "used_fallback": False,
        "model": result.model,
        "error": result.error,
        "redactions_applied": redactions,
        "redacted_for_llm": bool(redactions),
        "grounded_answer_quality": _grounded_answer_quality(language, used_knowledge=False, safety_blocked=False),
    }


def answer_general_advisory_with_llm(
    user_message: str,
    current_question: dict[str, Any] | None,
    current_answers: dict[str, dict[str, Any]],
    org_info: dict[str, Any] | None = None,
    trace_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    language = detect_language(user_message)
    q_context = current_question or next_missing_question(current_answers)
    if looks_like_offensive_request(user_message):
        return defensive_refusal(user_message, q_context)

    source_ids = _knowledge_source_ids()
    _trace_retrieval(
        trace_context,
        intent="general_advisory_chat",
        response_type="general_advisory_chat",
        provider="knowledge_base",
        used_fallback=False,
        retrieved_source_count=len(source_ids),
        knowledge_source_ids=source_ids,
    )
    if not is_real_llm_configured():
        _trace_llm_call(
            trace_context,
            intent="general_advisory_chat",
            response_type="ai_unavailable",
            provider=str(get_llm_settings()["provider"]),
            used_fallback=False,
            retrieved_source_count=len(source_ids),
            knowledge_source_ids=source_ids,
            latency_ms=0,
        )
        return _unavailable_chat_reply(provider=str(get_llm_settings()["provider"]), error="Real LLM provider is not configured.")

    redacted_message, message_redactions = redact_sensitive_text(user_message)
    redacted_answers, answer_redactions = _redact_answer_records(current_answers)
    redactions = _merge_redactions(message_redactions, answer_redactions)
    context_payload = build_general_advisory_context(
        user_message=redacted_message,
        language=language,
        current_question=q_context,
        current_answers=redacted_answers,
        org_info=org_info or {},
    )

    started = perf_counter()
    result = generate_text(
        prompt=json.dumps(context_payload, ensure_ascii=False, indent=2),
        system_prompt=load_prompt("general_advisory_prompt.txt"),
        temperature=0.3,
    )
    latency_ms = (perf_counter() - started) * 1000

    if not result.used_real_llm or not result.text.strip():
        _trace_llm_call(
            trace_context,
            intent="general_advisory_chat",
            response_type="ai_unavailable",
            provider=result.provider,
            used_fallback=False,
            retrieved_source_count=len(source_ids),
            knowledge_source_ids=source_ids,
            latency_ms=latency_ms,
        )
        return _unavailable_chat_reply(provider=result.provider, error=result.error or "Real LLM provider call failed.")

    message = normalize_general_advisory_text(
        result.text.strip(),
        language=language,
        advisory_domain=context_payload["advisory_domain"],
        current_question=q_context,
        user_message=user_message,
    )
    if not _is_identity_question(user_message):
        message = _strip_unrequested_identity(message)
    _trace_llm_call(
        trace_context,
        intent="general_advisory_chat",
        response_type="general_advisory_chat",
        provider=result.provider,
        used_fallback=False,
        retrieved_source_count=len(source_ids),
        knowledge_source_ids=source_ids,
        latency_ms=latency_ms,
    )

    return {
        "message": message,
        "provider": result.provider,
        "used_fallback": False,
        "model": result.model,
        "error": result.error,
        "redactions_applied": redactions,
        "redacted_for_llm": bool(redactions),
        "grounded_answer_quality": _grounded_answer_quality(language, used_knowledge=False, safety_blocked=False),
    }


def build_general_advisory_context(
    user_message: str,
    language: str,
    current_question: dict[str, Any] | None,
    current_answers: dict[str, dict[str, Any]],
    org_info: dict[str, Any],
) -> dict[str, Any]:
    advisory_domain = _advisory_domain(user_message, current_question)
    return {
        "user_question": user_message,
        "response_language": language,
        "current_interview_question": current_question,
        "current_question_text": get_current_question_text(current_question),
        "current_question_answer": _current_question_answer(current_question, current_answers),
        "current_domain_summary": get_domain_summary(current_question),
        "advisory_domain": advisory_domain,
        "message_topic_matches_current_question": _message_topic_matches_current_question(user_message, current_question),
        "defensive_skill_context": build_skill_context_for_domain(advisory_domain, current_answers),
        "answered_question_ids": list(current_answers.keys()),
        "organization_info": org_info,
        "domain_metadata": load_domain_metadata(),
        "conversation_rules": [
            "Answer the user's general advisory question directly.",
            "If the user's topic is different from the active assessment question, acknowledge that briefly before answering.",
            "Do not treat this as a questionnaire answer.",
            "Do not infer or save assessment answers.",
            "Do not move the interview forward.",
            "Do not calculate or estimate the official score.",
            "Keep guidance defensive-only and practical.",
            "Do not invent organization facts.",
            "If useful, include one short bridge back to the assessment context, but do not repeat the full active question.",
        ],
    }


def _grounded_answer_quality(language: str, used_knowledge: bool, safety_blocked: bool) -> dict[str, Any]:
    validated = validate_grounded_answer_quality(
        {
            "used_knowledge": used_knowledge,
            "source_count": len(load_source_notes()) if used_knowledge else 0,
            "missing_context": False,
            "safety_blocked": safety_blocked,
            "answer_language": language,
        }
    )
    if validated is None:
        return {
            "used_knowledge": used_knowledge,
            "source_count": 0,
            "missing_context": True,
            "safety_blocked": safety_blocked,
            "answer_language": language,
        }
    return validated.model_dump()


def _knowledge_source_ids() -> list[str]:
    return [str(item.get("name", "")) for item in load_source_notes() if str(item.get("name", "")).strip()]


def _trace_retrieval(
    trace_context: dict[str, Any] | None,
    *,
    intent: str,
    response_type: str,
    provider: str,
    used_fallback: bool,
    retrieved_source_count: int,
    knowledge_source_ids: list[str],
) -> None:
    if not trace_context:
        return
    trace_retrieval_event(
        session_id=str(trace_context.get("session_id", "")),
        request_id=str(trace_context.get("request_id", "")),
        intent=intent,
        response_type=response_type,
        provider=provider,
        used_fallback=used_fallback,
        current_question_id=trace_context.get("current_question_id"),
        current_domain=trace_context.get("current_domain"),
        user_message=str(trace_context.get("user_message", "")),
        retrieved_source_count=retrieved_source_count,
        knowledge_source_ids=knowledge_source_ids,
    )


def _trace_llm_call(
    trace_context: dict[str, Any] | None,
    *,
    intent: str,
    response_type: str,
    provider: str,
    used_fallback: bool,
    should_save_answer: bool = False,
    confidence: str | float | None = None,
    retrieved_source_count: int = 0,
    knowledge_source_ids: list[str] | None = None,
    safety_blocked: bool = False,
    latency_ms: float | int | None = None,
) -> None:
    if not trace_context:
        return
    trace_llm_call_event(
        session_id=str(trace_context.get("session_id", "")),
        request_id=str(trace_context.get("request_id", "")),
        intent=intent,
        response_type=response_type,
        provider=provider,
        used_fallback=used_fallback,
        current_question_id=trace_context.get("current_question_id"),
        current_domain=trace_context.get("current_domain"),
        user_message=str(trace_context.get("user_message", "")),
        should_save_answer=should_save_answer,
        confidence=confidence,
        retrieved_source_count=retrieved_source_count,
        knowledge_source_ids=knowledge_source_ids or [],
        safety_blocked=safety_blocked,
        latency_ms=latency_ms,
    )


def build_advisor_context(
    user_message: str,
    language: str,
    current_question: dict[str, Any] | None,
    current_answers: dict[str, dict[str, Any]],
    org_info: dict[str, Any],
) -> dict[str, Any]:
    current_answer = _current_question_answer(current_question, current_answers)
    advisory_focus = _advisory_focus(user_message, current_question)
    advisory_domain = _advisory_domain(user_message, current_question)
    return {
        "user_question": user_message,
        "response_language": language,
        "advisory_focus": advisory_focus,
        "advisory_domain": advisory_domain,
        "current_interview_question": current_question,
        "current_question_text": get_current_question_text(current_question),
        "current_question_answer": current_answer,
        "current_question_is_already_answered": current_answer is not None,
        "current_domain_summary": get_domain_summary(current_question),
        "defensive_skill_context": build_skill_context_for_domain(advisory_domain, current_answers),
        "answered_question_ids": list(current_answers.keys()),
        "organization_info": org_info,
        "domain_metadata": load_domain_metadata(),
        "conversation_rules": [
            "Answer the client question first.",
            "Do not treat clarification questions as questionnaire answers.",
            "Do not introduce yourself unless the user asks who you are.",
            "If the user writes only 'mida', interpret it as: explain the current question in simpler words.",
            "If the user asks for examples, give 2-4 concrete examples for the current question.",
            "If advisory_focus is six_month_restore_test, explain why a recent restore test such as 6 months is used as a practical freshness check.",
            "Use defensive_skill_context for practical explanations, follow-up questions, recommended actions, and evidence examples.",
            "Explain what evidence would prove readiness, for example a restore test date and result for backup questions.",
            "Keep all guidance defensive-only. Refuse offensive hacking, malware, exploitation, MFA bypass, credential theft, persistence, or evasion requests.",
            "Do not say the user already answered the current question unless current_question_answer is not null.",
            "If current_question_answer is null, discuss the current question generally, not as already answered.",
            "Use simple business language for impact and next steps.",
            "Do not claim this is a full audit.",
            "Do not ask whether the user wants to move on.",
            "If useful, add one short bridge that the user can answer with yes, partial, no, or unsure.",
        ],
    }


def build_chat_turn_context(
    user_message: str,
    language: str,
    current_question: dict[str, Any] | None,
    current_answers: dict[str, dict[str, Any]],
    org_info: dict[str, Any],
    chat_history: list[dict[str, Any]] | None = None,
    is_new_session: bool = False,
) -> dict[str, Any]:
    advisory_domain = _advisory_domain(user_message, current_question)
    text = _normalize(user_message)
    return {
        "user_message": user_message,
        "response_language": language,
        "turn_kind": "smalltalk_or_unknown",
        "is_new_session": is_new_session,
        "message_kind": "acknowledgement" if _is_acknowledgement(text) else "smalltalk_or_unknown",
        "recent_chat_history": (chat_history or [])[-6:],
        "current_interview_question": current_question,
        "current_question_text": get_current_question_text(current_question),
        "current_question_answer": _current_question_answer(current_question, current_answers),
        "current_domain_summary": get_domain_summary(current_question),
        "defensive_skill_context": build_skill_context_for_domain(advisory_domain, current_answers),
        "answered_question_ids": list(current_answers.keys()),
        "organization_info": org_info,
        "domain_metadata": load_domain_metadata(),
        "conversation_rules": [
            "Reply conversationally and briefly to the user's latest message.",
            "Do not greet the user again unless this is the first assistant message in a new session.",
            "For acknowledgements, respond briefly and do not restart the interview.",
            "If the message is a greeting or thanks, acknowledge it naturally in one short sentence.",
            "If the message is ambiguous, do not invent an answer; explain briefly what kind of answer fits the active question.",
            "Use the active interview question and defensive_skill_context to stay on topic.",
            "Do not save or infer an assessment answer in this turn.",
            "Do not move the interview forward.",
            "Do not introduce yourself unless asked.",
            "Keep the tone calm, practical, and concise.",
            "Do not repeat or ask the current interview question again in the assistant text because the frontend already shows it.",
        ],
    }


def normalize_assistant_text(
    text: str,
    language: str,
    current_question: dict[str, Any] | None,
    current_answer: dict[str, Any] | None = None,
) -> str:
    del language
    cleaned = text.strip()
    cleaned = re.sub(
        r"^(Of course|Certainly|Sure|Absolutely|Loomulikult|Kindlasti|Jah, muidugi)[,!\s]+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = cleaned.replace("```", "").strip()
    if current_answer is None:
        cleaned = re.sub(r"Teie vastus on [^.?!]+[.?!]\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"Kuna olete öelnud[^.?!]+[.?!]\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = _strip_repeated_question_tail(cleaned, current_question)
    return cleaned.strip()


def normalize_general_advisory_text(
    text: str,
    *,
    language: str = "English",
    advisory_domain: str = "",
    current_question: dict[str, Any] | None = None,
    user_message: str = "",
) -> str:
    cleaned = text.strip().replace("```", "").strip()
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    if _should_note_topic_mismatch(user_message, advisory_domain, current_question):
        note = _topic_mismatch_note(language)
        if note and not _contains_any(_normalize(cleaned), _topic_mismatch_note_hints(language)):
            cleaned = f"{note}\n\n{cleaned}"
    return cleaned.strip()


def _looks_like_how_to_judge_current_question(text: str) -> bool:
    return _contains_any(
        text,
        [
            "kuidas ma saan aru",
            "kuidas aru saada",
            "mille jargi",
            "mille järgi",
            "kuidas hinnata",
            "kuidas otsustada",
            "kuidas sellele vastata",
            "kuidas ma vastan",
            "how do i know",
            "how can i tell",
            "how should i answer",
            "what should count as",
            "как понять",
            "как оценить",
            "как ответить",
        ],
    )



def _practical_answering_guidance(current_question: dict[str, Any], language: str) -> str:
    question_id = str(current_question.get("id") or "")

    if question_id == "org_critical_systems_known":
        if language == "English":
            return (
                "Use a business-impact lens: which systems or data would stop work quickly if they were unavailable tomorrow?\n\n"
                "Typical examples are finance/accounting, customer data, email, identity access, file storage, production systems, and anything needed to deliver the core service.\n\n"
                "A simple check is: if this were down for one working day, what would stop sales, customer service, payroll, operations, or legal obligations?\n\n"
                "Answer `yes` if that list is known and people can point to it, `partial` if only some critical systems are identified, `no` if it is not mapped, and `unsure` if you do not know."
            )
        return (
            "Vaata seda ärimõju kaudu: milliste süsteemide või andmete kadumine peataks töö juba homme?\n\n"
            "Tüüpilised näited on raamatupidamine, kliendiandmed, e-post, identiteedid ja ligipääsud, failiserver, tootmissüsteemid ning muud teenused, ilma milleta põhitegevus seisab.\n\n"
            "Lihtne kontrollküsimus on: kui see oleks ühe tööpäeva maas, mis peataks müügi, teeninduse, palgaarvestuse, tegevuse või seadusest tulenevad kohustused?\n\n"
            "Vasta `yes`, kui see nimekiri on olemas ja inimesed oskavad sellele viidata; `partial`, kui ainult osa on läbi mõeldud; `no`, kui seda pole kaardistatud; ja `unsure`, kui sa ei tea."
        )

    if language == "English":
        return (
            "A practical way to answer is to check four things: whether the control really exists, how broadly it is used, whether it works consistently, and whether there is any proof.\n\n"
            "Answer `yes` if it is in place for the important systems or users, `partial` if coverage is incomplete or inconsistent, `no` if it does not exist, and `unsure` if the status is not known."
        )
    return (
        "Praktiline viis vastata on vaadata nelja asja: kas see kontroll on päriselt olemas, kui laialt see katab olulised süsteemid või kasutajad, kas see toimib järjepidevalt ning kas selle kohta on mingi tõend.\n\n"
        "Vasta `yes`, kui see on olulises osas olemas ja toimib; `partial`, kui katvus on puudulik või ebaühtlane; `no`, kui seda praegu pole; ja `unsure`, kui tegelik seis pole teada."
    )


def _rto_rpo_term_explanation(text: str, language: str) -> str:
    asks_rto = bool(re.search(r"\brto\b", text))
    asks_rpo = bool(re.search(r"\brpo\b", text))

    if language == "English":
        if asks_rto and asks_rpo:
            return (
                "RTO means how quickly a critical system should be restored after an incident. "
                "RPO means how much data loss is acceptable, for example whether losing the last 1 hour or 24 hours of changes would still be tolerable.\n\n"
                "In this question, the practical point is whether the organization already knows those restoration and data-loss targets for critical systems."
            )
        if asks_rto:
            return (
                "RTO means Recovery Time Objective: how quickly a critical system should be restored after an incident.\n\n"
                "In this question, the practical point is whether that target time is known for the systems that matter most."
            )
        return (
            "RPO means Recovery Point Objective: how much data loss is acceptable, for example whether losing the last 1 hour or 24 hours of changes would still be tolerable.\n\n"
            "In this question, the practical point is whether that acceptable data-loss target is known for critical systems."
        )

    if language == "Russian":
        if asks_rto and asks_rpo:
            return (
                "RTO — это за какое время критичную систему нужно восстановить после инцидента. "
                "RPO — это какой объём потери данных допустим, например можно ли пережить потерю последних 1 часа или 24 часов изменений.\n\n"
                "С практической точки зрения вопрос здесь в том, знает ли организация эти целевые сроки восстановления и допустимую потерю данных для критичных систем."
            )
        if asks_rto:
            return (
                "RTO означает Recovery Time Objective: за какое время критичную систему нужно восстановить после инцидента.\n\n"
                "Практический смысл этого вопроса — известно ли это целевое время для самых важных систем."
            )
        return (
            "RPO означает Recovery Point Objective: какой объём потери данных допустим, например можно ли пережить потерю последних 1 часа или 24 часов изменений.\n\n"
            "Практический смысл этого вопроса — известен ли этот допустимый предел потери данных для критичных систем."
        )

    if asks_rto and asks_rpo:
        return (
            "RTO tähendab, kui kiiresti peab kriitilise süsteemi pärast intsidenti taastama. "
            "RPO tähendab, kui palju andmekadu on lubatav, näiteks kas viimase 1 tunni või 24 tunni muudatuste kaotus oleks veel talutav.\n\n"
            "Selle küsimuse praktiline mõte on, kas organisatsioon juba teab neid taastamise sihtaegu ja lubatava andmekao piire kriitiliste süsteemide jaoks."
        )
    if asks_rto:
        return (
            "RTO tähendab Recovery Time Objective: kui kiiresti peab kriitilise süsteemi pärast intsidenti taastama.\n\n"
            "Selle küsimuse praktiline mõte on, kas see sihtaeg on kõige olulisemate süsteemide jaoks teada."
        )
    return (
        "RPO tähendab Recovery Point Objective: kui palju andmekadu on lubatav, näiteks kas viimase 1 tunni või 24 tunni muudatuste kaotus oleks veel talutav.\n\n"
        "Selle küsimuse praktiline mõte on, kas see lubatav andmekao piir on kriitiliste süsteemide jaoks teada."
    )


def _append_practical_evidence_hint(text: str, answer: str) -> str:
    if "hea tõend" in _normalize(answer) or "hea toend" in _normalize(answer):
        return answer

    hint = ""
    if _contains_any(text, ["taast", "restore"]):
        hint = "Hea tõend oleks viimase restore testi kuupäev, taastatud süsteemi nimi ning RTO/RPO tulemus."
    elif _contains_any(text, ["backup", "varukoop"]):
        hint = "Hea tõend oleks backupi graafik, viimaste backup jobide tulemused ja viimase taastamistesti tulemus."
    elif _contains_any(text, ["mfa", "mitmefaktor"]):
        hint = "Hea tõend oleks MFA katvuse raport või seadistuse kuvatõmmis admin-kontode, e-posti ja kaugligipääsu kohta."
    elif _contains_any(text, ["incident", "intsident", "ir", "tabletop"]):
        hint = "Hea tõend oleks IR plaan, kontaktide nimekiri ja viimase tabletop-harjutuse kuupäev või märkmed."
    elif _contains_any(text, ["patch", "uuendus"]):
        hint = "Hea tõend oleks viimase patch report'i väljavõte ja nimekiri internetist ligipääsetavatest teenustest."
    elif _contains_any(text, ["admin", "oigus", "õigus", "privilege"]):
        hint = "Hea tõend oleks praegune privilegeeritud kasutajate nimekiri ja viimase õiguste ülevaatuse kuupäev."

    return f"{answer}\n\n{hint}" if hint else answer


def answer_smalltalk_with_llm(
    message: str,
    current_question: dict[str, Any] | None,
    current_answers: dict[str, dict[str, Any]] | None = None,
    org_info: dict[str, Any] | None = None,
    chat_history: list[dict[str, Any]] | None = None,
    is_new_session: bool = False,
    trace_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    current_answers = current_answers or {}
    org_info = org_info or {}

    if looks_like_offensive_request(message):
        return defensive_refusal(message, current_question)
    if not is_real_llm_configured():
        _trace_llm_call(
            trace_context,
            intent="smalltalk",
            response_type="ai_unavailable",
            provider=str(get_llm_settings()["provider"]),
            used_fallback=False,
            latency_ms=0,
        )
        return _unavailable_chat_reply(provider=str(get_llm_settings()["provider"]), error="Real LLM provider is not configured.")

    language = detect_language(message)
    redacted_message, message_redactions = redact_sensitive_text(message)
    redacted_answers, answer_redactions = _redact_answer_records(current_answers)
    redactions = _merge_redactions(message_redactions, answer_redactions)
    context_payload = build_chat_turn_context(
        user_message=redacted_message,
        language=language,
        current_question=current_question,
        current_answers=redacted_answers,
        org_info=org_info,
        chat_history=chat_history,
        is_new_session=is_new_session,
    )
    started = perf_counter()
    result = generate_text(
        prompt=json.dumps(context_payload, ensure_ascii=False, indent=2),
        system_prompt=load_prompt("chat_turn_prompt.txt"),
        temperature=0.3,
    )
    latency_ms = (perf_counter() - started) * 1000
    if not result.used_real_llm or not result.text.strip():
        _trace_llm_call(
            trace_context,
            intent="smalltalk",
            response_type="ai_unavailable",
            provider=result.provider,
            used_fallback=False,
            latency_ms=latency_ms,
        )
        return _unavailable_chat_reply(provider=result.provider, error=result.error or "Real LLM provider call failed.")

    normalized = normalize_smalltalk_text(
        result.text.strip(),
        language=language,
        is_new_session=is_new_session,
        is_acknowledgement=_is_acknowledgement(_normalize(message)),
    )
    if not _is_identity_question(message):
        normalized = _strip_unrequested_identity(normalized)
    _trace_llm_call(
        trace_context,
        intent="smalltalk",
        response_type="smalltalk",
        provider=result.provider,
        used_fallback=False,
        latency_ms=latency_ms,
    )
    return {
        "message": normalized,
        "provider": result.provider,
        "used_fallback": False,
        "model": result.model,
        "error": result.error,
        "redactions_applied": redactions,
        "redacted_for_llm": bool(redactions),
    }


def extract_answers_with_llm(
    user_message: str,
    questions: list[dict[str, Any]],
    current_answers: dict[str, dict[str, Any]],
    current_question: dict[str, Any] | None,
    trace_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    deterministic_intent = classify_user_intent(user_message, current_question)
    if deterministic_intent != "answer":
        return _empty_extraction(deterministic_intent)

    if get_llm_settings()["provider"] == "fallback":
        _trace_llm_call(
            trace_context,
            intent="answer",
            response_type="interview_answer",
            provider="fallback",
            used_fallback=True,
            should_save_answer=True,
            latency_ms=0,
        )
        fallback = fallback_extract_answers(user_message, questions, current_question)
        fallback["redactions_applied"] = []
        fallback["redacted_for_llm"] = False
        return fallback

    redacted_message, message_redactions = redact_sensitive_text(user_message)
    redacted_answers, answer_redactions = _redact_answer_records(current_answers)
    redactions = _merge_redactions(message_redactions, answer_redactions)
    compact_questions = [
        {
            "id": q["id"],
            "domain": q["domain"],
            "question": q["question"],
            "options": q.get("options", []),
            "required": q.get("required", True),
        }
        for q in questions
    ]
    prompt_payload = {
        "deterministic_intent_hint": deterministic_intent,
        "current_question": current_question,
        "questions": compact_questions,
        "current_known_answers": redacted_answers,
        "user_message": redacted_message,
        "required_json_schema_example": {
            "intent": "answer|clarification|general_advisory_chat|report_request|smalltalk|unknown",
            "extracted_answers": {"question_id": "yes|partial|no|unsure"},
            "unclear_questions": ["question_id"],
            "confidence": {"question_id": 0.0},
            "needs_clarification": True,
            "clarification_question": "short Estonian question",
        },
    }
    started = perf_counter()
    result = generate_text(
        prompt=json.dumps(prompt_payload, ensure_ascii=False, indent=2),
        system_prompt=load_prompt("extraction_prompt.txt"),
        temperature=0,
    )
    latency_ms = (perf_counter() - started) * 1000
    parsed = parse_json_from_llm(result.text)
    if not result.used_real_llm or not parsed:
        _trace_llm_call(
            trace_context,
            intent="answer",
            response_type="interview_answer",
            provider=result.provider,
            used_fallback=True,
            should_save_answer=True,
            latency_ms=latency_ms,
        )
        fallback = fallback_extract_answers(user_message, questions, current_question)
        fallback["llm_error"] = result.error or "LLM did not return valid extraction JSON."
        fallback["redactions_applied"] = redactions
        fallback["redacted_for_llm"] = bool(redactions)
        return fallback

    parsed_intent = _normalize_intent(parsed.get("intent"), deterministic_intent)
    decision = _validate_llm_intent_decision(parsed, parsed_intent)
    if decision is None:
        _trace_llm_call(
            trace_context,
            intent="unknown",
            response_type="interview_answer",
            provider=result.provider,
            used_fallback=True,
            should_save_answer=False,
            latency_ms=latency_ms,
        )
        fallback = fallback_extract_answers(user_message, questions, current_question)
        fallback["llm_error"] = "LLM intent decision failed structured validation."
        fallback["redactions_applied"] = redactions
        fallback["redacted_for_llm"] = bool(redactions)
        return fallback

    if deterministic_intent == "answer" and parsed_intent != "answer":
        _trace_llm_call(
            trace_context,
            intent=parsed_intent,
            response_type="interview_answer",
            provider=result.provider,
            used_fallback=True,
            should_save_answer=False,
            latency_ms=latency_ms,
        )
        guarded = fallback_extract_answers(user_message, questions, current_question)
        guarded["provider"] = result.provider
        guarded["used_fallback"] = False
        guarded["llm_error"] = f"LLM returned intent '{parsed_intent}', but deterministic answer signal was used."
        guarded["redactions_applied"] = redactions
        guarded["redacted_for_llm"] = bool(redactions)
        return guarded

    validated = validate_extraction(parsed, questions, current_question, deterministic_intent)
    if validated.get("contract_validation_failed"):
        _trace_llm_call(
            trace_context,
            intent="answer",
            response_type="interview_answer",
            provider=result.provider,
            used_fallback=True,
            should_save_answer=False,
            latency_ms=latency_ms,
        )
        guarded = fallback_extract_answers(user_message, questions, current_question)
        guarded["provider"] = result.provider
        guarded["used_fallback"] = False
        guarded["llm_error"] = "LLM extracted answers failed structured validation."
        guarded["redactions_applied"] = redactions
        guarded["redacted_for_llm"] = bool(redactions)
        return guarded
    validated["provider"] = result.provider
    validated["used_fallback"] = False
    validated["llm_error"] = result.error
    validated["redactions_applied"] = redactions
    validated["redacted_for_llm"] = bool(redactions)
    _trace_llm_call(
        trace_context,
        intent=validated.get("intent", "answer"),
        response_type="interview_answer",
        provider=result.provider,
        used_fallback=False,
        should_save_answer=bool(validated.get("extracted_answers")),
        confidence=max((validated.get("confidence") or {}).values(), default=None),
        latency_ms=latency_ms,
    )
    return validated


def validate_extraction(
    parsed: dict[str, Any],
    questions: list[dict[str, Any]],
    current_question: dict[str, Any] | None,
    fallback_intent: Intent = "answer",
) -> dict[str, Any]:
    qmap = {q["id"]: q for q in questions}
    intent = _normalize_intent(parsed.get("intent"), fallback_intent)
    if intent != "answer":
        return _empty_extraction(intent, provider="openai", used_fallback=False)

    extracted: dict[str, str] = {}
    confidence: dict[str, float] = {}
    unclear: list[str] = []
    contract_validation_failed = False

    raw_answers = parsed.get("extracted_answers", {})
    if isinstance(raw_answers, dict):
        for qid, value in raw_answers.items():
            if qid not in qmap:
                continue
            answer = value.get("answer") if isinstance(value, dict) else value
            if answer is None:
                continue
            normalized_answer = str(answer).strip().lower()
            if normalized_answer in {"dont_know", "don't know", "unknown"}:
                normalized_answer = "unsure"
            candidate = validate_extracted_answer(
                {
                    "question_id": qid,
                    "answer": normalized_answer,
                    "confidence": _raw_confidence_value(parsed.get("confidence", {}), qid),
                    "details": "",
                    "should_advance": True,
                }
            )
            if candidate is None:
                LOGGER.warning("Rejected extracted answer for question_id=%s due to contract validation failure.", qid)
                unclear.append(qid)
                contract_validation_failed = True
                continue
            if candidate.answer in qmap[qid].get("options", []):
                extracted[qid] = candidate.answer
                confidence[qid] = candidate.confidence
            else:
                unclear.append(qid)

    raw_unclear = parsed.get("unclear_questions", [])
    if isinstance(raw_unclear, list):
        for qid in raw_unclear:
            if qid in qmap and qid not in extracted and qid not in unclear:
                unclear.append(qid)

    raw_confidence = parsed.get("confidence", {})
    if isinstance(raw_confidence, dict):
        for qid, value in raw_confidence.items():
            if qid not in qmap or qid in confidence:
                continue
            try:
                confidence[qid] = float(value)
            except (TypeError, ValueError):
                continue

    if current_question and not extracted and current_question["id"] not in unclear:
        unclear.append(current_question["id"])

    clarification = str(parsed.get("clarification_question") or "").strip()
    if not clarification and unclear:
        clarification = default_clarification_question(qmap[unclear[0]])

    return {
        "intent": "answer",
        "extracted_answers": extracted,
        "unclear_questions": unclear,
        "confidence": confidence,
        "needs_clarification": bool(parsed.get("needs_clarification", bool(unclear))) and bool(unclear),
        "clarification_question": clarification,
        "provider": "fallback",
        "used_fallback": True,
        "llm_error": None,
        "contract_validation_failed": contract_validation_failed,
    }


def _validate_llm_intent_decision(parsed: dict[str, Any], parsed_intent: str) -> Any | None:
    raw_intent = str(parsed.get("intent") or "").strip().lower()
    raw_answers = parsed.get("extracted_answers", {})
    first_question_id: str | None = None
    first_answer: str | None = None
    if isinstance(raw_answers, dict):
        for qid, value in raw_answers.items():
            first_question_id = str(qid).strip() or None
            first_answer = str(value.get("answer") if isinstance(value, dict) else value).strip().lower() or None
            break

    contract_intent = "interview_answer" if raw_intent == "answer" else raw_intent
    decision = validate_intent_decision(
        {
            "intent": contract_intent,
            "should_save_answer": bool(raw_answers),
            "question_id": first_question_id,
            "answer": first_answer,
            "confidence": _raw_confidence_value(parsed.get("confidence", {}), first_question_id),
            "reason": str(parsed.get("clarification_question") or ""),
            "needs_knowledge": parsed_intent in {"general_advisory_chat", "knowledge_grounded_answer"},
        }
    )
    if decision is None:
        LOGGER.warning("Rejected LLM intent decision due to contract validation failure.")
    return decision


def _raw_confidence_value(raw_confidence: Any, question_id: str | None) -> float:
    if not isinstance(raw_confidence, dict) or not question_id:
        return 0.0
    value = raw_confidence.get(question_id)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def decide_chat_turn_with_llm(
    *,
    user_message: str,
    current_question: dict[str, Any] | None,
    current_answers: dict[str, dict[str, Any]],
    pending_answer: dict[str, Any] | None = None,
    chat_history: list[dict[str, Any]] | None = None,
    is_new_session: bool = False,
    org_info: dict[str, Any] | None = None,
    trace_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    language = detect_language(user_message)
    if looks_like_offensive_request(user_message):
        return {
            "available": True,
            "provider": "guardrail",
            "used_fallback": False,
            "decision": {
                "action": "refuse",
                "normalized_answer": None,
                "confidence": 1.0,
                "reason": "Unsafe or offensive request.",
                "user_visible_response": "",
                "should_advance_question": False,
                "should_save_answer": False,
            },
            "llm_error": None,
        }

    app_env = get_app_env()
    fallback_allowed = ai_fallback_user_visible() and (
        app_env == "test" or (app_env == "development" and allow_scripted_ai_fallback())
    )
    if not is_real_llm_configured():
        if fallback_allowed:
            return {
                "available": True,
                "provider": "fallback",
                "used_fallback": True,
                "decision": _fallback_chat_decision(user_message, current_question, language),
                "llm_error": None,
            }
        return {
            "available": False,
            "provider": "fallback",
            "used_fallback": False,
            "decision": None,
            "llm_error": "Real LLM provider is not configured.",
        }

    prompt_payload = {
        "user_message": user_message,
        "response_language": language,
        "current_question": current_question or {},
        "message_topic_domain": _advisory_domain(user_message, current_question),
        "message_topic_matches_current_question": _message_topic_matches_current_question(user_message, current_question),
        "assessment_progress": _compact_router_assessment_context(current_answers, current_question),
        "pending_answer": pending_answer or None,
        "is_new_session": is_new_session,
        "recent_chat_history": _compact_router_chat_history(chat_history),
        "org_info": _compact_org_info(org_info or {}),
    }
    started = perf_counter()
    result = generate_text(
        prompt=json.dumps(prompt_payload, ensure_ascii=False, indent=2),
        system_prompt=load_prompt("chat_decision_prompt.txt"),
        temperature=0,
        max_output_tokens=192,
    )
    latency_ms = (perf_counter() - started) * 1000
    parsed = parse_json_from_llm(result.text)
    decision = validate_chat_decision(parsed) if isinstance(parsed, dict) else None

    if (not result.used_real_llm or decision is None) and _needs_compact_llm_retry(result.error):
        compact_started = perf_counter()
        compact_result = generate_text(
            prompt=json.dumps(
                _compact_chat_decision_retry_payload(
                    user_message=user_message,
                    language=language,
                    current_question=current_question,
                    current_answers=current_answers,
                    pending_answer=pending_answer,
                    chat_history=chat_history,
                ),
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            system_prompt=COMPACT_CHAT_DECISION_SYSTEM_PROMPT,
            temperature=0,
            max_output_tokens=96,
        )
        latency_ms = (perf_counter() - compact_started) * 1000
        compact_parsed = parse_json_from_llm(compact_result.text)
        compact_decision = validate_chat_decision(compact_parsed) if isinstance(compact_parsed, dict) else None
        if compact_result.used_real_llm and compact_decision is not None:
            result = compact_result
            decision = compact_decision
        else:
            result = compact_result
            decision = compact_decision

    if not result.used_real_llm:
        if fallback_allowed:
            return {
                "available": True,
                "provider": result.provider,
                "used_fallback": True,
                "decision": _fallback_chat_decision(user_message, current_question, language),
                "llm_error": result.error,
            }
        _trace_llm_call(
            trace_context,
            intent="unknown",
            response_type="ai_unavailable",
            provider=result.provider,
            used_fallback=False,
            should_save_answer=False,
            latency_ms=latency_ms,
        )
        return {
            "available": False,
            "provider": result.provider,
            "used_fallback": False,
            "decision": None,
            "llm_error": result.error or "Real LLM provider call failed.",
        }

    if decision is None:
        _trace_llm_call(
            trace_context,
            intent="unknown",
            response_type="ai_unavailable",
            provider=result.provider,
            used_fallback=False,
            should_save_answer=False,
            latency_ms=latency_ms,
        )
        return {
            "available": False,
            "provider": result.provider,
            "used_fallback": False,
            "decision": None,
            "llm_error": "LLM did not return a valid chat decision JSON payload.",
        }

    _trace_llm_call(
        trace_context,
        intent=decision.action,
        response_type="chat_decision",
        provider=result.provider,
        used_fallback=False,
        should_save_answer=decision.should_save_answer,
        confidence=decision.confidence,
        latency_ms=latency_ms,
    )
    return {
        "available": True,
        "provider": result.provider,
        "used_fallback": False,
        "decision": decision.model_dump(),
        "llm_error": result.error,
    }


def _needs_compact_llm_retry(error: str | None) -> bool:
    text = str(error or "").lower()
    return "prompt tokens limit exceeded" in text or "fewer max_tokens" in text or "can only afford" in text


def _compact_chat_decision_retry_payload(
    *,
    user_message: str,
    language: str,
    current_question: dict[str, Any] | None,
    current_answers: dict[str, dict[str, Any]],
    pending_answer: dict[str, Any] | None,
    chat_history: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    current_question_answer = _current_question_answer(current_question, current_answers)
    return {
        "m": user_message,
        "lang": language,
        "q": str((current_question or {}).get("question") or ""),
        "qid": str((current_question or {}).get("id") or ""),
        "qa": (current_question_answer or {}).get("answer"),
        "pending": (pending_answer or {}).get("suggested_answer"),
        "recent": [f"{item.get('role', 'user')}: {str(item.get('content', '')).strip()[:120]}" for item in (chat_history or [])[-3:]],
    }


def _compact_router_assessment_context(
    current_answers: dict[str, dict[str, Any]],
    current_question: dict[str, Any] | None,
) -> dict[str, Any]:
    answer_items = [
        {"question_id": qid, "answer": str(record.get("answer", "")).strip()}
        for qid, record in current_answers.items()
        if str(qid).strip() and not str(qid).startswith("followup__")
    ]
    current_domain = str((current_question or {}).get("domain") or "")
    same_domain_items: list[dict[str, str]] = []
    if current_domain:
        qmap = question_map()
        same_domain_items = [
            item
            for item in answer_items
            if str(qmap.get(item["question_id"], {}).get("domain") or "") == current_domain
        ]

    return {
        "answered_count": len(answer_items),
        "current_domain_answers": same_domain_items[-6:],
        "recent_answers": answer_items[-8:],
        "current_question_answer": _current_question_answer(current_question, current_answers),
    }


def _compact_router_chat_history(chat_history: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    compacted: list[dict[str, str]] = []
    for item in (chat_history or [])[-4:]:
        role = str(item.get("role", "")).strip() or "user"
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        compacted.append({"role": role, "content": content[:280]})
    return compacted


def _compact_org_info(org_info: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {"organization_name", "industry", "employee_count", "country"}
    compacted = {key: value for key, value in org_info.items() if key in allowed_keys and str(value).strip()}
    return compacted


def _fallback_chat_decision(
    user_message: str,
    current_question: dict[str, Any] | None,
    language: str,
) -> dict[str, Any]:
    intent = classify_user_intent(user_message, current_question)
    if intent == "report_request":
        return {
            "action": "generate_report",
            "normalized_answer": None,
            "confidence": 0.95,
            "reason": "Deterministic fallback recognized a report request.",
            "user_visible_response": "",
            "should_advance_question": True,
            "should_save_answer": False,
        }
    if intent == "clarification" or looks_like_current_question_clarification(user_message, current_question):
        return {
            "action": "answer_clarification",
            "normalized_answer": None,
            "confidence": 0.8,
            "reason": "Deterministic fallback recognized a clarification request.",
            "user_visible_response": _fallback_bridge(language),
            "should_advance_question": False,
            "should_save_answer": False,
        }
    if intent == "general_advisory_chat":
        return {
            "action": "answer_advisory",
            "normalized_answer": None,
            "confidence": 0.8,
            "reason": "Deterministic fallback recognized an advisory question.",
            "user_visible_response": _fallback_bridge(language),
            "should_advance_question": False,
            "should_save_answer": False,
        }
    if current_question:
        answer, confidence = infer_answer(user_message, str(current_question.get("id") or ""))
        if answer:
            return {
                "action": "save_answer" if confidence >= 0.75 else "ask_confirmation",
                "normalized_answer": answer,
                "confidence": confidence,
                "reason": "Deterministic fallback inferred an assessment answer.",
                "user_visible_response": "",
                "should_advance_question": confidence >= 0.75,
                "should_save_answer": confidence >= 0.75,
            }
    if _looks_like_context_statement(_normalize(user_message)):
        return {
            "action": "keep_context",
            "normalized_answer": None,
            "confidence": 0.6,
            "reason": "Deterministic fallback treated the message as context.",
            "user_visible_response": _fallback_bridge(language),
            "should_advance_question": False,
            "should_save_answer": False,
        }
    return {
        "action": "smalltalk",
        "normalized_answer": None,
        "confidence": 0.4,
        "reason": "Deterministic fallback could not classify a scoring answer.",
        "user_visible_response": _fallback_bridge(language),
        "should_advance_question": False,
        "should_save_answer": False,
    }


def _fallback_bridge(language: str) -> str:
    if language == "English":
        return "When you are ready, answer yes, partial, no, or unsure."
    if language == "Russian":
        return "Когда будете готовы, ответьте: yes, partial, no или unsure."
    return "Kui oled valmis, vasta: yes, partial, no või unsure."


def _unavailable_chat_reply(*, provider: str, error: str) -> dict[str, Any]:
    return {
        "available": False,
        "message": "",
        "provider": provider,
        "used_fallback": False,
        "model": None,
        "error": error,
        "redactions_applied": [],
        "redacted_for_llm": False,
    }


def fallback_extract_answers(
    user_message: str,
    questions: list[dict[str, Any]],
    current_question: dict[str, Any] | None,
) -> dict[str, Any]:
    intent = classify_user_intent(user_message, current_question)
    if intent != "answer":
        return _empty_extraction(intent)

    qmap = {q["id"]: q for q in questions}
    candidates = _candidate_question_ids(user_message, questions, current_question)
    extracted: dict[str, str] = {}
    unclear: list[str] = []
    confidence: dict[str, float] = {}

    for qid in candidates:
        q = qmap.get(qid)
        if not q:
            continue
        if current_question and qid == current_question.get("id"):
            answer, score = _infer_current_question_reply(user_message, current_question)
        else:
            answer, score = infer_answer(user_message, qid)
        if answer and answer in q.get("options", []):
            extracted[qid] = answer
            confidence[qid] = score

    if not extracted and current_question:
        fallback_answer, fallback_score = _infer_current_question_reply(user_message, current_question)
        if fallback_answer and fallback_answer in current_question.get("options", []):
            extracted[current_question["id"]] = fallback_answer
            confidence[current_question["id"]] = fallback_score

    if not extracted and current_question:
        unclear.append(current_question["id"])

    clarification = default_clarification_question(qmap[unclear[0]]) if unclear else ""
    return {
        "intent": "answer",
        "extracted_answers": extracted,
        "unclear_questions": unclear,
        "confidence": confidence,
        "needs_clarification": bool(unclear),
        "clarification_question": clarification,
        "provider": "fallback",
        "used_fallback": True,
        "llm_error": None,
    }


def normalize_smalltalk_text(
    text: str,
    *,
    language: str,
    is_new_session: bool,
    is_acknowledgement: bool,
) -> str:
    cleaned = normalize_assistant_text(text, language, None, None)
    cleaned = re.sub(r"Let's return to the current question:\s*.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"Tuleme nüüd tagasi praeguse küsimuse juurde:\s*.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"Верн[её]мся к текущему вопросу:\s*.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    if is_acknowledgement and not is_new_session:
        cleaned = re.sub(r"^(Tere|Hei|Hello|Hi|Hey|Здравствуйте|Привет)[!,.:\s]+", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(
            r"^(Räägime edasi|Jätkame|Let'?s continue|We can continue|Продолжим)[^.\n]*[.\n\s]*",
            "",
            cleaned,
            flags=re.IGNORECASE,
        ).strip()
        if not cleaned:
            return _short_acknowledgement(language)

    return cleaned.strip()


def _short_acknowledgement(language: str) -> str:
    if language == "Russian":
        return "Понял."
    if language == "English":
        return "Got it."
    return "Sain aru."


def _strip_repeated_question_tail(text: str, current_question: dict[str, Any] | None) -> str:
    question_text = get_current_question_text(current_question).strip()
    if not question_text:
        return text
    patterns = [
        rf"\s*(?:Let us continue with one more question:\s*)?{re.escape(question_text)}\s*$",
        rf"\s*(?:Let's return to the current question:\s*)?{re.escape(question_text)}\s*$",
        rf"\s*(?:Tuleme nüüd tagasi praeguse küsimuse juurde:\s*)?{re.escape(question_text)}\s*$",
        rf"\s*(?:Верн[её]мся к текущему вопросу:\s*)?{re.escape(question_text)}\s*$",
    ]
    cleaned = text
    for pattern in patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    return cleaned


def is_acknowledgement_or_smalltalk(message: str) -> bool:
    text = _normalize(message)
    return _is_acknowledgement(text) or _is_smalltalk(text)


def infer_explicit_short_answer(message: str) -> tuple[str | None, float]:
    text = _normalize(message).strip()
    exact_matches = {
        "jah": "yes",
        "ei": "no",
        "osaliselt": "partial",
        "ei tea": "unsure",
        "ma ei tea": "unsure",
        "yes": "yes",
        "no": "no",
        "partial": "partial",
        "unsure": "unsure",
        "not sure": "unsure",
        "да": "yes",
        "нет": "no",
        "частично": "partial",
        "не знаю": "unsure",
    }
    normalized_answer = exact_matches.get(text)
    if normalized_answer is None:
        return None, 0.0
    return normalized_answer, 0.98


def infer_answer(user_message: str, question_id: str = "") -> tuple[str | None, float]:
    del question_id
    return infer_explicit_short_answer(user_message)

    text = _normalize(user_message)

    if _is_short_yes(text):
        return "yes", 0.86

    if question_id == "org_critical_systems_known":
        if _contains_any_token_or_phrase(text, ["teab", "teada", "kaardistatud", "known", "identified"]):
            return "yes", 0.84
        if _contains_any_token_or_phrase(text, ["ei tea", "pole teada", "not known", "not identified"]):
            return "no", 0.82

    if question_id in {"backups_exist", "backup_frequency_defined"}:
        if _contains_any_token_or_phrase(text, ["toimub", "toimuvad"]):
            return "yes", 0.78

    if question_id == "backups_exist" and _contains_any(text, ["backup", "varukoop", "koopiad"]):
        if _contains_any(text, ["olemas", "teeme", "tehakse", "jah", "regulaarselt", "iga paev", "iga nadal", "daily", "weekly"]):
            return "yes", 0.9
        if _contains_any(text, ["ei ole", "pole", "puudub", "ei tee"]):
            return "no", 0.88

    if question_id == "restore_tested" and _contains_any(text, ["taast", "restore", "test"]):
        if _contains_any(text, ["ei ole test", "pole test", "ei test", "pole taast", "not tested", "ei ole taast"]):
            return "no", 0.92
        if _contains_any(text, ["testitud", "taastatud", "tested", "harjutatud"]):
            return "yes", 0.86

    if question_id == "backup_isolated" and _contains_any(text, ["offline", "immutable", "eraldatud", "isoleeritud", "samas vorgus", "samas võrgus"]):
        if _contains_any(text, ["samas vorgus", "samas võrgus", "pole eraldatud", "ei ole eraldatud"]):
            return "no", 0.88
        return "yes", 0.82

    if question_id.startswith("mfa_") and "mfa" in text:
        if _contains_any(text, ["osaliselt", "monel", "mõnel", "ainult", "osadel", "mitte koigil", "mitte kõigil"]):
            return "partial", 0.84
        if _contains_any(text, ["ei ole", "pole", "puudub", "ei kasuta"]):
            return "no", 0.86
        if _contains_any(text, ["jah", "olemas", "kasutame", "koigil", "kõigil"]):
            return "yes", 0.84

    if _contains_any_token_or_phrase(
        text,
        [
            "ei tea",
            "pole kindel",
            "ei ole kindel",
            "kindel pole",
            "ei oska oelda",
            "unsure",
            "not sure",
            "voib olla",
            "voib-olla",
            "maybe",
            "не знаю",
        ],
    ) or re.search(r"\b(vist|ehk)\b", text):
        return "unsure", 0.9
    if _contains_any_token_or_phrase(
        text,
        [
            "osaliselt",
            "monel",
            "mõnel",
            "mõned",
            "moned",
            "ainult",
            "osadel",
            "mitte koigil",
            "mitte kõigil",
            "vahel",
            "ebaregulaars",
            "частично",
        ],
    ):
        return "partial", 0.82
    if _contains_any_token_or_phrase(
        text,
        ["ei ole", "pole", "puudub", "ei kasuta", "ei tee", "ei test", "mitte", "no", "not", "нет", "ei"],
    ):
        return "no", 0.78
    if _contains_any_token_or_phrase(
        text,
        ["jah", "yes", "да", "olemas", "kasutame", "teeme", "tehakse", "on olemas", "regulaars", "koik", "kõik", "testitud", "dokumenteeritud"],
    ):
        return "yes", 0.78
    return None, 0.0


def generate_next_question(
    missing_question: dict[str, Any],
    current_context: dict[str, Any] | None = None,
    trace_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if get_llm_settings()["provider"] == "fallback":
        _trace_llm_call(
            trace_context,
            intent="unknown",
            response_type="interview_question",
            provider="fallback",
            used_fallback=True,
            latency_ms=0,
        )
        return {"message": fallback_question_text(missing_question), "provider": "fallback", "used_fallback": True}

    payload = {
        "question": missing_question,
        "current_context": current_context or {},
        "output": "Plain Estonian question only.",
    }
    started = perf_counter()
    result = generate_text(
        prompt=json.dumps(payload, ensure_ascii=False, indent=2),
        system_prompt=load_prompt("interview_system_prompt.txt"),
        temperature=0.2,
    )
    latency_ms = (perf_counter() - started) * 1000
    text = result.text.strip().strip('"')
    if not result.used_real_llm or not text or len(text) > 500:
        _trace_llm_call(
            trace_context,
            intent="unknown",
            response_type="interview_question",
            provider=result.provider,
            used_fallback=True,
            latency_ms=latency_ms,
        )
        return {"message": fallback_question_text(missing_question), "provider": "fallback", "used_fallback": True}
    _trace_llm_call(
        trace_context,
        intent="unknown",
        response_type="interview_question",
        provider=result.provider,
        used_fallback=False,
        latency_ms=latency_ms,
    )
    return {"message": text, "provider": result.provider, "used_fallback": False}


def fallback_question_text(question: dict[str, Any]) -> str:
    help_text = question.get("help")
    if help_text:
        return f"{question['question']} ({help_text})"
    return question["question"]


def default_clarification_question(question: dict[str, Any]) -> str:
    return (
        "Ma ei saanud seda piisavalt kindlalt struktureeritud vastuseks muuta. "
        f"Kas vastus on pigem jah, osaliselt, ei või ei tea: {question['question']}"
    )


def get_current_question_text(question: dict[str, Any] | None) -> str:
    return question.get("question", "") if question else ""


def get_domain_summary(question: dict[str, Any] | None) -> str:
    if not question:
        return ""
    metadata = load_domain_metadata()
    domain = question.get("domain", "")
    meta = metadata.get(domain, {})
    title = meta.get("title", DOMAIN_LABELS.get(domain, domain))
    description = meta.get("description", "")
    return f"{title}: {description}".strip(": ")


def missing_domain_labels(answer_records: dict[str, dict[str, Any]]) -> list[str]:
    return [DOMAIN_LABELS.get(domain, domain) for domain in preliminary_missing_domains(answer_records)]


def looks_like_offensive_request(message: str) -> bool:
    text = _normalize(message)
    if _contains_any(text, OFFENSIVE_REQUEST_HINTS):
        return True
    if "exploit" in text and _contains_any(text, ["how to", "kuidas", "write", "create", "run", "use"]):
        return True
    if "malware" in text and _contains_any(text, ["write", "create", "deploy", "evade", "bypass", "analyze", "reverse"]):
        return True
    return False


def defensive_refusal(user_message: str, current_question: dict[str, Any] | None) -> dict[str, Any]:
    language = detect_language(user_message)
    if language == "English":
        answer = (
            "I can’t help with offensive hacking, malware, exploitation, MFA bypass, credential theft, persistence, or evasion instructions.\n\n"
            "I can help defensively: verify MFA coverage, remove unused accounts, limit admin rights, patch exposed systems, and collect readiness evidence."
        )
    elif language == "Russian":
        answer = (
            "Я не могу помогать с атакующими инструкциями, вредоносным ПО, обходом MFA, кражей учетных данных, закреплением или обходом защиты.\n\n"
            "Могу помочь с защитной готовностью: проверить MFA, убрать лишние учетные записи, ограничить админ-права, установить обновления и собрать доказательства готовности."
        )
    else:
        answer = (
            "Ma ei saa aidata ründejuhiste, pahavara, ekspluateerimise, MFA-st möödahiilimise, credential theft'i, persistence'i või evasion'i juhistega.\n\n"
            "Saan aidata kaitse poolelt: kontrolli MFA katvust, eemalda kasutamata kontod, piira admin-õiguseid, paika avalikud süsteemid ja kogu valmisoleku tõendeid."
        )

    return {
        "message": answer,
        "provider": "guardrail",
        "used_fallback": True,
        "model": "deterministic-guardrail",
        "error": None,
    }


def detect_language(message: str) -> str:
    text = _normalize(message)
    if RUSSIAN_HINT_RE.search(message):
        return "Russian"
    if _contains_any(text, ["what", "why", "how", "explain", "thanks", "hello"]):
        return "English"
    return "Estonian"

def _is_identity_question(message: str) -> bool:
    text = _normalize(message)
    return _contains_any(text, ["kes sa oled", "kes oled", "who are you", "what are you", "кто ты", "кто вы"])


def _identity_text(language: str) -> str:
    if language == "Russian":
        return "Я Ransomware Readiness AI Assistant: помогаю пройти короткую оценку готовности к ransomware и объясняю вопросы простым языком."
    if language == "English":
        return "I am the Ransomware Readiness AI Assistant: I help run this short readiness interview and explain the questions in plain language."
    return "Olen Ransomware Readiness AI Assistant: aitan teha lühikest lunavara-valmisoleku intervjuud ja selgitan küsimusi lihtsas keeles."


def _current_question_answer(
    current_question: dict[str, Any] | None,
    current_answers: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    if not current_question:
        return None
    return current_answers.get(current_question.get("id", ""))


def _is_example_request(text: str) -> bool:
    return _contains_any(
        text,
        [
            "too näidis",
            "too naidis",
            "too näidised",
            "too naidised",
            "näidis",
            "naidis",
            "näidised",
            "naidised",
            "näide",
            "naide",
            "examples",
            "example",
        ],
    )


def _examples_for_question(question: dict[str, Any]) -> str:
    question_id = question.get("id", "")
    if question_id == "backups_exist":
        return (
            "Näited selle küsimuse jaoks:\n\n"
            "- `yes`: kriitilistest andmetest tehakse automaatsed varukoopiad iga päev või iga nädal.\n"
            "- `partial`: varundatakse ainult osa süsteeme või keegi ei kontrolli regulaarselt, kas backup õnnestus.\n"
            "- `no`: regulaarset varundamist ei ole või see sõltub käsitsi kopeerimisest.\n"
            "- `unsure`: sa ei tea, kas backupid päriselt toimuvad või milliseid andmeid need katavad."
        )
    if question_id == "restore_tested":
        return (
            "Näited selle küsimuse jaoks:\n\n"
            "- `yes`: viimase 6 kuu jooksul taastati testiks mõni kriitiline süsteem või andmekogum.\n"
            "- `partial`: taastati ainult üksik fail, aga tervet teenust või kriitilist protsessi pole proovitud.\n"
            "- `no`: taastamist pole harjutatud.\n"
            "- `unsure`: pole teada, millal viimati taastamist testiti."
        )
    help_text = question.get("help") or "Kirjelda, kas see kontroll on täielikult olemas, osaliselt olemas, puudub või pole teada."
    return (
        "Näited vastamiseks:\n\n"
        f"- `yes`: kontroll on olemas ja toimib. {help_text}\n"
        "- `partial`: midagi on tehtud, aga katvus või regulaarsus on puudulik.\n"
        "- `no`: sellist kontrolli praegu ei ole.\n"
        "- `unsure`: sa ei tea või info vajab kontrollimist."
    )


def _advisory_focus(message: str, current_question: dict[str, Any] | None) -> str:
    text = _normalize(message)
    question_id = (current_question or {}).get("id", "")
    if _is_identity_question(message):
        return "identity"
    if _is_example_request(text):
        return "examples"
    if question_id == "restore_tested" and _contains_any(text, ["6 kuu", "kuue kuu", "6 months", "six months"]):
        return "six_month_restore_test"
    if text.strip() == "mida":
        return "explain_current_question"
    return "general"


def _advisory_domain(message: str, current_question: dict[str, Any] | None) -> str:
    text = _normalize(message)
    if _contains_any(text, ["backup", "varukoop", "taast", "restore", "rto", "rpo"]):
        return "backups"
    if _contains_any(text, ["mfa", "2fa", "mitmefaktor", "vpn", "rdp", "kaugligipaas", "remote access"]):
        return "mfa_access"
    if _contains_any(text, ["patch", "uuendus", "haavatav", "internet-facing", "tootjatoeta", "unsupported"]):
        return "patching"
    if _contains_any(text, ["admin", "adminoigus", "oigus", "privilege", "least privilege", "third party"]):
        return "admin_rights"
    if _contains_any(text, ["incident", "intsident", "ir plan", "ir plaan", "tabletop", "cert-ee", "eskalatsioon"]):
        return "incident_response"
    if _contains_any(text, ["log", "monitor", "edr", "antivirus", "alert", "hoiatus", "failed login", "sisselogim"]):
        return "detection_monitoring"
    if _contains_any(text, ["paroolihaldur", "password manager", "phishing", "brauser", "browser", "recovery code"]):
        return "employee_security_hygiene"
    return (current_question or {}).get("domain", "")


def _message_topic_matches_current_question(message: str, current_question: dict[str, Any] | None) -> bool:
    if not current_question:
        return True
    topic_domain = _advisory_domain(message, current_question)
    current_domain = str(current_question.get("domain") or "")
    if not topic_domain or not current_domain:
        return True
    return topic_domain == current_domain


def _should_note_topic_mismatch(
    user_message: str,
    advisory_domain: str,
    current_question: dict[str, Any] | None,
) -> bool:
    if not user_message or not current_question:
        return False
    current_domain = str(current_question.get("domain") or "")
    if not advisory_domain or not current_domain or advisory_domain == current_domain:
        return False
    return advisory_domain in DOMAIN_LABELS


def _topic_mismatch_note(language: str) -> str:
    if language == "Russian":
        return "Это немного другая тема, чем текущий вопрос оценки, но коротко отвечу."
    if language == "English":
        return "That is a slightly different topic from the current assessment question, but here is the short answer."
    return "See on veidi erinev teema kui praegune hindamisküsimus, aga vastan lühidalt."


def _topic_mismatch_note_hints(language: str) -> list[str]:
    if language == "Russian":
        return ["другая тема", "текущий вопрос оценки"]
    if language == "English":
        return ["different topic", "current assessment question"]
    return ["erinev teema", "praegune hindamisküsimus"]


def _strip_unrequested_identity(message: str) -> str:
    cleaned = message.strip()
    cleaned = re.sub(
        r"^(Tere!\s*)?(Mina\s+)?Olen\s+Ransomware Readiness AI Assistant[^\n.]*[.:]?\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"^Ransomware Readiness AI Assistant\s*:?\s*", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def _ensure_six_month_explanation(message: str) -> str:
    explanation = (
        "6 kuu piir on praktiline värskuse kontroll: see näitab, et taastamist on testitud piisavalt hiljuti, "
        "praeguse keskkonna ja andmemahtudega. Täpne number ei ole maagiline; oluline on regulaarne test ja teadaolev taastamisaeg."
    )
    normalized = _normalize(message)
    if _contains_any(normalized, ["varskuse kontroll", "värskuse kontroll", "piisavalt hiljuti", "regularne test", "regulaarne test"]):
        return message
    return f"{explanation}\n\n{message}".strip()


def _candidate_question_ids(
    user_message: str,
    questions: list[dict[str, Any]],
    current_question: dict[str, Any] | None,
) -> list[str]:
    topic_matches = _topic_question_ids(user_message)
    candidate_ids: list[str] = []
    if current_question and (not topic_matches or current_question["id"] in topic_matches):
        candidate_ids.append(current_question["id"])
    candidate_ids.extend(qid for qid in topic_matches if qid not in candidate_ids)

    allowed_ids = {q["id"] for q in questions}
    return [qid for qid in candidate_ids if qid in allowed_ids][:4]


def _topic_question_ids(user_message: str) -> list[str]:
    text = _normalize(user_message)
    matches: list[str] = []
    for qid, keywords in QUESTION_KEYWORDS.items():
        if _contains_any(text, keywords):
            matches.append(qid)

    # Common backup sentence: "backup exists but restore was not tested".
    if _contains_any(text, ["backup", "varukoop"]) and _contains_any(text, ["taast", "restore", "test"]):
        for qid in ["backups_exist", "restore_tested"]:
            if qid not in matches:
                matches.append(qid)
    return matches


def _redact_answer_records(
    answer_records: dict[str, dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    redacted_records: dict[str, dict[str, Any]] = {}
    redactions: list[str] = []
    for qid, record in answer_records.items():
        copied = dict(record)
        details = copied.get("details")
        if isinstance(details, str):
            copied["details"], applied = redact_sensitive_text(details)
            redactions = _merge_redactions(redactions, applied)
        redacted_records[qid] = copied
    return redacted_records, redactions


def _merge_redactions(*groups: list[str]) -> list[str]:
    merged: list[str] = []
    for group in groups:
        for item in group:
            if item not in merged:
                merged.append(item)
    return merged


def looks_like_current_question_clarification(
    message: str,
    current_question: dict[str, Any] | None,
) -> bool:
    if not current_question:
        return False

    text = _normalize(message)
    words = text.split()
    has_question_mark = "?" in message or "ï¼Ÿ" in message
    has_question_word = _has_question_word(text)
    short = len(words) <= 10

    if _contains_any(text, CURRENT_QUESTION_CLARIFICATION_HINTS):
        if short or _contains_any(text, CURRENT_QUESTION_REFERENCE_HINTS):
            return True

    if _contains_any(text, CURRENT_QUESTION_REFERENCE_HINTS) and (has_question_mark or has_question_word or _is_example_request(text)):
        return True

    if _contains_any(text, ["how should i answer", "how do i answer", "kuidas sellele vastata", "kas vastus", "как ответить"]):
        return True

    if _looks_like_how_to_judge_current_question(text):
        return True

    current_topic = current_question.get("id", "") in _topic_question_ids(message)
    if current_topic and _contains_any(text, CURRENT_QUESTION_CLARIFICATION_HINTS):
        return True

    if current_topic and (has_question_mark or has_question_word) and not _contains_any(text, GENERAL_ADVISORY_HINTS):
        return True

    reply_tokens = {token for token in _tokenize_normalized(text) if len(token) >= 4}
    current_tokens = _current_question_tokens(current_question)
    overlap = reply_tokens & current_tokens
    if overlap and (has_question_mark or has_question_word or _contains_any(text, CLARIFICATION_HINTS)):
        return True

    return False


def classify_user_intent(message: str, current_question: dict[str, Any] | None = None) -> Intent:
    text = _normalize(message)
    raw = message.strip()
    if not text:
        return "smalltalk"
    if _contains_any(text, REPORT_HINTS):
        return "report_request"
    if _is_short_yes(text):
        return "answer"
    if _is_smalltalk(text):
        return "smalltalk"
    if _is_identity_question(message):
        return "clarification"
    if _looks_like_short_definition_question(text):
        return "clarification"
    has_question_mark = "?" in raw or "ï¼Ÿ" in raw
    has_question_word = _has_question_word(text)
    has_answer_signal = _has_answer_signal(text)

    if has_answer_signal and _looks_like_direct_answer(text, current_question):
        return "answer"
    if _looks_like_operational_answer(text, current_question):
        return "answer"
    if _looks_like_short_current_question_reply(text, raw, current_question):
        return "answer"
    if looks_like_current_question_clarification(message, current_question):
        return "clarification"
    if _looks_like_general_advisory_question(text, has_question_mark, has_question_word):
        return "general_advisory_chat"
    if has_question_mark or has_question_word:
        return "general_advisory_chat"
    if has_answer_signal:
        return "answer"
    return "unknown"


def _looks_like_general_advisory_question(text: str, has_question_mark: bool, has_question_word: bool) -> bool:
    has_topic = _contains_any(text, GENERAL_ADVISORY_TOPICS)
    has_general_hint = _contains_any(text, GENERAL_ADVISORY_HINTS)
    if has_topic and (has_question_mark or has_question_word or has_general_hint):
        return True
    if has_general_hint and (has_question_mark or has_question_word):
        return True
    return False


def _looks_like_short_definition_question(text: str) -> bool:
    if len(text.split()) > 6:
        return False
    return _contains_any(
        text,
        [
            "mis on",
            "mida tähendab",
            "mida tahendab",
            "what is",
            "what does",
            "что такое",
            "что значит",
        ],
    )


def _looks_like_operational_answer(text: str, current_question: dict[str, Any] | None) -> bool:
    if "?" in text:
        return False
    topic_ids = _topic_question_ids(text)
    if current_question and topic_ids and current_question.get("id") not in topic_ids:
        # It can still be a clear factual answer to another known assessment item.
        pass
    evidence_terms = [
        "meil",
        "we ",
        "we have",
        "we use",
        "we patch",
        "we test",
        "kasutame",
        "teeme",
        "paigaldame",
        "kogume",
        "jalgime",
        "monitored",
        "enabled",
        "required",
        "documented",
        "within 30 days",
        "30 days",
        "iga paev",
        "iga nadal",
        "daily",
        "weekly",
        "last",
        "viimase",
        "tested",
        "testitud",
        "not tested",
        "pole test",
        "ei ole test",
    ]
    return bool(topic_ids) and _contains_any(text, evidence_terms)


def _general_advisory_bridge(language: str, current_question: dict[str, Any] | None) -> str:
    if not current_question:
        return ""
    if language == "English":
        return "This does not change your assessment answers; the active interview question stays where it is."
    if language == "Russian":
        return "Это не меняет ответы в оценке; активный вопрос интервью остаётся тем же."
    return "See ei muuda hindamise vastuseid; aktiivne intervjuuküsimus jääb samaks."


def _empty_extraction(intent: Intent, provider: str = "fallback", used_fallback: bool = True) -> dict[str, Any]:
    return {
        "intent": _normalize_intent(intent),
        "extracted_answers": {},
        "unclear_questions": [],
        "confidence": {},
        "needs_clarification": False,
        "clarification_question": "",
        "provider": provider,
        "used_fallback": used_fallback,
        "llm_error": None,
    }


def _normalize_intent(value: Any, fallback: Intent = "unknown") -> Intent:
    intent = str(value or fallback).strip().lower()
    return intent if intent in VALID_INTENTS else fallback


def _is_smalltalk(text: str) -> bool:
    word_count = len(text.split())
    if _contains_any(text, ["kuidas laheb", "kuidas läheb", "how are you", "how's it going", "hows it going", "как дела"]):
        return word_count <= 5
    return word_count <= 3 and _contains_any(text, SMALLTALK_HINTS)


def _is_acknowledgement(text: str) -> bool:
    return len(text.split()) <= 4 and _contains_any(text, ACKNOWLEDGEMENT_HINTS)


def _has_answer_signal(text: str) -> bool:
    return _is_short_yes(text) or _contains_any_token_or_phrase(text, ANSWER_HINTS)


def _is_short_yes(text: str) -> bool:
    return text.strip() in {"ja", "jep", "jup"}


def _looks_like_direct_answer(text: str, current_question: dict[str, Any] | None) -> bool:
    if not current_question:
        return _has_answer_signal(text)
    question_id = current_question.get("id", "")
    topic_ids = _topic_question_ids(text)
    return _has_answer_signal(text) and (not topic_ids or question_id in topic_ids)


def _looks_like_short_current_question_reply(
    text: str,
    raw: str,
    current_question: dict[str, Any] | None,
) -> bool:
    if not current_question:
        return False
    if "?" in raw:
        return False
    if len(text.split()) > 3:
        return False
    if _has_question_word(text):
        return False
    if _is_smalltalk(text):
        return False
    if _is_acknowledgement(text):
        return False
    if _is_example_request(text):
        return False
    if _contains_any(text, CLARIFICATION_HINTS):
        return False
    if _contains_any(text, CURRENT_QUESTION_CLARIFICATION_HINTS):
        return False
    if _contains_any(text, REPORT_HINTS):
        return False
    answer, _ = infer_answer(raw, current_question.get("id", ""))
    return answer is not None


def _tokenize_normalized(text: str) -> list[str]:
    return re.findall(r"\b\w+\b", _normalize(text))


def _current_question_tokens(current_question: dict[str, Any]) -> set[str]:
    parts = [str(current_question.get("question") or ""), str(current_question.get("help") or "")]
    tokens: set[str] = set()
    for part in parts:
        for token in _tokenize_normalized(part):
            if len(token) < 4:
                continue
            if token in CURRENT_QUESTION_REPLY_STOPWORDS:
                continue
            tokens.add(token)
    return tokens


def _semantic_short_reply_answer(
    text: str,
    raw: str,
    current_question: dict[str, Any],
) -> tuple[str | None, float]:
    if not _looks_like_short_current_question_reply(text, raw, current_question):
        return None, 0.0

    if re.search(r"\b(vist|ehk)\b", text) or "voib olla" in text or "voib-olla" in text or "maybe" in text:
        return "unsure", 0.76

    return None, 0.0


def _looks_like_correction_turn(text: str, raw: str) -> bool:
    stripped = raw.strip().lower()
    return stripped.startswith("ei,") or stripped.startswith("no,") or _contains_any(text, CORRECTION_TURN_HINTS)


def _semantic_current_question_answer(
    text: str,
    raw: str,
    current_question: dict[str, Any],
) -> tuple[str | None, float]:
    reply_tokens = {token for token in _tokenize_normalized(text) if len(token) >= 4}
    overlap = reply_tokens & _current_question_tokens(current_question)
    if not overlap:
        return None, 0.0

    if _contains_any(
        text,
        [
            "ei tea",
            "pole kindel",
            "ei ole kindel",
            "kindel pole",
            "voib olla",
            "voib-olla",
            "maybe",
        ],
    ) or re.search(r"\b(vist|ehk)\b", text):
        return "unsure", 0.84

    if _contains_any(
        text,
        ["osaliselt", "monel", "mõnel", "moned", "mõned", "ainult", "osadel", "pigem osaliselt"],
    ):
        return "partial", 0.84

    if _looks_like_correction_turn(text, raw):
        if _contains_any(
            text,
            [
                "teada",
                "olemas",
                "tehakse",
                "testitud",
                "dokumenteeritud",
                "kaardistatud",
                "jalgitav",
                "jalgitakse",
            ],
        ):
            return "yes", 0.86
        if _contains_any(text, ["ei tehta", "ei ole", "pole", "puudub", "ei kasuta", "ei test"]):
            return "no", 0.82

    return None, 0.0


def _infer_current_question_reply(
    user_message: str,
    current_question: dict[str, Any],
) -> tuple[str | None, float]:
    text = _normalize(user_message)
    raw = user_message.strip()

    semantic_answer, semantic_score = _semantic_current_question_answer(text, raw, current_question)
    if semantic_answer:
        return semantic_answer, semantic_score

    answer, score = infer_answer(user_message, current_question.get("id", ""))
    if answer:
        return answer, score

    return _semantic_short_reply_answer(text, raw, current_question)


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _contains_any(text: str, phrases: list[str]) -> bool:
    normalized_phrases = [_normalize(phrase) for phrase in phrases]
    return any(phrase in text for phrase in normalized_phrases)


def _contains_any_token(text: str, tokens: list[str]) -> bool:
    normalized_tokens = {_normalize(token) for token in tokens if token}
    text_tokens = set(_tokenize_normalized(text))
    return bool(normalized_tokens & text_tokens)


def _contains_any_token_or_phrase(text: str, hints: list[str]) -> bool:
    token_hints = [hint for hint in hints if " " not in _normalize(hint)]
    phrase_hints = [hint for hint in hints if " " in _normalize(hint)]
    return _contains_any(text, phrase_hints) or _contains_any_token(text, token_hints)


def _has_question_word(text: str) -> bool:
    return any(re.search(rf"\b{re.escape(_normalize(word))}\b", text) for word in QUESTION_WORDS)


def normalize_smalltalk_text(
    text: str,
    *,
    language: str,
    is_new_session: bool,
    is_acknowledgement: bool,
) -> str:
    cleaned = normalize_assistant_text(text, language, None, None)
    cleaned = re.sub(r"Let's return to the current question:\s*.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"Tuleme nüüd tagasi praeguse küsimuse juurde:\s*.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"Верн[её]мся к текущему вопросу:\s*.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    if is_acknowledgement and not is_new_session:
        cleaned = re.sub(r"^(Tere|Hei|Hello|Hi|Hey|Здравствуйте|Привет)[!,.:\s]+", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(
            r"^(Räägime edasi|Jätkame|Let'?s continue|We can continue|Продолжим)[^.\n]*[.\n\s]*",
            "",
            cleaned,
            flags=re.IGNORECASE,
        ).strip()
        if not cleaned:
            return _short_acknowledgement(language)

    return cleaned.strip()


def _short_acknowledgement(language: str) -> str:
    if language == "Russian":
        return "Понял."
    if language == "English":
        return "Got it."
    return "Sain aru."


def _strip_repeated_question_tail(text: str, current_question: dict[str, Any] | None) -> str:
    question_text = get_current_question_text(current_question).strip()
    if not question_text:
        return text
    patterns = [
        rf"\s*(?:Let us continue with one more question:\s*)?{re.escape(question_text)}\s*$",
        rf"\s*(?:Let's return to the current question:\s*)?{re.escape(question_text)}\s*$",
        rf"\s*(?:Tuleme nüüd tagasi praeguse küsimuse juurde:\s*)?{re.escape(question_text)}\s*$",
        rf"\s*(?:Верн[её]мся к текущему вопросу:\s*)?{re.escape(question_text)}\s*$",
    ]
    cleaned = text
    for pattern in patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    return cleaned


def normalize_smalltalk_text(
    text: str,
    *,
    language: str,
    is_new_session: bool,
    is_acknowledgement: bool,
) -> str:
    cleaned = normalize_assistant_text(text, language, None, None)
    cleaned = re.sub(r"Let's return to the current question:\s*.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"Tuleme nüüd tagasi praeguse küsimuse juurde:\s*.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"Верн[её]мся к текущему вопросу:\s*.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    if is_acknowledgement and not is_new_session:
        cleaned = re.sub(r"^(Tere|Hei|Hello|Hi|Hey|Здравствуйте|Привет)[!,.:\s]+", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(
            r"^(Räägime edasi|Jätkame|Let'?s continue|We can continue|Продолжим)[^.\n]*[.\n\s]*",
            "",
            cleaned,
            flags=re.IGNORECASE,
        ).strip()
        if not cleaned:
            return _short_acknowledgement(language)

    return cleaned.strip()


def _short_acknowledgement(language: str) -> str:
    if language == "Russian":
        return "Понял."
    if language == "English":
        return "Got it."
    return "Sain aru."


def _strip_repeated_question_tail(text: str, current_question: dict[str, Any] | None) -> str:
    question_text = get_current_question_text(current_question).strip()
    if not question_text:
        return text
    patterns = [
        rf"\s*(?:Let us continue with one more question:\s*)?{re.escape(question_text)}\s*$",
        rf"\s*(?:Let's return to the current question:\s*)?{re.escape(question_text)}\s*$",
        rf"\s*(?:Tuleme nüüd tagasi praeguse küsimuse juurde:\s*)?{re.escape(question_text)}\s*$",
        rf"\s*(?:Верн[её]мся к текущему вопросу:\s*)?{re.escape(question_text)}\s*$",
    ]
    cleaned = text
    for pattern in patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    return cleaned
