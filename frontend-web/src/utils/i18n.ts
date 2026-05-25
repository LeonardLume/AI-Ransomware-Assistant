import type { AdvisoryChecklistItem, FindingCard, RiskLevel, SkillReference } from "../types/api";

export type UiLanguage = "et" | "en" | "ru";

export const languageOptions: Array<{ id: UiLanguage; label: string }> = [
  { id: "et", label: "ET" },
  { id: "en", label: "EN" },
  { id: "ru", label: "RU" },
];

const labels = {
  et: {
    language: "Keel",
    home: "Avaleht",
    interview: "AI intervjuu",
    report: "Raport",
    actionPlan: "Tegevusplaan",
    evidenceBinder: "Tõendite kaust",
    skills: "Oskused",
    technicalTransparency: "Tehniline läbipaistvus",
    recentSessions: "Hiljutised sessioonid",
    newAssessment: "Uus hindamine",
    backendStatus: "Taustsüsteemi olek",
    providerStatus: "Teenusepakkuja",
    fallbackMode: "Varurežiim",
    online: "sees",
    offline: "väljas",
    readinessReport: "Valmisoleku raport",
    officialScoreBackend: "Ametlik tulemus ja riskitase tulevad FastAPI taustsüsteemist.",
    refreshReport: "Värskenda raportit",
    generateReport: "Koosta raport",
    noReportLoaded: "Raportit pole laaditud",
    noReportDescription: "Raporti saab koostada praeguse taustsüsteemi sessiooni põhjal.",
    overallScore: "Üldtulemus",
    riskLevel: "Riskitase",
    completion: "Täidetud",
    confidence: "Usaldusväärsus",
    separateFromScore: "Tulemusest eraldi",
    domainScores: "Domeenide tulemused",
    findings: "Leiud",
    topRisks: "Peamised riskid",
    nextSteps: "Järgmised sammud",
    externalExposure: "Välise nähtavuse enesekontroll",
    advisoryOnly: "nõuandev",
    noScanning: "skaneerimist ei tehta",
    actionPlanDescription: "Taustsüsteemi raportist tulnud prioriseeritud parandustegevused.",
    noActionPlanTitle: "Tegevusplaani pole veel",
    noActionPlanDescription: "Lõpeta intervjuu või laadi demoprofiil, et näha prioriseeritud tegevusi.",
    next48Hours: "Järgmised 48 tundi",
    next14Days: "Järgmised 14 päeva",
    next30Days: "Järgmised 30 päeva",
    owner: "Omanik",
    effort: "Pingutus",
    deadline: "Tähtaeg",
    priority: "Prioriteet",
    evidenceBinderDescription: "Tõendid on grupeeritud domeenide järgi. Need toetavad auditivalmidust, kuid ei arvuta tulemust.",
    backendChecklist: "taustsüsteemi kontrollnimekiri",
    placeholderChecklist: "näidiskontrollnimekiri",
    skillsDescription: "Kaitseoskused ja juhendid toetavad selgitusi ja tegevusplaane.",
    skillsMatchedDescription: "Taustsüsteemi raportiga sobitatud kaitseoskused.",
    skillsNotLoaded: "Oskuste kiht pole veel laaditud",
    skillsNotLoadedDescription: "Oskused toetavad selgitusi, tegevusplaane ja tõendisoovitusi. Need ei arvuta numbrilist tulemust.",
    technical: "Tehniline vaade",
    technicalDescription: "Teenusepakkuja olek, struktureeritud taustsüsteemi olek ja silumisandmed.",
    providerAndGuardrails: "Teenusepakkuja ja kaitsepiirded",
    backend: "Taustsüsteem",
    redaction: "Redigeerimine",
    promptInjection: "Juhiste muutmise katse",
    notReported: "ei raporteeritud",
    notApplied: "ei rakendatud",
    applied: "rakendatud",
    blocked: "blokeeritud",
    notTriggered: "ei käivitunud",
    structuredAnswers: "Struktureeritud vastused",
    noValidatedAnswers: "Valideeritud struktureeritud vastuseid veel ei ole.",
    backendSourceOfTruth: "Taustsüsteem on tõeallikas",
    backendSourceText: "React kuvab ainult taustsüsteemi olekut. FastAPI haldab küsimusi, vastuseid, tulemuse arvutust, raporteid, oskusi ja tõendeid.",
    technicalTrace: "Tehniline jälg",
    workflow: "Töövoog",
    questionSource: "Küsimuste allikas",
    llmRole: "LLM-i roll",
    backendValidation: "Taustsüsteemi valideerimine",
    ruleScoring: "Reeglipõhine tulemus",
    sensitiveData: "Tundlikud andmed",
    debugTechnicalData: "Silumise tehnilised andmed",
    defensiveOnly: "ainult kaitsev",
    rawTraceTitle: "Tehniline jälg",
    rawTraceText: "Toored tehnilised andmed hoitakse tavavestlusest eraldi. Ava silumisandmed ainult siis, kui vajad integratsiooni detaile.",
    debugJson: "Silumise JSON",
    noTechnicalTrace: "Tehnilist jälge pole veel",
    noTechnicalTraceDescription: "Silumisandmed ilmuvad siia pärast seda, kui kasutajaliides on taustsüsteemiga suhelnud.",
    chat: "Vestlus",
    startNewAssessment: "Alusta uut hindamist",
    chatEmptyTitle: "Alusta kaitsevõime valmisoleku hindamist",
    chatEmptyDescription: "Alusta intervjuud. Taustsüsteem juhib küsimusi, valideerimist, tulemuse arvutust ja raporteid.",
    backendError: "Taustsüsteemi viga",
    retryLastMessage: "Proovi viimast sõnumit uuesti",
    composerPlaceholder: "Kirjuta vastus või küsi selgitust. Vajadusel käivitatakse uus sessioon automaatselt...",
    artifactsOpened: "Avatud artefaktid",
    processingTimeline: "Töötluse ajajoon",
    technicalDetails: "Tehnilised detailid",
    extractedAnswers: "Leitud vastused",
    noStructuredAnswers: "Sellest assistendi käigust ei leitud struktureeritud vastuseid.",
    technicalJson: "Tehniline JSON",
    closeArtifact: "Sulge artefakt",
    noActiveSession: "Aktiivset sessiooni pole",
    sessionLabel: "Sessioon",
    startOrLoadAssessment: "Sessiooni artefaktide nägemiseks alusta hindamist või laadi sessioon.",
  },
  en: {
    language: "Language",
    home: "Home",
    interview: "AI Interview",
    report: "Report",
    actionPlan: "Action Plan",
    evidenceBinder: "Evidence Binder",
    skills: "Skills",
    technicalTransparency: "Technical Transparency",
    recentSessions: "Recent sessions",
    newAssessment: "New assessment",
    backendStatus: "Backend status",
    providerStatus: "Provider status",
    fallbackMode: "Fallback mode",
    online: "online",
    offline: "offline",
    readinessReport: "Readiness report",
    officialScoreBackend: "Official score and risk level are returned by FastAPI.",
    refreshReport: "Refresh report",
    generateReport: "Generate report",
    noReportLoaded: "No report loaded",
    noReportDescription: "A report can be generated from the current backend session.",
    overallScore: "Overall score",
    riskLevel: "Risk level",
    completion: "Completion",
    confidence: "Confidence",
    separateFromScore: "Separate from score",
    domainScores: "Domain scores",
    findings: "Findings",
    topRisks: "Top risks",
    nextSteps: "Next steps",
    externalExposure: "External exposure self-check",
    advisoryOnly: "advisory only",
    noScanning: "no scanning",
    actionPlanDescription: "Prioritized remediation actions from the backend report.",
    noActionPlanTitle: "No action plan yet",
    noActionPlanDescription: "Complete the interview or load a demo profile to populate prioritized actions.",
    next48Hours: "Next 48 hours",
    next14Days: "Next 14 days",
    next30Days: "Next 30 days",
    owner: "Owner",
    effort: "Effort",
    deadline: "Deadline",
    priority: "Priority",
    evidenceBinderDescription: "Checklist grouped by domain. Evidence supports audit readiness but does not calculate score.",
    backendChecklist: "backend checklist",
    placeholderChecklist: "placeholder checklist",
    skillsDescription: "Defensive skills and playbooks support explanations and action plans.",
    skillsMatchedDescription: "Matched defensive skills returned by the backend report.",
    skillsNotLoaded: "Skills layer not loaded yet",
    skillsNotLoadedDescription: "Skills support explanations, action plans, and evidence suggestions. They do not calculate the numeric score.",
    technical: "Technical",
    technicalDescription: "Provider status, structured backend state, and debug payloads.",
    providerAndGuardrails: "Provider and guardrails",
    backend: "Backend",
    redaction: "Redaction",
    promptInjection: "Prompt injection",
    notReported: "not reported",
    notApplied: "not applied",
    applied: "applied",
    blocked: "blocked",
    notTriggered: "not triggered",
    structuredAnswers: "Structured answers",
    noValidatedAnswers: "No validated structured answers yet.",
    backendSourceOfTruth: "Backend source of truth",
    backendSourceText: "The React app displays backend state only. FastAPI owns questions, structured answers, scoring, reports, skills, and evidence.",
    technicalTrace: "Technical trace",
    workflow: "Workflow",
    questionSource: "Question source",
    llmRole: "LLM role",
    backendValidation: "Backend validation",
    ruleScoring: "Rule scoring",
    sensitiveData: "Sensitive data",
    debugTechnicalData: "Debug technical data",
    defensiveOnly: "defensive-only",
    rawTraceTitle: "Technical Trace",
    rawTraceText: "Raw technical payloads are kept out of the normal chat thread. Open the debug accordion only when you need integration details.",
    debugJson: "Debug JSON",
    noTechnicalTrace: "No technical trace yet",
    noTechnicalTraceDescription: "Debug payloads appear here after the UI talks to the backend.",
    chat: "Chat",
    startNewAssessment: "Start new assessment",
    chatEmptyTitle: "Start a defensive readiness assessment",
    chatEmptyDescription: "Start the interview. The backend controls questions, validation, scoring, and reports.",
    backendError: "Backend error",
    retryLastMessage: "Retry last message",
    composerPlaceholder: "Write an answer or ask for an explanation. A new session starts automatically if needed...",
    artifactsOpened: "Artifacts opened",
    processingTimeline: "Processing timeline",
    technicalDetails: "Technical details",
    extractedAnswers: "Extracted answers",
    noStructuredAnswers: "No structured answers were extracted from this assistant turn.",
    technicalJson: "Technical JSON",
    closeArtifact: "Close artifact",
    noActiveSession: "No active session",
    sessionLabel: "Session",
    startOrLoadAssessment: "Start or load an assessment to see session artifacts.",
  },
  ru: {
    language: "Язык",
    home: "Главная",
    interview: "AI интервью",
    report: "Отчёт",
    actionPlan: "План действий",
    evidenceBinder: "Папка доказательств",
    skills: "Навыки",
    technicalTransparency: "Техническая прозрачность",
    recentSessions: "Последние сессии",
    newAssessment: "Новая оценка",
    backendStatus: "Статус backend",
    providerStatus: "Провайдер",
    fallbackMode: "Fallback режим",
    online: "онлайн",
    offline: "офлайн",
    readinessReport: "Отчёт готовности",
    officialScoreBackend: "Официальный score и уровень риска возвращает FastAPI backend.",
    refreshReport: "Обновить отчёт",
    generateReport: "Создать отчёт",
    noReportLoaded: "Отчёт не загружен",
    noReportDescription: "Отчёт можно создать из текущей backend-сессии.",
    overallScore: "Общий score",
    riskLevel: "Уровень риска",
    completion: "Заполнено",
    confidence: "Уверенность",
    separateFromScore: "Отдельно от score",
    domainScores: "Score по доменам",
    findings: "Findings",
    topRisks: "Главные риски",
    nextSteps: "Следующие шаги",
    externalExposure: "Самопроверка внешней видимости",
    advisoryOnly: "только рекомендации",
    noScanning: "без сканирования",
    actionPlanDescription: "Приоритизированные defensive-действия из backend отчёта.",
    noActionPlanTitle: "Плана действий пока нет",
    noActionPlanDescription: "Заверши интервью или загрузи demo profile, чтобы увидеть приоритетные действия.",
    next48Hours: "Следующие 48 часов",
    next14Days: "Следующие 14 дней",
    next30Days: "Следующие 30 дней",
    owner: "Владелец",
    effort: "Сложность",
    deadline: "Срок",
    priority: "Приоритет",
    evidenceBinderDescription: "Checklist по доменам. Доказательства помогают готовности к аудиту, но не считают score.",
    backendChecklist: "backend checklist",
    placeholderChecklist: "пример checklist",
    skillsDescription: "Defensive skills и playbooks помогают объяснениям и планам действий.",
    skillsMatchedDescription: "Defensive skills, подобранные backend отчётом.",
    skillsNotLoaded: "Слой skills ещё не загружен",
    skillsNotLoadedDescription: "Skills помогают объяснениям, планам действий и доказательствам. Они не считают числовой score.",
    technical: "Технический вид",
    technicalDescription: "Статус провайдера, структурированное состояние backend и debug payloads.",
    providerAndGuardrails: "Провайдер и guardrails",
    backend: "Backend",
    redaction: "Редакция данных",
    promptInjection: "Prompt injection",
    notReported: "не сообщалось",
    notApplied: "не применено",
    applied: "применено",
    blocked: "заблокировано",
    notTriggered: "не сработало",
    structuredAnswers: "Структурированные ответы",
    noValidatedAnswers: "Валидированных структурированных ответов пока нет.",
    backendSourceOfTruth: "Backend — источник истины",
    backendSourceText: "React только показывает состояние backend. FastAPI владеет вопросами, ответами, score, отчётами, skills и доказательствами.",
    technicalTrace: "Технический trace",
    workflow: "Процесс",
    questionSource: "Источник вопросов",
    llmRole: "Роль LLM",
    backendValidation: "Backend validation",
    ruleScoring: "Rule-based score",
    sensitiveData: "Чувствительные данные",
    debugTechnicalData: "Debug технические данные",
    defensiveOnly: "только defense",
    rawTraceTitle: "Технический trace",
    rawTraceText: "Raw technical payloads вынесены из обычного чата. Открывай debug только когда нужны детали интеграции.",
    debugJson: "Debug JSON",
    noTechnicalTrace: "Технического trace пока нет",
    noTechnicalTraceDescription: "Debug payloads появятся здесь после общения UI с backend.",
    chat: "Чат",
    startNewAssessment: "Начать новую оценку",
    chatEmptyTitle: "Начать оценку защитной готовности",
    chatEmptyDescription: "Запустите интервью. Backend управляет вопросами, валидацией, оценкой и отчетами.",
    backendError: "Ошибка backend",
    retryLastMessage: "Повторить последнее сообщение",
    composerPlaceholder: "Напишите ответ или попросите пояснение. При необходимости новая сессия запустится автоматически...",
    artifactsOpened: "Открытые артефакты",
    processingTimeline: "Хронология обработки",
    technicalDetails: "Технические детали",
    extractedAnswers: "Извлеченные ответы",
    noStructuredAnswers: "Из этого ответа ассистента не удалось извлечь структурированные ответы.",
    technicalJson: "Технический JSON",
    closeArtifact: "Закрыть артефакт",
    noActiveSession: "Нет активной сессии",
    sessionLabel: "Сессия",
    startOrLoadAssessment: "Начните оценку или загрузите сессию, чтобы увидеть артефакты.",
  },
} as const;

