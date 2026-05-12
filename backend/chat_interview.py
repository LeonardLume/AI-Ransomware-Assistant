from __future__ import annotations

import json
import re
import unicodedata
from typing import Any

from backend.config import get_llm_settings
from backend.llm_client import generate_text, load_prompt, parse_json_from_llm
from backend.questions import load_domain_metadata, load_questions, load_source_notes, question_map
from backend.redaction import redact_sensitive_text
from backend.skills import build_skill_context_for_domain

Intent = str
VALID_INTENTS = {"answer", "clarification", "report_request", "smalltalk", "unknown"}

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
]

CLARIFICATION_HINTS = [
    "kes sa oled",
    "kes oled",
    "too näidised",
    "too naidised",
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

QUESTION_WORDS = [
    "kes",
    "mis",
    "mida",
    "miks",
    "kuidas",
    "kas",
    "what",
    "who",
    "why",
    "how",
    "что",
    "кто",
    "почему",
    "как",
]

SMALLTALK_HINTS = [
    "tere",
    "hei",
    "hello",
    "hi",
    "aitäh",
    "aitah",
    "tänan",
    "tanan",
    "thanks",
    "спасибо",
    "привет",
]

ANSWER_HINTS = [
    "jah",
    "yes",
    "on olemas",
    "olemas",
    "kasutame",
    "teeme",
    "ei",
    "no",
    "pole",
    "puudub",
    "ei ole",
    "osaliselt",
    "mõnel",
    "monel",
    "ainult",
    "ei tea",
    "unsure",
    "not sure",
]

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
    return classify_user_intent(message) == "clarification"


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

    has_question_mark = "?" in raw or "？" in raw
    has_clarification_hint = _contains_any(text, CLARIFICATION_HINTS)
    has_question_word = any(re.search(rf"\b{re.escape(_normalize(word))}\b", text) for word in QUESTION_WORDS)
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
) -> dict[str, Any]:
    language = detect_language(user_message)
    q_context = current_question or next_missing_question(current_answers)
    if looks_like_offensive_request(user_message):
        return defensive_refusal(user_message, q_context)

    if get_llm_settings()["provider"] == "fallback":
        fallback = fallback_client_answer(user_message, q_context)
        fallback["redactions_applied"] = []
        fallback["redacted_for_llm"] = False
        return fallback

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

    result = generate_text(
        prompt=json.dumps(context_payload, ensure_ascii=False, indent=2),
        system_prompt=load_prompt("advisor_prompt.txt"),
        temperature=0.25,
    )

    if not result.used_real_llm or not result.text.strip():
        fallback = fallback_client_answer(user_message, q_context)
        fallback["redactions_applied"] = redactions
        fallback["redacted_for_llm"] = bool(redactions)
        return fallback

    message = normalize_assistant_text(result.text.strip(), language, q_context, current_answer)
    if not _is_identity_question(user_message):
        message = _strip_unrequested_identity(message)
    if advisory_focus == "six_month_restore_test":
        message = _ensure_six_month_explanation(message)
    if _is_identity_question(user_message) and not _contains_any(_normalize(message), ["olen ransomware readiness", "i am ransomware readiness"]):
        message = f"{_identity_text(language)}\n\n{message}"

    return {
        "message": message,
        "provider": result.provider,
        "used_fallback": False,
        "model": result.model,
        "error": result.error,
        "redactions_applied": redactions,
        "redacted_for_llm": bool(redactions),
    }


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
        "trusted_sources_used_for_project": load_source_notes(),
        "conversation_rules": [
            "Answer the client question first.",
            "Do not treat clarification questions as questionnaire answers.",
            "Do not introduce yourself unless the user asks who you are.",
            "If the user writes only 'mida', interpret it as: explain the current question in simpler words.",
            "If the user asks for examples or 'näidised', give 2-4 concrete examples for the current question.",
            "If advisory_focus is six_month_restore_test, explain why a recent restore test such as 6 months is used as a practical freshness check.",
            "Use defensive_skill_context for practical explanations, follow-up questions, recommended actions, and evidence examples.",
            "Explain what evidence would prove readiness, for example a restore test date and result for backup questions.",
            "Keep all guidance defensive-only. Refuse offensive hacking, malware, exploitation, MFA bypass, credential theft, persistence, or evasion requests.",
            "Do not say the user already answered the current question unless current_question_answer is not null.",
            "If current_question_answer is null, discuss the current question generally, not as already answered.",
            "Use simple business language for impact and next steps.",
            "Do not claim this is a full audit.",
            "Do not ask whether the user wants to move on.",
            "Return to the active interview question at the end.",
        ],
    }


