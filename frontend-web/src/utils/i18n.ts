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
    backendStatus: "Backendi olek",
    providerStatus: "Teenusepakkuja",
    fallbackMode: "Fallback režiim",
    online: "sees",
    offline: "väljas",
    readinessReport: "Valmisoleku raport",
    officialScoreBackend: "Ametlik skoor ja riskitase tulevad FastAPI backendist.",
    refreshReport: "Värskenda raportit",
    generateReport: "Koosta raport",
    noReportLoaded: "Raportit pole laaditud",
    noReportDescription: "Raporti saab koostada praeguse backend-sessiooni põhjal.",
    overallScore: "Üldskoor",
    riskLevel: "Riskitase",
    completion: "Täidetud",
    confidence: "Usaldusväärsus",
    separateFromScore: "Eraldi skoorist",
    domainScores: "Domeenide skoorid",
    findings: "Leiud",
    topRisks: "Peamised riskid",
    nextSteps: "Järgmised sammud",
    externalExposure: "Välise nähtavuse enesekontroll",
    advisoryOnly: "nõuandev",
    noScanning: "skaneerimist ei tehta",
    actionPlanDescription: "Backendi raportist tulnud prioriseeritud parandustegevused.",
    noActionPlanTitle: "Tegevusplaani pole veel",
    noActionPlanDescription: "Lõpeta intervjuu või laadi demo profiil, et näha prioriseeritud tegevusi.",
    next48Hours: "Järgmised 48 tundi",
    next14Days: "Järgmised 14 päeva",
    next30Days: "Järgmised 30 päeva",
    owner: "Omanik",
    effort: "Pingutus",
    deadline: "Tähtaeg",
    priority: "Prioriteet",
    evidenceBinderDescription: "Tõendid on grupeeritud domeenide järgi. Need toetavad auditivalmidust, kuid ei arvuta skoori.",
    backendChecklist: "backendi checklist",
    placeholderChecklist: "näidis-checklist",
    skillsDescription: "Kaitsvad oskused ja playbook'id toetavad selgitusi ja tegevusplaane.",
    skillsMatchedDescription: "Backendi raportiga sobitatud kaitsvad oskused.",
    skillsNotLoaded: "Oskuste kiht pole veel laaditud",
    skillsNotLoadedDescription: "Oskused toetavad selgitusi, tegevusplaane ja tõendisoovitusi. Need ei arvuta numbrilist skoori.",
    technical: "Tehniline vaade",
    technicalDescription: "Teenusepakkuja olek, struktureeritud backend-olek ja debug-andmed.",
    providerAndGuardrails: "Teenusepakkuja ja kaitsepiirded",
    backend: "Backend",
    redaction: "Redigeerimine",
    promptInjection: "Prompt injection",
    notReported: "ei raporteeritud",
    notApplied: "ei rakendatud",
    applied: "rakendatud",
    blocked: "blokeeritud",
    notTriggered: "ei käivitunud",
    structuredAnswers: "Struktureeritud vastused",
    noValidatedAnswers: "Valideeritud struktureeritud vastuseid veel ei ole.",
    backendSourceOfTruth: "Backend on tõeallikas",
    backendSourceText: "React kuvab ainult backend-olekut. FastAPI omab küsimusi, vastuseid, skoori, raporteid, oskusi ja tõendeid.",
    technicalTrace: "Tehniline jälg",
    workflow: "Töövoog",
    questionSource: "Küsimuste allikas",
    llmRole: "LLM-i roll",
    backendValidation: "Backendi valideerimine",
    ruleScoring: "Reeglipõhine skoor",
    sensitiveData: "Tundlikud andmed",
    debugTechnicalData: "Debug tehnilised andmed",
    defensiveOnly: "ainult kaitsev",
    rawTraceTitle: "Tehniline jälg",
    rawTraceText: "Toored tehnilised andmed hoitakse tavavestlusest eraldi. Ava debug ainult siis, kui vajad integratsiooni detaile.",
    debugJson: "Debug JSON",
    noTechnicalTrace: "Tehnilist jälge pole veel",
    noTechnicalTraceDescription: "Debug payload'id ilmuvad siia pärast seda, kui UI on backendiga suhelnud.",
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
  },
} as const;

export type TranslationKey = keyof typeof labels.et;

export function t(language: UiLanguage, key: TranslationKey): string {
  return labels[language][key] || labels.et[key];
}

const domains: Record<string, Record<UiLanguage, string>> = {
  backups: { et: "Varukoopiad ja taastamine", en: "Backups and restore", ru: "Резервные копии и восстановление" },
  mfa_access: { et: "MFA ja ligipääsud", en: "MFA and access", ru: "MFA и доступы" },
  mfa: { et: "MFA ja ligipääsud", en: "MFA and access", ru: "MFA и доступы" },
  patching: { et: "Patchimine ja haavatavused", en: "Patching and vulnerabilities", ru: "Патчи и уязвимости" },
  admin_rights: { et: "Administraatoriõigused", en: "Administrator rights", ru: "Права администратора" },
  incident_response: { et: "Incident response", en: "Incident response", ru: "Incident response" },
  detection_monitoring: { et: "Tuvastus ja monitooring", en: "Detection and monitoring", ru: "Обнаружение и мониторинг" },
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
};