export type TranslationKey = keyof typeof labels.et;

export function t(language: UiLanguage, key: TranslationKey): string {
  return normalizeBrokenText(labels[language][key] || labels.et[key]);
}

function normalizeBrokenText(value: string): string {
  const replacements: Array<[string, string]> = [
    ["â€¢", "•"],
    ["TÃµ", "Tõ"],
    ["tÃµ", "tõ"],
    ["Ã¤", "ä"],
    ["Ã„", "Ä"],
    ["Ãµ", "õ"],
    ["Ã•", "Õ"],
    ["Ã¶", "ö"],
    ["Ã–", "Ö"],
    ["Ã¼", "ü"],
    ["Ãœ", "Ü"],
    ["Å¾", "ž"],
    ["Ð¯", "Я"],
    ["Ð“", "Г"],
    ["Ðž", "О"],
    ["ÐŸ", "П"],
    ["Ð¢", "Т"],
    ["Ð¡", "С"],
    ["Ð’", "В"],
    ["Ð£", "У"],
    ["Ð ", "Р"],
    ["Ðœ", "М"],
    ["Ð›", "Л"],
    ["Ð˜", "И"],
    ["Ð", "Н"],
    ["Ð°", "а"],
    ["Ð±", "б"],
    ["Ð²", "в"],
    ["Ð³", "г"],
    ["Ð´", "д"],
    ["Ðµ", "е"],
    ["Ð¶", "ж"],
    ["Ð·", "з"],
    ["Ð¸", "и"],
    ["Ð¹", "й"],
    ["Ðº", "к"],
    ["Ð»", "л"],
    ["Ð¼", "м"],
    ["Ð½", "н"],
    ["Ð¾", "о"],
    ["Ð¿", "п"],
    ["Ñ€", "р"],
    ["Ñ", "с"],
    ["Ñ‚", "т"],
    ["Ñƒ", "у"],
    ["Ñ„", "ф"],
    ["Ñ…", "х"],
    ["Ñ†", "ц"],
    ["Ñ‡", "ч"],
    ["Ñˆ", "ш"],
    ["Ñ‰", "щ"],
    ["ÑŠ", "ъ"],
    ["Ñ‹", "ы"],
    ["ÑŒ", "ь"],
    ["Ñ", "э"],
    ["ÑŽ", "ю"],
    ["Ñ", "я"],
    ["Ñ‘", "ё"],
  ];

  return replacements.reduce((text, [broken, fixed]) => text.split(broken).join(fixed), value);
}