def normalize_assistant_text(
    text: str,
    language: str,
    current_question: dict[str, Any] | None,
    current_answer: dict[str, Any] | None = None,
) -> str:
    cleaned = text.strip()
    cleaned = re.sub(
        r"^(Of course|Certainly|Sure|Absolutely|Loomulikult|Kindlasti|Jah, muidugi)[,!\s]+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = cleaned.replace("```", "").strip()
    cleaned = re.sub(r"Kas soovite liikuda järgmise küsimuse juurde\?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"Kas soovite jätkata järgmise küsimusega\?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"Jätkame nüüd küsimusega:\s*.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    if current_answer is None:
        cleaned = re.sub(r"Teie vastus on [^.?!]+[.?!]\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"Kuna olete öelnud[^.?!]+[.?!]\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    if current_question and _return_to_question_line(language, current_question) not in cleaned:
        cleaned = f"{cleaned}\n\n{_return_to_question_line(language, current_question)}"
    return cleaned.strip()


def fallback_client_answer(user_message: str, current_question: dict[str, Any] | None) -> dict[str, Any]:
    text = _normalize(user_message)
    language = detect_language(user_message)

    if looks_like_offensive_request(user_message):
        return defensive_refusal(user_message, current_question)
    if _is_identity_question(user_message):
        answer = _identity_text(language)
    elif _is_example_request(text) and current_question:
        answer = _examples_for_question(current_question)
    elif "mfa" in text or "mitmefaktor" in text:
        answer = (
            "MFA ehk mitmefaktoriline autentimine tähendab, et paroolist üksi ei piisa. "
            "Sisselogimiseks on vaja ka teist kinnitust, näiteks telefonirakendust, turvavõtit või koodi.\n\n"
            "See vähendab riski, et varastatud parool annab ründajale kohe ligipääsu e-postile, VPN-ile või admin-kontole."
        )
    elif "taast" in text or "restore" in text:
        answer = (
            "Varukoopia taastamist peab testima, sest backup on kasulik ainult siis, kui sellest saab päriselt süsteemi või andmed tagasi.\n\n"
            "Lihtne test võib olla ühe kriitilise kausta või väiksema süsteemi taastamine ning aja ja probleemide kirja panemine."
        )
    elif "backup" in text or "varukoop" in text or "резерв" in text:
        answer = (
            "Varukoopiad on lunavara korral üks tähtsamaid kaitsekihte. Kui põhisüsteemid krüpteeritakse, aitab toimiv backup töö taastada.\n\n"
            "Oluline on, et vähemalt üks koopia oleks ründajale raskesti kättesaadav: näiteks offline, immutable või eraldi õigustega."
        )
    elif "incident" in text or "intsident" in text or "ir" in text or "план" in text:
        answer = (
            "Incident response tähendab kokkulepet, mida teha siis, kui rünnak või tõsine intsident päriselt toimub.\n\n"
            "Väikeses organisatsioonis piisab alustuseks lühikesest plaanist: kes otsustab, kellele helistada, kuidas süsteeme eraldada ja millal kaasata partnerid."
        )
    elif "patch" in text or "uuendus" in text or "обнов" in text:
        answer = (
            "Patchimine tähendab turvauuenduste paigaldamist. See sulgeb teadaolevaid haavatavusi, mida ründajad muidu kasutada saaksid.\n\n"
            "Praktiline eesmärk on teada, kes uuenduste eest vastutab ja kui kiiresti kriitilised parandused paigaldatakse."
        )
    elif "admin" in text or "õigus" in text or "oigus" in text or "прав" in text:
        answer = (
            "Administraatoriõigused annavad kasutajale või kontole väga suure mõju. Kui selline konto satub ründaja kätte, võib kahju kiiresti kasvada.\n\n"
            "Hea lähtekoht on least privilege: admin-õigused ainult neile, kellel neid päriselt vaja on, ja eraldi admin-kontod igapäevatööst lahus."
        )
    elif "ransomware" in text or "lunavara" in text:
        answer = (
            "Lunavara on rünnak, kus andmed või süsteemid muudetakse kasutajale kättesaamatuks ja nõutakse lunaraha.\n\n"
            "Readiness tähendab, et organisatsioon suudab rünnakut ennetada, mõju piirata ja töö võimalikult kiiresti taastada."
        )
    elif "partial" in text or "yes" in text or "vahe" in text:
        answer = (
            "`yes` tähendab, et kontroll on sisuliselt olemas ja toimib enamiku asjakohaste süsteemide või kasutajate puhul.\n\n"
            "`partial` tähendab, et midagi on tehtud, aga katvus, regulaarsus või tõendus on puudulik. Näiteks MFA on ainult adminidel, kuid mitte kõigil olulistel pilvekontodel."
        )
    else:
        answer = (
            "See tööriist annab esmase enesehindamise, mitte täieliku auditi. "
            "Võid küsida mõisteid lihtsas keeles ning mina seon vastuse tagasi praeguse intervjuuküsimusega."
        )

    answer = _append_practical_evidence_hint(text, answer)
    if current_question:
        answer = f"{answer}\n\n{_return_to_question_line(language, current_question)}"
    return {"message": answer, "provider": "fallback", "used_fallback": True, "model": "deterministic-template", "error": None}


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


def answer_smalltalk(message: str, current_question: dict[str, Any] | None) -> dict[str, Any]:
    language = detect_language(message)
    if language == "Russian":
        answer = "Хорошо, продолжим спокойно и по шагам."
    elif language == "English":
        answer = "Sure. We can continue step by step."
    else:
        answer = "Jah, jätkame rahulikult samm-sammult."
    if current_question:
        answer = f"{answer}\n\n{_return_to_question_line(language, current_question)}"
    return {"message": answer, "provider": "fallback", "used_fallback": True, "model": "deterministic-template", "error": None}


def extract_answers_with_llm(
    user_message: str,
    questions: list[dict[str, Any]],
    current_answers: dict[str, dict[str, Any]],
    current_question: dict[str, Any] | None,
) -> dict[str, Any]:
    deterministic_intent = classify_user_intent(user_message, current_question)
    if deterministic_intent != "answer":
        return _empty_extraction(deterministic_intent)

    if get_llm_settings()["provider"] == "fallback":
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
            "intent": "answer|clarification|report_request|smalltalk|unknown",
            "extracted_answers": {"question_id": "yes|partial|no|unsure"},
            "unclear_questions": ["question_id"],
            "confidence": {"question_id": 0.0},
            "needs_clarification": True,
            "clarification_question": "short Estonian question",
        },
    }
    result = generate_text(
        prompt=json.dumps(prompt_payload, ensure_ascii=False, indent=2),
        system_prompt=load_prompt("extraction_prompt.txt"),
        temperature=0,
    )
    parsed = parse_json_from_llm(result.text)
    if not result.used_real_llm or not parsed:
        fallback = fallback_extract_answers(user_message, questions, current_question)
        fallback["llm_error"] = result.error or "LLM did not return valid extraction JSON."
        fallback["redactions_applied"] = redactions
        fallback["redacted_for_llm"] = bool(redactions)
        return fallback

    parsed_intent = _normalize_intent(parsed.get("intent"), deterministic_intent)
    if deterministic_intent == "answer" and parsed_intent != "answer":
        guarded = fallback_extract_answers(user_message, questions, current_question)
        guarded["provider"] = result.provider
        guarded["used_fallback"] = False
        guarded["llm_error"] = f"LLM returned intent '{parsed_intent}', but deterministic answer signal was used."
        guarded["redactions_applied"] = redactions
        guarded["redacted_for_llm"] = bool(redactions)
        return guarded

    validated = validate_extraction(parsed, questions, current_question, deterministic_intent)
    validated["provider"] = result.provider
    validated["used_fallback"] = False
    validated["llm_error"] = result.error
    validated["redactions_applied"] = redactions
    validated["redacted_for_llm"] = bool(redactions)
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
            if normalized_answer in qmap[qid].get("options", []):
                extracted[qid] = normalized_answer
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
            if qid not in qmap:
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
        answer, score = infer_answer(user_message, qid)
        if answer and answer in q.get("options", []):
            extracted[qid] = answer
            confidence[qid] = score

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


def infer_answer(user_message: str, question_id: str = "") -> tuple[str | None, float]:
    text = _normalize(user_message)

    if _is_short_yes(text):
        return "yes", 0.86

    if question_id == "backups_exist" and _contains_any(text, ["backup", "varukoop", "koopiad"]):
        if _contains_any(text, ["olemas", "teeme", "jah", "regulaarselt", "iga paev", "iga nadal", "daily", "weekly"]):
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

    if _contains_any(text, ["ei tea", "pole kindel", "ei ole kindel", "kindel pole", "ei oska oelda", "unsure", "not sure"]):
        return "unsure", 0.9
    if _contains_any(
        text,
        ["osaliselt", "monel", "mõnel", "mõned", "moned", "ainult", "osadel", "mitte koigil", "mitte kõigil", "vahel", "ebaregulaars"],
    ):
        return "partial", 0.82
    if _contains_any(text, ["ei ole", "pole", "puudub", "ei kasuta", "ei tee", "ei test", "mitte", "no", "not"]) or re.search(r"\bei\b", text):
        return "no", 0.78
    if _contains_any(text, ["jah", "yes", "olemas", "kasutame", "teeme", "on olemas", "regulaars", "koik", "kõik", "testitud", "dokumenteeritud"]):
        return "yes", 0.78
    return None, 0.0


def generate_next_question(
    missing_question: dict[str, Any],
    current_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if get_llm_settings()["provider"] == "fallback":
        return {"message": fallback_question_text(missing_question), "provider": "fallback", "used_fallback": True}

    payload = {
        "question": missing_question,
        "current_context": current_context or {},
        "output": "Plain Estonian question only.",
    }
    result = generate_text(
        prompt=json.dumps(payload, ensure_ascii=False, indent=2),
        system_prompt=load_prompt("interview_system_prompt.txt"),
        temperature=0.2,
    )
    text = result.text.strip().strip('"')
    if not result.used_real_llm or not text or len(text) > 500:
        return {"message": fallback_question_text(missing_question), "provider": "fallback", "used_fallback": True}
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

    if current_question:
        answer = f"{answer}\n\n{_return_to_question_line(language, current_question)}"
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


def _return_to_question_line(language: str, current_question: dict[str, Any]) -> str:
    question = get_current_question_text(current_question)
    if language == "Russian":
        return f"Вернёмся к текущему вопросу: {question}"
    if language == "English":
        return f"Let's return to the current question: {question}"
    return f"Tuleme nüüd tagasi praeguse küsimuse juurde: {question}"


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
    return _contains_any(text, ["too näidised", "too naidised", "näidised", "naidised", "näide", "naide", "examples", "example"])


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
    return len(text.split()) <= 3 and _contains_any(text, SMALLTALK_HINTS)


def _has_answer_signal(text: str) -> bool:
    return _is_short_yes(text) or _contains_any(text, ANSWER_HINTS)


def _is_short_yes(text: str) -> bool:
    return text.strip() in {"ja", "jep", "jup"}


def _looks_like_direct_answer(text: str, current_question: dict[str, Any] | None) -> bool:
    if not current_question:
        return _has_answer_signal(text)
    question_id = current_question.get("id", "")
    topic_ids = _topic_question_ids(text)
    return _has_answer_signal(text) and (not topic_ids or question_id in topic_ids)


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _contains_any(text: str, phrases: list[str]) -> bool:
    normalized_phrases = [_normalize(phrase) for phrase in phrases]
    return any(phrase in text for phrase in normalized_phrases)