const skillTitles: Record<string, Record<UiLanguage, string>> = {
  "ransomware-backup-strategy": { et: "Lunavara varundus- ja taastamisvalmidus", en: "Ransomware backup and restore readiness", ru: "Готовность backup и восстановления при ransomware" },
  "ransomware-recovery": { et: "Lunavara taastamise planeerimine", en: "Ransomware recovery planning", ru: "Планирование восстановления после ransomware" },
  "mfa-access-control": { et: "MFA ja ligipääsukontrolli valmidus", en: "MFA and access control readiness", ru: "Готовность MFA и контроля доступа" },
  "patch-management": { et: "Patchimise ja haavatavuste haldus", en: "Patch and vulnerability management readiness", ru: "Готовность patch и vulnerability management" },
  "admin-rights-review": { et: "Administraatoriõiguste ülevaatus", en: "Administrator rights and privilege review", ru: "Проверка admin и privilege прав" },
  "incident-response-plan": { et: "Incident response plaani valmidus", en: "Incident response plan readiness", ru: "Готовность incident response plan" },
  "ransomware-response": { et: "Kaitsev lunavara response valmidus", en: "Defensive ransomware response readiness", ru: "Defensive готовность response при ransomware" },
  "tabletop-exercise": { et: "Lunavara tabletop-harjutuse valmidus", en: "Ransomware tabletop exercise readiness", ru: "Готовность ransomware tabletop exercise" },
  "detection-monitoring": { et: "Tuvastuse ja monitooringu valmidus", en: "Detection and monitoring readiness", ru: "Готовность обнаружения и мониторинга" },
  "employee-security-hygiene": { et: "Töötajate turvahügieeni checklist", en: "Employee security hygiene checklist", ru: "Checklist гигиены безопасности сотрудников" },
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
    et: "Koosta või uuenda lühike incident response plaan",
    en: "Create or update a short incident response plan",
    ru: "Создать или обновить короткий incident response plan",
  },
  "Run a 60 to 90 minute ransomware tabletop exercise": {
    et: "Tee 60-90 minutiline lunavara tabletop-harjutus",
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
    et: "Varunduspoliitika või backup jobide ajakava",
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
    et: "Patchimise protsess või vastutusmaatriks",
    en: "Patch management process or responsibility matrix",
    ru: "Процесс patch management или матрица ответственности",
  },
  "Current privileged user list": {
    et: "Praegune privilegeeritud kasutajate nimekiri",
    en: "Current privileged user list",
    ru: "Текущий список привилегированных пользователей",
  },
  "Incident response plan document": {
    et: "Incident response plaani dokument",
    en: "Incident response plan document",
    ru: "Документ incident response plan",
  },
  "List of critical log sources and retention period": {
    et: "Kriitiliste logiallikate nimekiri ja säilitusaeg",
    en: "List of critical log sources and retention period",
    ru: "Список критичных log sources и срок хранения",
  },
};

const findingText: Record<string, Record<UiLanguage, Partial<FindingCard>>> = {
  finding_restore_capability_unproven: {
    et: {
      title: "Taastamisvõime pole tõendatud",
      business_impact: "Varukoopiad ei pruugi lunavara intsidendi ajal kriitilisi andmeid või süsteeme piisavalt kiiresti taastada.",
      recommended_fix: "Tee dokumenteeritud restore test vähemalt ühe kriitilise süsteemi või andmekogumiga.",
      verification: "Restore testi kirje koos kuupäeva, ulatuse, tulemuse, probleemide ja RTO/RPO märkmetega.",
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
      title: "Lunavara response protsess pole dokumenteeritud",
      business_impact: "Intsidendi ajal võivad viivitused ja ebaselge vastutus suurendada seisakut, kulusid ja õiguslikku riski.",
      recommended_fix: "Koosta lühike lunavara response plaan rollide, kontaktide, eskalatsiooni, containment'i ja kommunikatsiooniga.",
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
      business_impact: "Lunavara tegevus võib levida enne, kui endpoint, login, file-change või vulnerability hoiatused nähtavaks saavad.",
      recommended_fix: "Määra, milliseid logisid ja endpoint-hoiatusi jälgitakse, kes triage'i teeb ja kuidas eskaleeritakse.",
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
  return `Organisatsiooni lunavararünnakuks valmisoleku skoor on ${safeScore}/100. Riskitase: ${riskLabel(language, risk)}. Täidetud: ${safeCompletion}%. Numbriline skoor arvutatakse backendi reeglitega; confidence ja soovitused skoori ei muuda.`;
}

function valueOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}