const domains: Record<string, Record<UiLanguage, string>> = {
  backups: { et: "Varukoopiad ja taastamine", en: "Backups and restore", ru: "Резервные копии и восстановление" },
  mfa_access: { et: "MFA ja ligipääsud", en: "MFA and access", ru: "MFA и доступы" },
  mfa: { et: "MFA ja ligipääsud", en: "MFA and access", ru: "MFA и доступы" },
  patching: { et: "Paikamine ja haavatavused", en: "Patching and vulnerabilities", ru: "Патчи и уязвимости" },
  admin_rights: { et: "Administraatoriõigused", en: "Administrator rights", ru: "Права администратора" },
  incident_response: { et: "Intsidendile reageerimine", en: "Incident response", ru: "Incident response" },
  detection_monitoring: { et: "Tuvastus ja seire", en: "Detection and monitoring", ru: "Обнаружение и мониторинг" },
  employee_security_hygiene: { et: "Töötajate turvahügieen", en: "Employee security hygiene", ru: "Гигиена безопасности сотрудников" },
  external_exposure_self_check: { et: "Välise nähtavuse enesekontroll", en: "External exposure self-check", ru: "Самопроверка внешней видимости" },
};

const riskLabels: Record<string, Record<UiLanguage, string>> = {
  low: { et: "Madal", en: "Low", ru: "Низкий" },
  medium: { et: "Keskmine", en: "Medium", ru: "Средний" },
  high: { et: "Kõrge", en: "High", ru: "Высокий" },
  critical: { et: "Kriitiline", en: "Critical", ru: "Критический" },
};

const simpleValueLabels: Record<string, Record<UiLanguage, string>> = {
  preliminary: { et: "Esialgne", en: "Preliminary", ru: "Предварительно" },
  final: { et: "Lõplik", en: "Final", ru: "Финально" },
  "not ready": { et: "Pole valmis", en: "Not ready", ru: "Не готово" },
  high: { et: "Kõrge", en: "High", ru: "Высокая" },
  medium: { et: "Keskmine", en: "Medium", ru: "Средняя" },
  low: { et: "Madal", en: "Low", ru: "Низкая" },
  yes: { et: "Jah", en: "Yes", ru: "Да" },
  partial: { et: "Osaliselt", en: "Partial", ru: "Частично" },
  no: { et: "Ei", en: "No", ru: "Нет" },
  unsure: { et: "Ei tea", en: "Unsure", ru: "Не уверен" },
  "all employees": { et: "Kõik töötajad", en: "All employees", ru: "Все сотрудники" },
  management: { et: "Juhtkond", en: "Management", ru: "Руководство" },
  "7 days": { et: "7 päeva", en: "7 days", ru: "7 дней" },
  "14 days": { et: "14 päeva", en: "14 days", ru: "14 дней" },
  "30 days": { et: "30 päeva", en: "30 days", ru: "30 дней" },
  "60 days": { et: "60 päeva", en: "60 days", ru: "60 дней" },
  "90 days": { et: "90 päeva", en: "90 days", ru: "90 дней" },
  loweffort: { et: "Madal", en: "Low", ru: "Низкая" },
  mediumeffort: { et: "Keskmine", en: "Medium", ru: "Средняя" },
  defensive_only: { et: "ainult kaitsev", en: "defensive-only", ru: "только defense" },
  fallback: { et: "varurežiim", en: "fallback", ru: "fallback" },
  ransomware: { et: "lunavara", en: "ransomware", ru: "ransomware" },
  response: { et: "reageerimine", en: "response", ru: "response" },
  containment: { et: "ohjeldamine", en: "containment", ru: "containment" },
  recovery: { et: "taastamine", en: "recovery", ru: "recovery" },
  patching: { et: "paikamine", en: "patching", ru: "patching" },
  vulnerabilities: { et: "haavatavused", en: "vulnerabilities", ru: "vulnerabilities" },
  "admin-rights": { et: "administraatoriõigused", en: "admin rights", ru: "admin-rights" },
  "least-privilege": { et: "vähimate õiguste põhimõte", en: "least privilege", ru: "least-privilege" },
  "access-review": { et: "ligipääsude ülevaatus", en: "access review", ru: "access-review" },
  "incident-response": { et: "intsidendile reageerimine", en: "incident response", ru: "incident-response" },
  communications: { et: "kommunikatsioon", en: "communications", ru: "communications" },
  tabletop: { et: "läbimäng", en: "tabletop", ru: "tabletop" },
  exercise: { et: "harjutus", en: "exercise", ru: "exercise" },
  testing: { et: "testimine", en: "testing", ru: "testing" },
  detection: { et: "tuvastus", en: "detection", ru: "detection" },
  monitoring: { et: "seire", en: "monitoring", ru: "monitoring" },
  logs: { et: "logid", en: "logs", ru: "logs" },
  "endpoint-alerts": { et: "seadmehoiatused", en: "endpoint alerts", ru: "endpoint-alerts" },
  backup: { et: "varundus", en: "backup", ru: "backup" },
  restore: { et: "taastamine", en: "restore", ru: "restore" },
  "offline-copy": { et: "võrguväline koopia", en: "offline copy", ru: "offline-copy" },
  "remote-access": { et: "kaugligipääs", en: "remote access", ru: "remote-access" },
  phishing: { et: "õngitsus", en: "phishing", ru: "phishing" },
  awareness: { et: "teadlikkus", en: "awareness", ru: "awareness" },
};

const skillTitles: Record<string, Record<UiLanguage, string>> = {
  "ransomware-backup-strategy": { et: "Lunavara varundus- ja taastamisvalmidus", en: "Ransomware backup and restore readiness", ru: "Готовность backup и восстановления при ransomware" },
  "ransomware-recovery": { et: "Lunavara taastamise planeerimine", en: "Ransomware recovery planning", ru: "Планирование восстановления после ransomware" },
  "mfa-access-control": { et: "MFA ja ligipääsukontrolli valmidus", en: "MFA and access control readiness", ru: "Готовность MFA и контроля доступа" },
  "patch-management": { et: "Paikamise ja haavatavuste haldus", en: "Patch and vulnerability management readiness", ru: "Готовность patch и vulnerability management" },
  "admin-rights-review": { et: "Administraatoriõiguste ülevaatus", en: "Administrator rights and privilege review", ru: "Проверка admin и privilege прав" },
  "incident-response-plan": { et: "Intsidendile reageerimise plaani valmidus", en: "Incident response plan readiness", ru: "Готовность incident response plan" },
  "ransomware-response": { et: "Kaitsev lunavarale reageerimise valmidus", en: "Defensive ransomware response readiness", ru: "Defensive готовность response при ransomware" },
  "tabletop-exercise": { et: "Lunavara läbimänguharjutuse valmidus", en: "Ransomware tabletop exercise readiness", ru: "Готовность ransomware tabletop exercise" },
  "detection-monitoring": { et: "Tuvastuse ja seire valmidus", en: "Detection and monitoring readiness", ru: "Готовность обнаружения и мониторинга" },
  "employee-security-hygiene": { et: "Töötajate turvahügieeni kontrollnimekiri", en: "Employee security hygiene checklist", ru: "Checklist гигиены безопасности сотрудников" },
  "external-exposure-self-check": { et: "Välise nähtavuse enesekontroll", en: "External exposure self-check", ru: "Самопроверка внешней видимости" },
};

const domainRiskText: Record<string, Record<UiLanguage, string>> = {
  backups: {
    et: "Varukoopiad võivad olla puudulikud, testimata või ründajale kättesaadavad.",
    en: "Backups may be incomplete, untested, or reachable by an attacker.",
    ru: "Резервные копии могут быть неполными, непроверенными или доступными атакующему.",
  },
  mfa_access: {
    et: "Ründaja võib pääseda süsteemidesse varastatud parooli või unustatud konto kaudu.",
    en: "An attacker may access systems through a stolen password or forgotten account.",
    ru: "Атакующий может попасть в системы через украденный пароль или забытый аккаунт.",
  },
  patching: {
    et: "Avalikud või vananenud süsteemid võivad anda ründajale lihtsa sisenemistee.",
    en: "Exposed or outdated systems may give attackers an easy entry point.",
    ru: "Открытые или устаревшие системы могут стать простым входом для атакующего.",
  },
  admin_rights: {
    et: "Liiga laiad admin-õigused võimaldavad ründajal kiiresti levida ja kaitsemeetmeid välja lülitada.",
    en: "Excessive admin rights can let attackers spread quickly and disable defenses.",
    ru: "Слишком широкие admin-права помогают атакующему быстро распространяться и отключать защиту.",
  },
  incident_response: {
    et: "Rünnaku korral võib tekkida segadus otsustajate, kontaktide, taastamise ja teavitamise osas.",
    en: "During an incident, unclear decisions, contacts, recovery, and notifications can slow response.",
    ru: "Во время инцидента неясные решения, контакты, восстановление и уведомления замедляют реакцию.",
  },
  detection_monitoring: {
    et: "Rünnak võib jääda liiga kauaks märkamatuks ning kahju kasvab enne reageerimist.",
    en: "An attack may remain unnoticed too long, increasing damage before response starts.",
    ru: "Атака может долго оставаться незамеченной, увеличивая ущерб до начала реакции.",
  },
};

const knownText: Record<string, Record<UiLanguage, string>> = {
  "Test restore for one critical system and record the result": {
    et: "Testi ühe kriitilise süsteemi taastamist ja kirjuta tulemus üles",
    en: "Test restore for one critical system and record the result",
    ru: "Провести тест восстановления одной критичной системы и зафиксировать результат",
  },
  "Enforce MFA for all administrator accounts": {
    et: "Rakenda MFA kõigile administraatori kontodele",
    en: "Enforce MFA for all administrator accounts",
    ru: "Включить MFA для всех admin-аккаунтов",
  },
  "Create a simple inventory of internet-facing services": {
    et: "Koosta lihtne nimekiri internetist ligipääsetavatest teenustest",
    en: "Create a simple inventory of internet-facing services",
    ru: "Создать простой список сервисов, доступных из интернета",
  },
  "Export and review the privileged account list": {
    et: "Ekspordi ja vaata üle privilegeeritud kontode nimekiri",
    en: "Export and review the privileged account list",
    ru: "Экспортировать и проверить список привилегированных аккаунтов",
  },
  "Create or update a short incident response plan": {
    et: "Koosta või uuenda lühike intsidendile reageerimise plaan",
    en: "Create or update a short incident response plan",
    ru: "Создать или обновить короткий incident response plan",
  },
  "Run a 60 to 90 minute ransomware tabletop exercise": {
    et: "Tee 60-90 minutiline lunavara läbimänguharjutus",
    en: "Run a 60 to 90 minute ransomware tabletop exercise",
    ru: "Провести ransomware tabletop exercise на 60-90 минут",
  },
  "Identify the critical logs that must be retained for ransomware investigation": {
    et: "Määra kriitilised logid, mida tuleb lunavara uurimiseks säilitada",
    en: "Identify the critical logs that must be retained for ransomware investigation",
    ru: "Определить критичные логи, которые нужно хранить для расследования ransomware",
  },
  "Roll out or standardize password manager use": {
    et: "Võta kasutusele või standardiseeri paroolihalduri kasutamine",
    en: "Roll out or standardize password manager use",
    ru: "Внедрить или стандартизировать использование password manager",
  },
  "Maintain a simple list of public domains, subdomains, and service owners": {
    et: "Hoia lihtsat nimekirja avalikest domeenidest, alamdomeenidest ja teenuse omanikest",
    en: "Maintain a simple list of public domains, subdomains, and service owners",
    ru: "Вести простой список публичных доменов, subdomains и владельцев сервисов",
  },
  "Backup policy or backup job schedule": {
    et: "Varunduspoliitika või varundustööde ajakava",
    en: "Backup policy or backup job schedule",
    ru: "Backup policy или расписание backup jobs",
  },
  "Restore test date and result": {
    et: "Taastamistesti kuupäev ja tulemus",
    en: "Restore test date and result",
    ru: "Дата и результат restore test",
  },
  "MFA coverage report for email, cloud, and remote access": {
    et: "MFA katvuse raport e-posti, pilve ja kaugligipääsu kohta",
    en: "MFA coverage report for email, cloud, and remote access",
    ru: "Отчёт покрытия MFA для email, cloud и remote access",
  },
  "Patch management process or responsibility matrix": {
    et: "Paikamisprotsess või vastutusmaatriks",
    en: "Patch management process or responsibility matrix",
    ru: "Процесс patch management или матрица ответственности",
  },
  "Current privileged user list": {
    et: "Praegune privilegeeritud kasutajate nimekiri",
    en: "Current privileged user list",
    ru: "Текущий список привилегированных пользователей",
  },
  "Incident response plan document": {
    et: "Intsidendile reageerimise plaani dokument",
    en: "Incident response plan document",
    ru: "Документ incident response plan",
  },
  "List of critical log sources and retention period": {
    et: "Kriitiliste logiallikate nimekiri ja säilitusaeg",
    en: "List of critical log sources and retention period",
    ru: "Список критичных log sources и срок хранения",
  },
  "Write a one-page ransomware response checklist": {
    et: "Koosta ühe lehekülje pikkune lunavarale reageerimise kontrollnimekiri",
    en: "Write a one-page ransomware response checklist",
    ru: "Написать одностраничный checklist реагирования на ransomware",
  },
  "Ransomware response checklist": {
    et: "Lunavarale reageerimise kontrollnimekiri",
    en: "Ransomware response checklist",
    ru: "Checklist реагирования на ransomware",
  },
  "Emergency contact list with offline copy": {
    et: "Hädaolukorra kontaktide nimekiri koos võrguvälise koopiaga",
    en: "Emergency contact list with offline copy",
    ru: "Список экстренных контактов с offline-копией",
  },
  "Named incident lead and backup decision maker": {
    et: "Nimetatud intsidendi juht ja asendusotsustaja",
    en: "Named incident lead and backup decision maker",
    ru: "Назначенный incident lead и резервный decision maker",
  },
  "MSP or IT provider escalation procedure": {
    et: "MSP või IT-teenusepakkuja eskalatsiooniprotseduur",
    en: "MSP or IT provider escalation procedure",
    ru: "Процедура escalation для MSP или IT provider",
  },
  "Legal, insurance, and CERT contact notes": {
    et: "Õigusnõustaja, kindlustuse ja CERT-i kontaktimärkmed",
    en: "Legal, insurance, and CERT contact notes",
    ru: "Контакты legal, insurance и CERT",
  },
  "Internal communication template": {
    et: "Sisemise kommunikatsiooni mall",
    en: "Internal communication template",
    ru: "Шаблон внутренней коммуникации",
  },
  "Incident log template": {
    et: "Intsidendilogi mall",
    en: "Incident log template",
    ru: "Шаблон журнала инцидента",
  },
  "Store emergency contacts outside the normal IT environment": {
    et: "Hoia hädaolukorra kontakte väljaspool tavapärast IT-keskkonda",
    en: "Store emergency contacts outside the normal IT environment",
    ru: "Хранить экстренные контакты вне обычной IT-среды",
  },
  "Agree who can make containment, communication, legal, and recovery decisions": {
    et: "Leppige kokku, kes teeb ohjeldamise, kommunikatsiooni, õiguslike ja taastamise otsuseid",
    en: "Agree who can make containment, communication, legal, and recovery decisions",
    ru: "Согласовать, кто принимает решения по containment, communication, legal и recovery",
  },
  "Define how to preserve key business records and incident notes": {
    et: "Määra, kuidas säilitada olulisi ärikirjeid ja intsidendimärkmeid",
    en: "Define how to preserve key business records and incident notes",
    ru: "Определить, как сохранять ключевые бизнес-записи и incident notes",
  },
  "Coordinate with the MSP or IT provider before an incident occurs": {
    et: "Kooskõlasta tegevused MSP või IT-teenusepakkujaga enne intsidenti",
    en: "Coordinate with the MSP or IT provider before an incident occurs",
    ru: "Согласовать действия с MSP или IT provider до инцидента",
  },
  "Review when to contact CERT-EE, law enforcement, legal counsel, and insurance": {
    et: "Vaata üle, millal võtta ühendust CERT-EE, õiguskaitse, õigusnõustaja ja kindlustusega",
    en: "Review when to contact CERT-EE, law enforcement, legal counsel, and insurance",
    ru: "Проверить, когда связываться с CERT-EE, law enforcement, legal counsel и insurance",
  },
  "Add ransomware-specific decision points, contacts, and recovery coordination": {
    et: "Lisa lunavarale omased otsustuskohad, kontaktid ja taastamise koordineerimine",
    en: "Add ransomware-specific decision points, contacts, and recovery coordination",
    ru: "Добавить ransomware-specific decision points, контакты и координацию recovery",
  },
  "Store an offline or external copy of the plan": {
    et: "Hoia plaanist võrguvälist või välist koopiat",
    en: "Store an offline or external copy of the plan",
    ru: "Хранить offline или external copy плана",
  },
  "Assign a plan owner and review schedule": {
    et: "Määra plaani omanik ja ülevaatamise ajakava",
    en: "Assign a plan owner and review schedule",
    ru: "Назначить владельца плана и график review",
  },
  "Add communication, legal, insurance, and regulator contact paths": {
    et: "Lisa kommunikatsiooni, õigusnõustaja, kindlustuse ja regulaatori kontaktiteed",
    en: "Add communication, legal, insurance, and regulator contact paths",
    ru: "Добавить пути связи для communication, legal, insurance и regulator",
  },
  "Test the plan with a simple tabletop exercise": {
    et: "Testi plaani lihtsa läbimänguharjutusega",
    en: "Test the plan with a simple tabletop exercise",
    ru: "Проверить план простым tabletop exercise",
  },
  "Ransomware-specific checklist or appendix": {
    et: "Lunavarale kohandatud kontrollnimekiri või lisa",
    en: "Ransomware-specific checklist or appendix",
    ru: "Ransomware-specific checklist или приложение",
  },
  "Named plan owner": {
    et: "Nimetatud plaani omanik",
    en: "Named plan owner",
    ru: "Назначенный владелец плана",
  },
  "Offline or external copy location": {
    et: "Võrguvälise või välise koopia asukoht",
    en: "Offline or external copy location",
    ru: "Местоположение offline или external copy",
  },
  "Contact and escalation list": {
    et: "Kontaktide ja eskalatsiooni nimekiri",
    en: "Contact and escalation list",
    ru: "Список контактов и escalation",
  },
  "Last review date": {
    et: "Viimase ülevaatuse kuupäev",
    en: "Last review date",
    ru: "Дата последнего review",
  },
  "Last test or exercise record": {
    et: "Viimase testi või harjutuse kirje",
    en: "Last test or exercise record",
    ru: "Запись последнего test или exercise",
  },
  "Tabletop agenda": {
    et: "Läbimänguharjutuse kava",
    en: "Tabletop agenda",
    ru: "Tabletop agenda",
  },
  "Participant list": {
    et: "Osalejate nimekiri",
    en: "Participant list",
    ru: "Список участников",
  },
  "Scenario summary": {
    et: "Stsenaariumi kokkuvõte",
    en: "Scenario summary",
    ru: "Сводка сценария",
  },
  "Decisions and gaps log": {
    et: "Otsuste ja puudujääkide logi",
    en: "Decisions and gaps log",
    ru: "Лог решений и gaps",
  },
  "Action tracker with owners and deadlines": {
    et: "Tegevuste jälgija omanike ja tähtaegadega",
    en: "Action tracker with owners and deadlines",
    ru: "Action tracker с владельцами и сроками",
  },
  "Updated incident response plan": {
    et: "Uuendatud intsidendile reageerimise plaan",
    en: "Updated incident response plan",
    ru: "Обновлённый incident response plan",
  },
  "Date of next planned exercise": {
    et: "Järgmise plaanitud harjutuse kuupäev",
    en: "Date of next planned exercise",
    ru: "Дата следующего planned exercise",
  },
  "Include leadership, IT or MSP, communications, legal, and business process owners": {
    et: "Kaasa juhtkond, IT või MSP, kommunikatsioon, õigusnõustaja ja äriprotsesside omanikud",
    en: "Include leadership, IT or MSP, communications, legal, and business process owners",
    ru: "Включить руководство, IT/MSP, communications, legal и владельцев бизнес-процессов",
  },
  "Record decisions, assumptions, and gaps": {
    et: "Kirjuta üles otsused, eeldused ja puudujäägid",
    en: "Record decisions, assumptions, and gaps",
    ru: "Зафиксировать решения, assumptions и gaps",
  },
  "Assign owners and deadlines for exercise findings": {
    et: "Määra harjutuse leidudele omanikud ja tähtajad",
    en: "Assign owners and deadlines for exercise findings",
    ru: "Назначить владельцев и сроки для exercise findings",
  },
  "Update the response plan after the exercise": {
    et: "Uuenda reageerimisplaani pärast harjutust",
    en: "Update the response plan after the exercise",
    ru: "Обновить response plan после exercise",
  },
  "Repeat the exercise at least annually or after major IT changes": {
    et: "Korda harjutust vähemalt kord aastas või pärast suuri IT-muudatusi",
    en: "Repeat the exercise at least annually or after major IT changes",
    ru: "Повторять exercise минимум ежегодно или после крупных IT changes",
  },
  "Confirm which critical systems are covered by backups": {
    et: "Kinnita, millised kriitilised süsteemid on varukoopiatega kaetud",
    en: "Confirm which critical systems are covered by backups",
    ru: "Подтвердить, какие критичные системы покрыты backup",
  },
  "Configure alerts for failed backup jobs": {
    et: "Seadista hoiatused ebaõnnestunud varundustööde kohta",
    en: "Configure alerts for failed backup jobs",
    ru: "Настроить alerts для failed backup jobs",
  },
  "Keep at least one backup copy offline, immutable, or protected with separate credentials": {
    et: "Hoia vähemalt üht varukoopiat võrguväliselt, muutmiskindlalt või eraldi ligipääsudega kaitstult",
    en: "Keep at least one backup copy offline, immutable, or protected with separate credentials",
    ru: "Хранить хотя бы одну backup copy offline, immutable или с отдельными credentials",
  },
  "Document RTO and RPO expectations for priority systems": {
    et: "Dokumenteeri prioriteetsete süsteemide RTO ja RPO ootused",
    en: "Document RTO and RPO expectations for priority systems",
    ru: "Документировать RTO и RPO ожидания для priority systems",
  },
  "Review backup access rights so normal user or admin compromise does not automatically expose all backups": {
    et: "Vaata üle varukoopiate ligipääsuõigused, et tavalise kasutaja või administraatori konto kompromiteerimine ei avaks kõiki varukoopiaid",
    en: "Review backup access rights so normal user or admin compromise does not automatically expose all backups",
    ru: "Проверить backup access rights, чтобы компрометация обычного или admin пользователя не открывала все backups",
  },
  "List of systems and data included in backups": {
    et: "Varukoopiates sisalduvate süsteemide ja andmete nimekiri",
    en: "List of systems and data included in backups",
    ru: "Список систем и данных, включённых в backups",
  },
  "Last successful backup job results": {
    et: "Viimaste edukate varundustööde tulemused",
    en: "Last successful backup job results",
    ru: "Результаты последних successful backup jobs",
  },
  "Restored system or dataset name": {
    et: "Taastatud süsteemi või andmekogu nimi",
    en: "Restored system or dataset name",
    ru: "Название восстановленной системы или dataset",
  },
  "RTO/RPO result from the restore test": {
    et: "Taastamistesti RTO/RPO tulemus",
    en: "RTO/RPO result from the restore test",
    ru: "RTO/RPO результат restore test",
  },
  "Proof of offline, immutable, or separately protected backup storage": {
    et: "Tõend võrguvälise, muutmiskindla või eraldi kaitstud varukoopiahoidla kohta",
    en: "Proof of offline, immutable, or separately protected backup storage",
    ru: "Доказательство offline, immutable или отдельно защищённого backup storage",
  },
  "Named owner for backup monitoring": {
    et: "Nimetatud varunduse seire omanik",
    en: "Named owner for backup monitoring",
    ru: "Назначенный владелец backup monitoring",
  },
  "Enforce MFA for VPN, RDP gateway, cloud console, email, and other remote access paths": {
    et: "Rakenda MFA VPN-ile, RDP-lüüsile, pilvehaldusele, e-postile ja muudele kaugligipääsudele",
    en: "Enforce MFA for VPN, RDP gateway, cloud console, email, and other remote access paths",
    ru: "Включить MFA для VPN, RDP gateway, cloud console, email и других remote access paths",
  },
  "Remove or disable unused and departed employee accounts": {
    et: "Eemalda või keela kasutamata ja lahkunud töötajate kontod",
    en: "Remove or disable unused and departed employee accounts",
    ru: "Удалить или отключить unused и departed employee accounts",
  },
  "Review shared accounts and replace them with named accounts where practical": {
    et: "Vaata jagatud kontod üle ja asenda need võimalusel nimeliste kontodega",
    en: "Review shared accounts and replace them with named accounts where practical",
    ru: "Проверить shared accounts и заменить named accounts, где возможно",
  },
  "Document and monitor emergency access accounts": {
    et: "Dokumenteeri ja jälgi hädaolukorra ligipääsukontosid",
    en: "Document and monitor emergency access accounts",
    ru: "Документировать и monitor emergency access accounts",
  },
  "Keep a simple access review schedule": {
    et: "Hoia lihtsat ligipääsude ülevaatamise ajakava",
    en: "Keep a simple access review schedule",
    ru: "Вести простой access review schedule",
  },
  "MFA policy or configuration screenshot for admin accounts": {
    et: "Administraatori kontode MFA poliitika või seadistuse kuvatõmmis",
    en: "MFA policy or configuration screenshot for admin accounts",
    ru: "MFA policy или configuration screenshot для admin accounts",
  },
  "List of privileged users": {
    et: "Privilegeeritud kasutajate nimekiri",
    en: "List of privileged users",
    ru: "Список privileged users",
  },
  "Recent account review record": {
    et: "Hiljutise kontode ülevaatuse kirje",
    en: "Recent account review record",
    ru: "Запись recent account review",
  },
  "Offboarding checklist showing account removal": {
    et: "Töölt lahkumise kontrollnimekiri, mis näitab konto eemaldamist",
    en: "Offboarding checklist showing account removal",
    ru: "Offboarding checklist с подтверждением account removal",
  },
  "Emergency access account register": {
    et: "Hädaolukorra ligipääsukontode register",
    en: "Emergency access account register",
    ru: "Реестр emergency access accounts",
  },
  "Assign an owner for endpoint, antivirus, or EDR alert review": {
    et: "Määra seadmete, viirusetõrje või EDR-hoiatuste ülevaatuse omanik",
    en: "Assign an owner for endpoint, antivirus, or EDR alert review",
    ru: "Назначить владельца endpoint, antivirus или EDR alert review",
  },
  "Review failed login monitoring for admin, VPN, email, and cloud accounts": {
    et: "Vaata üle ebaõnnestunud sisselogimiste seire administraatori, VPN-i, e-posti ja pilvekontode jaoks",
    en: "Review failed login monitoring for admin, VPN, email, and cloud accounts",
    ru: "Проверить failed login monitoring для admin, VPN, email и cloud accounts",
  },
  "Define how mass file changes or suspicious encryption-like behavior would be noticed": {
    et: "Määra, kuidas märgatakse massilisi failimuudatusi või kahtlast krüpteerimisele sarnast käitumist",
    en: "Define how mass file changes or suspicious encryption-like behavior would be noticed",
    ru: "Определить, как замечать mass file changes или suspicious encryption-like behavior",
  },
  "Maintain a simple vulnerable or outdated software inventory": {
    et: "Hoia lihtsat haavatava või aegunud tarkvara nimekirja",
    en: "Maintain a simple vulnerable or outdated software inventory",
    ru: "Вести простой inventory vulnerable или outdated software",
  },
  "Document alert escalation into the incident response process": {
    et: "Dokumenteeri hoiatuste eskalatsioon intsidendile reageerimise protsessi",
    en: "Document alert escalation into the incident response process",
    ru: "Документировать alert escalation в incident response process",
  },
  "Endpoint or antivirus alert review process": {
    et: "Seadme- või viirusetõrjehoiatuste ülevaatamise protsess",
    en: "Endpoint or antivirus alert review process",
    ru: "Процесс endpoint или antivirus alert review",
  },
  "Sample alert ticket or triage record": {
    et: "Näidishoiatuse tööpilet või esmase analüüsi kirje",
    en: "Sample alert ticket or triage record",
    ru: "Sample alert ticket или triage record",
  },
  "Failed login monitoring report or dashboard screenshot": {
    et: "Ebaõnnestunud sisselogimiste seire raport või töölaua kuvatõmmis",
    en: "Failed login monitoring report or dashboard screenshot",
    ru: "Failed login monitoring report или dashboard screenshot",
  },
  "File integrity or mass-change alert configuration note": {
    et: "Failitervikluse või massmuudatuste hoiatuse seadistuse märge",
    en: "File integrity or mass-change alert configuration note",
    ru: "File integrity или mass-change alert configuration note",
  },
  "Vulnerability or outdated software inventory": {
    et: "Haavatava või aegunud tarkvara nimekiri",
    en: "Vulnerability or outdated software inventory",
    ru: "Vulnerability или outdated software inventory",
  },
  "Create a short restore priority list for critical systems": {
    et: "Koosta kriitiliste süsteemide lühike taastamisjärjekord",
    en: "Create a short restore priority list for critical systems",
    ru: "Создать short restore priority list для critical systems",
  },
  "Assign owners for recovery decisions and technical restore work": {
    et: "Määra taastamisotsuste ja tehnilise taastamistöö omanikud",
    en: "Assign owners for recovery decisions and technical restore work",
    ru: "Назначить owners для recovery decisions и technical restore work",
  },
  "Record expected restore time and acceptable data loss for each critical system": {
    et: "Kirjuta iga kriitilise süsteemi kohta oodatav taastamisaeg ja lubatav andmekadu",
    en: "Record expected restore time and acceptable data loss for each critical system",
    ru: "Записать expected restore time и acceptable data loss для каждой critical system",
  },
  "Define a simple validation checklist before restored systems return to production": {
    et: "Määra lihtne kontrollnimekiri enne taastatud süsteemide tootmiskasutusse tagastamist",
    en: "Define a simple validation checklist before restored systems return to production",
    ru: "Определить simple validation checklist до возврата restored systems в production",
  },
  "Keep recovery instructions available outside the affected environment": {
    et: "Hoia taastamisjuhised kättesaadavana väljaspool mõjutatud keskkonda",
    en: "Keep recovery instructions available outside the affected environment",
    ru: "Хранить recovery instructions вне affected environment",
  },
  "Critical system restore priority list": {
    et: "Kriitiliste süsteemide taastamisjärjekord",
    en: "Critical system restore priority list",
    ru: "Restore priority list для critical systems",
  },
  "RTO/RPO table": {
    et: "RTO/RPO tabel",
    en: "RTO/RPO table",
    ru: "RTO/RPO таблица",
  },
  "Recovery owner list": {
    et: "Taastamise omanike nimekiri",
    en: "Recovery owner list",
    ru: "Список recovery owners",
  },
  "Restore validation checklist": {
    et: "Taastamise valideerimise kontrollnimekiri",
    en: "Restore validation checklist",
    ru: "Restore validation checklist",
  },
  "Alternate communication method for recovery coordination": {
    et: "Alternatiivne suhtluskanal taastamise koordineerimiseks",
    en: "Alternate communication method for recovery coordination",
    ru: "Alternate communication method для recovery coordination",
  },
  "Notes from the most recent recovery test or walkthrough": {
    et: "Viimase taastamistesti või läbikäigu märkmed",
    en: "Notes from the most recent recovery test or walkthrough",
    ru: "Заметки с последнего recovery test или walkthrough",
  },
  "Assign an owner for patching and patch verification": {
    et: "Määra paikamise ja paikade kontrolli omanik",
    en: "Assign an owner for patching and patch verification",
    ru: "Назначить владельца patching и patch verification",
  },
  "Set a target for critical security updates, such as 14 to 30 days depending on exposure": {
    et: "Sea kriitiliste turvauuenduste sihtajaks näiteks 14-30 päeva sõltuvalt nähtavusest",
    en: "Set a target for critical security updates, such as 14 to 30 days depending on exposure",
    ru: "Задать target для critical security updates, например 14-30 дней в зависимости от exposure",
  },
  "Track failed patches and accepted exceptions": {
    et: "Jälgi ebaõnnestunud paiku ja heaks kiidetud erandeid",
    en: "Track failed patches and accepted exceptions",
    ru: "Отслеживать failed patches и accepted exceptions",
  },
  "Identify unsupported systems and document replacement, isolation, or risk acceptance": {
    et: "Tuvasta toetuseta süsteemid ning dokumenteeri asendamine, isoleerimine või riski aktsepteerimine",
    en: "Identify unsupported systems and document replacement, isolation, or risk acceptance",
    ru: "Определить unsupported systems и документировать replacement, isolation или risk acceptance",
  },
  "Review MSP patch reports if patching is outsourced": {
    et: "Vaata MSP paikamisraportid üle, kui paikamine on sisse ostetud",
    en: "Review MSP patch reports if patching is outsourced",
    ru: "Проверять MSP patch reports, если patching outsourced",
  },
  "Recent patch report": {
    et: "Hiljutine paikamisraport",
    en: "Recent patch report",
    ru: "Недавний patch report",
  },
  "List of internet-facing services": {
    et: "Internetist ligipääsetavate teenuste nimekiri",
    en: "List of internet-facing services",
    ru: "Список internet-facing services",
  },
  "Critical patch timing evidence": {
    et: "Tõend kriitiliste paikade paigaldusaja kohta",
    en: "Critical patch timing evidence",
    ru: "Доказательство critical patch timing",
  },
  "Unsupported systems list": {
    et: "Toetuseta süsteemide nimekiri",
    en: "Unsupported systems list",
    ru: "Список unsupported systems",
  },
  "Exception or risk acceptance log": {
    et: "Erandite või riski aktsepteerimise logi",
    en: "Exception or risk acceptance log",
    ru: "Exception или risk acceptance log",
  },
  "MSP patching report, if applicable": {
    et: "MSP paikamisraport, kui asjakohane",
    en: "MSP patching report, if applicable",
    ru: "MSP patching report, если применимо",
  },
  "Review public remote access services and confirm MFA and patch ownership": {
    et: "Vaata üle avalikud kaugligipääsu teenused ning kinnita MFA ja paikamise omanik",
    en: "Review public remote access services and confirm MFA and patch ownership",
    ru: "Проверить public remote access services и подтвердить MFA и patch ownership",
  },
  "Confirm SPF, DKIM, and DMARC through DNS or email admin tools": {
    et: "Kinnita SPF, DKIM ja DMARC DNS-i või e-posti haldustööriistade kaudu",
    en: "Confirm SPF, DKIM, and DMARC through DNS or email admin tools",
    ru: "Подтвердить SPF, DKIM и DMARC через DNS или email admin tools",
  },
  "Manually review public repositories for secrets and sensitive data": {
    et: "Vaata avalikud koodihoidlad käsitsi üle saladuste ja tundlike andmete osas",
    en: "Manually review public repositories for secrets and sensitive data",
    ru: "Вручную проверить public repositories на secrets и sensitive data",
  },
  "Review public cloud storage and sharing settings in the cloud console": {
    et: "Vaata pilvehaldusest üle avalik pilvesalvestus ja jagamisseaded",
    en: "Review public cloud storage and sharing settings in the cloud console",
    ru: "Проверить public cloud storage и sharing settings в cloud console",
  },
  "Use only approved legal channels for breach exposure checks": {
    et: "Kasuta lekkeriski kontrolliks ainult heaks kiidetud seaduslikke kanaleid",
    en: "Use only approved legal channels for breach exposure checks",
    ru: "Использовать только approved legal channels для breach exposure checks",
  },
  "Public domain and service owner list": {
    et: "Avalike domeenide ja teenuseomanike nimekiri",
    en: "Public domain and service owner list",
    ru: "Список public domain и service owner",
  },
  "Remote access exposure review note": {
    et: "Kaugligipääsu nähtavuse ülevaatuse märge",
    en: "Remote access exposure review note",
    ru: "Remote access exposure review note",
  },
  "SPF, DKIM, and DMARC configuration evidence": {
    et: "SPF, DKIM ja DMARC seadistuse tõend",
    en: "SPF, DKIM, and DMARC configuration evidence",
    ru: "Доказательство SPF, DKIM и DMARC configuration",
  },
  "Public repository review record": {
    et: "Avaliku koodihoidla ülevaatuse kirje",
    en: "Public repository review record",
    ru: "Public repository review record",
  },
  "Cloud storage exposure review record": {
    et: "Pilvesalvestuse nähtavuse ülevaatuse kirje",
    en: "Cloud storage exposure review record",
    ru: "Cloud storage exposure review record",
  },
  "Approved breach exposure check procedure": {
    et: "Heaks kiidetud lekkeriski kontrolli protseduur",
    en: "Approved breach exposure check procedure",
    ru: "Approved breach exposure check procedure",
  },
  "Enable MFA for employee email and important work services": {
    et: "Lülita MFA sisse töötajate e-postile ja olulistele tööteenustele",
    en: "Enable MFA for employee email and important work services",
    ru: "Включить MFA для employee email и important work services",
  },
  "Publish a short phishing reporting path": {
    et: "Avalda lühike õngitsusest teatamise juhis",
    en: "Publish a short phishing reporting path",
    ru: "Опубликовать short phishing reporting path",
  },
  "Confirm operating system and browser updates are enabled for work devices": {
    et: "Kinnita, et tööseadmetel on operatsioonisüsteemi ja brauseri uuendused sisse lülitatud",
    en: "Confirm operating system and browser updates are enabled for work devices",
    ru: "Подтвердить, что OS и browser updates включены для work devices",
  },
  "Store MFA recovery codes in an approved secure location": {
    et: "Hoia MFA taastamiskoode heaks kiidetud turvalises asukohas",
    en: "Store MFA recovery codes in an approved secure location",
    ru: "Хранить MFA recovery codes в approved secure location",
  },
  "Use legal and approved breach-alert channels; never ask employees to share passwords": {
    et: "Kasuta seaduslikke ja heaks kiidetud lekkehoiatuskanaleid; ära palu töötajatel paroole jagada",
    en: "Use legal and approved breach-alert channels; never ask employees to share passwords",
    ru: "Использовать legal и approved breach-alert channels; никогда не просить employees share passwords",
  },
  "Password manager guidance or policy": {
    et: "Paroolihalduri juhis või poliitika",
    en: "Password manager guidance or policy",
    ru: "Password manager guidance или policy",
  },
  "MFA coverage report for employee email and key services": {
    et: "MFA katvuse raport töötajate e-posti ja võtmeteenuste kohta",
    en: "MFA coverage report for employee email and key services",
    ru: "MFA coverage report для employee email и key services",
  },
  "Phishing reporting channel or short awareness note": {
    et: "Õngitsusest teatamise kanal või lühike teadlikkuse märge",
    en: "Phishing reporting channel or short awareness note",
    ru: "Phishing reporting channel или short awareness note",
  },
  "Device update report or MSP confirmation": {
    et: "Seadmete uuenduste raport või MSP kinnitus",
    en: "Device update report or MSP confirmation",
    ru: "Device update report или MSP confirmation",
  },
  "Recovery code storage guidance": {
    et: "Taastamiskoodide hoiustamise juhis",
    en: "Recovery code storage guidance",
    ru: "Recovery code storage guidance",
  },
  "Record of password reset actions after approved breach alerts": {
    et: "Parooli lähtestamise tegevuste kirje pärast heaks kiidetud lekkehoiatusi",
    en: "Record of password reset actions after approved breach alerts",
    ru: "Record password reset actions после approved breach alerts",
  },
  "Remove administrator rights that are not needed for the role": {
    et: "Eemalda administraatoriõigused, mida roll ei vaja",
    en: "Remove administrator rights that are not needed for the role",
    ru: "Удалить administrator rights, которые не нужны для роли",
  },
  "Use separate admin accounts for administration tasks": {
    et: "Kasuta haldustegevusteks eraldi administraatori kontosid",
    en: "Use separate admin accounts for administration tasks",
    ru: "Использовать separate admin accounts для administration tasks",
  },
  "Review third-party access and remove standing access where possible": {
    et: "Vaata kolmandate osapoolte ligipääs üle ja eemalda püsiligipääs, kus võimalik",
    en: "Review third-party access and remove standing access where possible",
    ru: "Проверить third-party access и убрать standing access, где возможно",
  },
  "Schedule recurring privilege reviews": {
    et: "Planeeri korduvad privileegide ülevaatused",
    en: "Schedule recurring privilege reviews",
    ru: "Запланировать recurring privilege reviews",
  },
  "Document who approves new admin rights": {
    et: "Dokumenteeri, kes kinnitab uued administraatoriõigused",
    en: "Document who approves new admin rights",
    ru: "Документировать, кто approves new admin rights",
  },
  "Record of last admin rights review": {
    et: "Viimase administraatoriõiguste ülevaatuse kirje",
    en: "Record of last admin rights review",
    ru: "Запись последнего admin rights review",
  },
  "Approval process for new administrator access": {
    et: "Uue administraatoriligipääsu kinnitamise protsess",
    en: "Approval process for new administrator access",
    ru: "Approval process для new administrator access",
  },
  "Evidence of separate admin accounts": {
    et: "Tõend eraldi administraatori kontode kohta",
    en: "Evidence of separate admin accounts",
    ru: "Доказательство separate admin accounts",
  },
  "Third-party access list": {
    et: "Kolmandate osapoolte ligipääsude nimekiri",
    en: "Third-party access list",
    ru: "Third-party access list",
  },
  "Offboarding or role-change access removal record": {
    et: "Töölt lahkumise või rollimuutuse ligipääsude eemaldamise kirje",
    en: "Offboarding or role-change access removal record",
    ru: "Offboarding или role-change access removal record",
  },
};

const findingText: Record<string, Record<UiLanguage, Partial<FindingCard>>> = {
  finding_restore_capability_unproven: {
    et: {
      title: "Taastamisvõime pole tõendatud",
      business_impact: "Varukoopiad ei pruugi lunavara intsidendi ajal kriitilisi andmeid või süsteeme piisavalt kiiresti taastada.",
      recommended_fix: "Tee dokumenteeritud taastamistest vähemalt ühe kriitilise süsteemi või andmekogumiga.",
      verification: "Taastamistesti kirje koos kuupäeva, ulatuse, tulemuse, probleemide ja RTO/RPO märkmetega.",
    },
    en: {},
    ru: {
      title: "Возможность восстановления не доказана",
      business_impact: "Backup может не восстановить критичные данные или системы достаточно быстро во время ransomware incident.",
      recommended_fix: "Провести документированный restore test минимум для одной критичной системы или набора данных.",
      verification: "Запись restore test с датой, scope, результатом, проблемами и RTO/RPO заметками.",
    },
  },
  finding_admin_mfa_incomplete: {
    et: {
      title: "Admin-kontod ei ole täielikult MFA-ga kaitstud",
      business_impact: "Varastatud administraatori parool võib anda laia ligipääsu süsteemidele ja varukoopiatele.",
      recommended_fix: "Nõua MFA-d kõigile privilegeeritud ja administraatori kontodele, sh MSP ja break-glass ligipääs.",
    },
    en: {},
    ru: {
      title: "Admin-аккаунты не полностью защищены MFA",
      business_impact: "Украденный admin-пароль может дать широкий доступ к системам и backup.",
      recommended_fix: "Требовать MFA для всех privileged и administrator accounts, включая MSP и break-glass доступ.",
    },
  },
  finding_ir_process_not_documented: {
    et: {
      title: "Lunavarale reageerimise protsess pole dokumenteeritud",
      business_impact: "Intsidendi ajal võivad viivitused ja ebaselge vastutus suurendada seisakut, kulusid ja õiguslikku riski.",
      recommended_fix: "Koosta lühike lunavarale reageerimise plaan rollide, kontaktide, eskalatsiooni, ohjeldamise ja kommunikatsiooniga.",
    },
    en: {},
    ru: {
      title: "Ransomware response процесс не документирован",
      business_impact: "Во время инцидента задержки и неясная ответственность могут увеличить downtime, cost и legal risk.",
      recommended_fix: "Создать короткий ransomware response plan с ролями, контактами, escalation, containment и communication steps.",
    },
  },
  finding_detection_monitoring_weak: {
    et: {
      title: "Kahtlast tegevust ei pruugita õigel ajal märgata",
      business_impact: "Lunavara tegevus võib levida enne, kui seadmete, sisselogimiste, failimuudatuste või haavatavuste hoiatused nähtavaks saavad.",
      recommended_fix: "Määra, milliseid logisid ja seadmehoiatusi jälgitakse, kes teeb esmase analüüsi ja kuidas eskaleeritakse.",
    },
    en: {},
    ru: {
      title: "Подозрительная активность может быть замечена слишком поздно",
      business_impact: "Ransomware activity может распространиться до того, как кто-то увидит endpoint, login, file-change или vulnerability alerts.",
      recommended_fix: "Определить, какие logs и endpoint alerts отслеживаются, кто делает triage и как идёт escalation.",
    },
  },
};

const exposureItems: Record<string, Record<UiLanguage, Partial<AdvisoryChecklistItem>>> = {
  public_domains_known: {
    et: {},
    en: { question: "Does the organization know which domains and subdomains are publicly used?" },
    ru: { question: "Организация знает, какие домены и поддомены публично используются?" },
  },
  remote_access_exposure_reviewed: {
    et: {},
    en: { question: "Have internet-accessible remote access services, such as VPN or RDP gateway, been reviewed?" },
    ru: { question: "Проверены ли доступные из интернета remote access сервисы, например VPN или RDP gateway?" },
  },
  email_security_records_known: {
    et: {},
    en: { question: "Have SPF, DKIM, and DMARC settings been checked?" },
    ru: { question: "Проверены ли настройки SPF, DKIM и DMARC?" },
  },
  public_repositories_reviewed: {
    et: {},
    en: { question: "Have public GitHub or other code repositories been reviewed for secrets and sensitive information?" },
    ru: { question: "Проверены ли публичные GitHub или другие code repositories на secrets и sensitive data?" },
  },
  cloud_storage_exposure_reviewed: {
    et: {},
    en: { question: "Have public cloud storage locations or buckets been reviewed?" },
    ru: { question: "Проверены ли публичные cloud storage locations или buckets?" },
  },
  breach_exposure_checked_manually: {
    et: {},
    en: { question: "Is possible breach exposure checked through approved and legal channels?" },
    ru: { question: "Проверяется ли возможная breach exposure через разрешённые и законные каналы?" },
  },
};

export function domainLabel(language: UiLanguage, domain?: string | null): string {
  const key = String(domain || "").toLowerCase();
  return domains[key]?.[language] || String(domain || "-");
}

export function riskLabel(language: UiLanguage, value?: RiskLevel | string | null): string {
  const key = String(value || "").toLowerCase();
  return riskLabels[key]?.[language] || valueOrDash(value);
}

export function valueLabel(language: UiLanguage, value?: string | number | null): string {
  const key = String(value || "").toLowerCase();
  return simpleValueLabels[key]?.[language] || valueOrDash(value);
}

export function effortLabel(language: UiLanguage, value?: string | null): string {
  const key = `${String(value || "").toLowerCase()}effort`;
  return simpleValueLabels[key]?.[language] || valueLabel(language, value);
}

export function skillTitle(language: UiLanguage, skill?: SkillReference | { id?: string; title?: string }): string {
  const id = String(skill?.id || "");
  return skillTitles[id]?.[language] || knownText[String(skill?.title || "")]?.[language] || String(skill?.title || skill?.id || "-");
}

export function localizeKnownText(language: UiLanguage, value?: string | null): string {
  const clean = String(value || "").trim().replace(/[.;:]$/, "");
  return knownText[clean]?.[language] || String(value || "");
}

export function localizedDomainRisk(language: UiLanguage, domain?: string | null, fallback?: string | null): string {
  const key = String(domain || "").toLowerCase();
  return domainRiskText[key]?.[language] || localizeKnownText(language, fallback);
}

export function localizedFinding(language: UiLanguage, finding: FindingCard): FindingCard {
  const override = findingText[String(finding.id || "")]?.[language] || {};
  return { ...finding, ...override };
}

export function localizedExposureQuestion(language: UiLanguage, item: AdvisoryChecklistItem): string {
  return exposureItems[String(item.id || "")]?.[language]?.question || item.question || String(item.id || "");
}

export function localizedSummary(language: UiLanguage, score?: number, risk?: RiskLevel | string, completion?: number): string {
  const safeScore = score ?? 0;
  const safeCompletion = completion ?? 0;
  if (language === "ru") {
    return `Оценка готовности к ransomware: ${safeScore}/100. Уровень риска: ${riskLabel(language, risk)}. Заполнено: ${safeCompletion}%. Числовой score считается backend-правилами, а confidence и рекомендации не меняют score.`;
  }
  if (language === "en") {
    return `Ransomware readiness score: ${safeScore}/100. Risk level: ${riskLabel(language, risk)}. Completion: ${safeCompletion}%. The numeric score is calculated by backend rules; confidence and recommendations do not change the score.`;
  }
  return `Organisatsiooni lunavararünnakuks valmisoleku tulemus on ${safeScore}/100. Riskitase: ${riskLabel(language, risk)}. Täidetud: ${safeCompletion}%. Numbriline tulemus arvutatakse taustsüsteemi reeglitega; usaldusväärsus ja soovitused tulemust ei muuda.`;
}

function valueOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}
