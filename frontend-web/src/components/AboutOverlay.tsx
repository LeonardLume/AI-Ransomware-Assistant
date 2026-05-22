import { useMemo, useRef } from "react";
import {
  ArrowRight,
  Calculator,
  Gauge,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import type { UiLanguage } from "../utils/i18n";

type AboutOverlayProps = {
  open: boolean;
  onClose: () => void;
  onStart?: () => void;
  language?: UiLanguage;
};

type CardCopy = {
  title: string;
  description: string;
};

type DomainCopy = {
  name: string;
  questions: string;
  maxPoints: string;
};

type WeightExampleCopy = {
  label: string;
  values: string;
};

type RiskBandCopy = {
  label: string;
  range: string;
};

type OverlayCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cards: CardCopy[];
  scoringTitle: string;
  scoringIntro: string;
  formulasTitle: string;
  formulas: string[];
  answerMappingTitle: string;
  answerMapping: string;
  domainTitle: string;
  domains: DomainCopy[];
  weightsTitle: string;
  weightsIntro: string;
  weights: WeightExampleCopy[];
  optionalNote: string;
  riskTitle: string;
  riskBands: RiskBandCopy[];
  howTitle: string;
  howBody: string;
  steps: string[];
  previewInterview: string;
  previewScore: string;
  previewActionPlan: string;
  startCta: string;
  closeCta: string;
};

const copyByLanguage: Record<UiLanguage, OverlayCopy> = {
  en: {
    eyebrow: "About the assessment",
    title: "Ransomware readiness, explained simply.",
    subtitle:
      "Answer a short guided interview. The assistant helps explain each question, while the backend calculates the official readiness score from fixed rules.",
    cards: [
      {
        title: "Guided interview",
        description:
          "Answer practical questions about backups, MFA, patching, admin access, incident response and monitoring.",
      },
      {
        title: "Rule-based scoring",
        description:
          "Saved answers map to fixed backend scoring rules. AI helps with wording, not with points.",
      },
      {
        title: "Practical report",
        description:
          "Review your readiness score, the weakest areas and concrete next actions to discuss with management or IT.",
      },
    ],
    scoringTitle: "How the backend calculates score",
    scoringIntro:
      "The official score is deterministic. Every saved Yes / Partial / No / Unsure answer maps to a predefined rule in the backend.",
    formulasTitle: "Core formulas",
    formulas: [
      "Domain score = round((earned domain points / max domain points) * 100)",
      "Overall score = round((sum of 6 scored domain percentages) / 6)",
      "Completion rate = round((answered required questions / 27) * 100)",
      "Yes = full rule points, Partial = reduced fixed points, No = 0, Unsure = 0",
    ],
    answerMappingTitle: "Risk thresholds",
    answerMapping:
      "80-100 = Low risk, 60-79 = Medium risk, 40-59 = High risk, 0-39 = Critical risk.",
    domainTitle: "Scored domains and maximum raw points",
    domains: [
      { name: "Backups & recovery", questions: "5 questions", maxPoints: "100 max points" },
      { name: "MFA & access", questions: "4 questions", maxPoints: "100 max points" },
      { name: "Patching", questions: "4 questions", maxPoints: "100 max points" },
      { name: "Admin rights", questions: "4 questions", maxPoints: "100 max points" },
      { name: "Incident response", questions: "5 questions", maxPoints: "120 max points" },
      { name: "Detection & monitoring", questions: "5 questions", maxPoints: "100 max points" },
    ],
    weightsTitle: "Examples of question weight",
    weightsIntro:
      "These are fixed backend answer mappings in the format Yes / Partial / No / Unsure.",
    weights: [
      {
        label: "Highest weight",
        values:
          "Restore tested, admin MFA, remote access MFA, critical patches in 30 days = 30 / 15 / 0 / 0",
      },
      {
        label: "High weight",
        values:
          "Isolated backup, least privilege, IR plan, centralized logs = 25 / 12 / 0 / 0",
      },
      {
        label: "Medium weight",
        values:
          "Backups exist, unsupported systems known, failed logins monitored = 20 / 10 / 0 / 0",
      },
      {
        label: "Lower weight",
        values:
          "Backup frequency, unused accounts, file change alerts = 15 / 8 / 0 / 0",
      },
    ],
    optionalNote:
      "Optional employee security hygiene checks are visible in the product, but they do not change the official readiness score.",
    riskTitle: "What the number means",
    riskBands: [
      { label: "Low", range: "80-100" },
      { label: "Medium", range: "60-79" },
      { label: "High", range: "40-59" },
      { label: "Critical", range: "0-39" },
    ],
    howTitle: "How to use it",
    howBody:
      "Start the assessment, answer honestly, ask for clarification when needed, then review your score and action plan.",
    steps: [
      "Start the assessment",
      "Answer with Yes / Partial / No / Unsure",
      "Review score, weak areas and recommended actions",
    ],
    previewInterview: "Interview flow",
    previewScore: "Score breakdown",
    previewActionPlan: "Action plan",
    startCta: "Start assessment",
    closeCta: "Close",
  },
  et: {
    eyebrow: "Projektist lühidalt",
    title: "Lunavara valmisolek, lihtsalt selgitatud.",
    subtitle:
      "Vasta lühikesele juhendatud intervjuule. Assistent aitab küsimusi mõista, kuid ametliku readiness-skoori arvutab backend kindlate reeglite järgi.",
    cards: [
      {
        title: "Juhendatud intervjuu",
        description:
          "Praktilised küsimused varukoopiate, MFA, uuenduste, admin-õiguste, incident response'i ja monitooringu kohta.",
      },
      {
        title: "Reeglipõhine skoor",
        description:
          "Salvestatud vastused seotakse backend'is kindlate punktireeglitega. AI aitab sõnastusega, mitte punktidega.",
      },
      {
        title: "Praktiline raport",
        description:
          "Näed readiness-skoori, nõrgemaid valdkondi ja järgmisi tegevusi, mida saab arutada juhtkonna või IT-ga.",
      },
    ],
    scoringTitle: "Kuidas backend skoori arvutab",
    scoringIntro:
      "Ametlik skoor on deterministlik. Iga salvestatud Jah / Osaliselt / Ei / Ei tea vastus seotakse backend'is etteantud reegliga.",
    formulasTitle: "Põhivalemid",
    formulas: [
      "Domeeni skoor = round((teenitud domeenipunktid / domeeni maksimum) * 100)",
      "Üldskoor = round((6 hinnatava domeeni protsentide summa) / 6)",
      "Täitumus = round((vastatud kohustuslikud küsimused / 27) * 100)",
      "Jah = täispunktid, Osaliselt = vähendatud fikseeritud punktid, Ei = 0, Ei tea = 0",
    ],
    answerMappingTitle: "Riskitaseme piirid",
    answerMapping:
      "80-100 = Low risk, 60-79 = Medium risk, 40-59 = High risk, 0-39 = Critical risk.",
    domainTitle: "Hinnatavad domeenid ja toorpunktide maksimum",
    domains: [
      { name: "Varukoopiad ja taastamine", questions: "5 küsimust", maxPoints: "100 max punkti" },
      { name: "MFA ja ligipääs", questions: "4 küsimust", maxPoints: "100 max punkti" },
      { name: "Patchimine", questions: "4 küsimust", maxPoints: "100 max punkti" },
      { name: "Administraatoriõigused", questions: "4 küsimust", maxPoints: "100 max punkti" },
      { name: "Incident response", questions: "5 küsimust", maxPoints: "120 max punkti" },
      { name: "Tuvastus ja monitooring", questions: "5 küsimust", maxPoints: "100 max punkti" },
    ],
    weightsTitle: "Näited küsimuste kaalust",
    weightsIntro:
      "Need on fikseeritud backend'i vastuskaardistused kujul Jah / Osaliselt / Ei / Ei tea.",
    weights: [
      {
        label: "Suurim kaal",
        values:
          "Taastamine testitud, admin MFA, kaugligipääsu MFA, kriitilised paigad 30 päevaga = 30 / 15 / 0 / 0",
      },
      {
        label: "Kõrge kaal",
        values:
          "Eraldatud backup, least privilege, IR-plaan, logide tsentraliseerimine = 25 / 12 / 0 / 0",
      },
      {
        label: "Keskmine kaal",
        values:
          "Varukoopiad olemas, vananenud süsteemid teada, ebaõnnestunud loginit jälgitakse = 20 / 10 / 0 / 0",
      },
      {
        label: "Madalam kaal",
        values:
          "Backupi sagedus, kasutamata kontod, failimuutuste hoiatused = 15 / 8 / 0 / 0",
      },
    ],
    optionalNote:
      "Töötajate turvahügieeni küsimused võivad rakenduses nähtavad olla, kuid need ei mõjuta ametlikku readiness-skoori.",
    riskTitle: "Mida number tähendab",
    riskBands: [
      { label: "Low", range: "80-100" },
      { label: "Medium", range: "60-79" },
      { label: "High", range: "40-59" },
      { label: "Critical", range: "0-39" },
    ],
    howTitle: "Kuidas kasutada",
    howBody:
      "Alusta hindamist, vasta ausalt, küsi vajadusel selgitust ja vaata seejärel skoori ning tegevusplaani.",
    steps: [
      "Alusta hindamist",
      "Vasta: Jah / Osaliselt / Ei / Ei tea",
      "Vaata skoori, nõrku kohti ja soovitatud tegevusi",
    ],
    previewInterview: "Intervjuu voog",
    previewScore: "Skoori jaotus",
    previewActionPlan: "Tegevusplaan",
    startCta: "Alusta hindamist",
    closeCta: "Sulge",
  },
  ru: {
    eyebrow: "О проекте",
    title: "Готовность к ransomware — простыми словами.",
    subtitle:
      "Ответьте на короткое интервью. Ассистент помогает понять вопросы, а официальный readiness score считает backend по фиксированным правилам.",
    cards: [
      {
        title: "Пошаговое интервью",
        description:
          "Практические вопросы про backup, MFA, обновления, admin-доступы, incident response и мониторинг.",
      },
      {
        title: "Score по правилам",
        description:
          "Сохранённые ответы переводятся в баллы по правилам backend. AI помогает с пояснениями, но не придумывает points.",
      },
      {
        title: "Практический отчёт",
        description:
          "Вы видите readiness score, слабые зоны и конкретные следующие шаги для разговора с руководством или IT.",
      },
    ],
    scoringTitle: "Как backend считает score",
    scoringIntro:
      "Официальный score детерминирован. Каждый сохранённый ответ Да / Частично / Нет / Не знаю связывается с заранее заданным правилом в backend.",
    formulasTitle: "Основные формулы",
    formulas: [
      "Score домена = round((набранные баллы домена / максимум домена) * 100)",
      "Общий score = round((сумма процентов по 6 оцениваемым доменам) / 6)",
      "Completion rate = round((отвеченные обязательные вопросы / 27) * 100)",
      "Да = полный вес вопроса, Частично = уменьшенный фиксированный вес, Нет = 0, Не знаю = 0",
    ],
    answerMappingTitle: "Пороги риска",
    answerMapping:
      "80-100 = Low risk, 60-79 = Medium risk, 40-59 = High risk, 0-39 = Critical risk.",
    domainTitle: "Оцениваемые домены и максимум сырых баллов",
    domains: [
      { name: "Backup и восстановление", questions: "5 вопросов", maxPoints: "100 max points" },
      { name: "MFA и доступ", questions: "4 вопроса", maxPoints: "100 max points" },
      { name: "Патчи и уязвимости", questions: "4 вопроса", maxPoints: "100 max points" },
      { name: "Admin-права", questions: "4 вопроса", maxPoints: "100 max points" },
      { name: "Incident response", questions: "5 вопросов", maxPoints: "120 max points" },
      { name: "Мониторинг и детектирование", questions: "5 вопросов", maxPoints: "100 max points" },
    ],
    weightsTitle: "Примеры веса вопросов",
    weightsIntro:
      "Это фиксированные backend-mappings ответов в формате Да / Частично / Нет / Не знаю.",
    weights: [
      {
        label: "Самый высокий вес",
        values:
          "Тест восстановления, MFA для admin, MFA для remote access, critical patches за 30 дней = 30 / 15 / 0 / 0",
      },
      {
        label: "Высокий вес",
        values:
          "Изолированный backup, least privilege, IR plan, централизованные логи = 25 / 12 / 0 / 0",
      },
      {
        label: "Средний вес",
        values:
          "Backup существует, известны unsupported systems, мониторятся failed logins = 20 / 10 / 0 / 0",
      },
      {
        label: "Ниже среднего",
        values:
          "Частота backup, удаление неиспользуемых аккаунтов, file change alerts = 15 / 8 / 0 / 0",
      },
    ],
    optionalNote:
      "Проверки employee security hygiene могут быть видны в продукте, но они не меняют официальный readiness score.",
    riskTitle: "Что означает число",
    riskBands: [
      { label: "Low", range: "80-100" },
      { label: "Medium", range: "60-79" },
      { label: "High", range: "40-59" },
      { label: "Critical", range: "0-39" },
    ],
    howTitle: "Как использовать",
    howBody:
      "Начните assessment, отвечайте честно, задавайте уточняющие вопросы и затем смотрите score и план действий.",
    steps: [
      "Начните assessment",
      "Отвечайте: Да / Частично / Нет / Не знаю",
      "Посмотрите score, слабые зоны и рекомендации",
    ],
    previewInterview: "Interview flow",
    previewScore: "Score breakdown",
    previewActionPlan: "Action plan",
    startCta: "Start assessment",
    closeCta: "Close",
  },
};

const featureIcons = [Target, Calculator, Sparkles];
const riskBandStyles = [
  "border-emerald-400/18 bg-emerald-400/10 text-emerald-50",
  "border-sky-400/18 bg-sky-400/10 text-sky-50",
  "border-amber-400/18 bg-amber-400/12 text-amber-50",
  "border-rose-400/18 bg-rose-400/12 text-rose-50",
];

function ShowcasePreview({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] shadow-[0_24px_70px_rgba(2,6,23,0.34)]">
      <div className="border-b border-white/8 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/72">
        {label}
      </div>
      <div className="bg-[#0a0f18] p-4 sm:p-5">{children}</div>
    </div>
  );
}

function InterviewPreview() {
  return (
    <div className="rounded-[22px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(72,108,196,0.18),transparent_38%),linear-gradient(180deg,#0d1424_0%,#0b1120_100%)] p-4">
      <div className="flex justify-end">
        <div className="rounded-2xl border border-sky-300/16 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white">
          yes
        </div>
      </div>
      <div className="mt-4 max-w-[80%] rounded-[20px] border border-sky-300/16 bg-[#121b30] px-4 py-4 text-sm leading-7 text-white/92">
        <p>Salvestatud.</p>
        <p className="mt-3">Järgmine küsimus: Kas varukoopiatest taastamist on viimase 6 kuu jooksul testitud?</p>
      </div>
      <div className="mt-6 flex justify-end">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white">
          miks just 6 kuu jooksul
        </div>
      </div>
      <div className="mt-7 max-w-[80%] rounded-[22px] border border-sky-300/14 bg-[#111a2e] px-4 py-4 text-sm leading-7 text-white/84">
        <p>6 kuud kasutatakse kui praktilist “värskuse kontrolli”...</p>
        <p className="mt-3">Miks see oluline on: aja jooksul muutuvad süsteemid, õigused, failistruktuurid ja inimesed.</p>
        <p className="mt-3">Kui oled valmis, vasta: yes, partial, no või unsure.</p>
      </div>
    </div>
  );
}

function ScorePreview() {
  return (
    <div className="rounded-[22px] border border-white/8 bg-[radial-gradient(circle_at_20%_0%,rgba(245,158,11,0.08),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,#0b1015_0%,#10171c_100%)] p-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/70">Peamine risk</p>
            <p className="mt-2 text-2xl font-semibold text-white">Incident response</p>
            <p className="mt-1 text-sm text-white/46">Incident response</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Prioriteetne tegevus</p>
            <p className="mt-2 text-2xl font-semibold leading-tight text-white">Run a 60 to 90 minute ransomware tabletop exercise</p>
            <p className="mt-1 text-sm text-white/46">Incident response</p>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/46">Ametlik skoor</p>
            <div className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white/76">
              Keskmine
            </div>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <span className="text-6xl font-semibold text-white">75</span>
            <span className="pb-2 text-2xl font-semibold text-white/60">/ 100</span>
          </div>
          <div className="mt-5 h-4 rounded-full border border-white/10 bg-white/[0.06] p-0.5">
            <div className="h-full w-[74%] rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#facc15_52%,#f8fafc_100%)]" />
          </div>
          <div className="mt-3 flex justify-between text-xs font-medium text-white/46">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
          <p className="mt-5 text-sm text-white/52">Strong readiness signal</p>
        </div>
      </div>
      <div className="mt-4 grid gap-0 overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.03] sm:grid-cols-3">
        {[
          ["Skoor", "75/100", "Backendi arvutus"],
          ["Risk", "Keskmine", "Backendi riskitase"],
          ["Täidetud", "100%", "Vastatud 27/27"],
        ].map(([label, value, hint]) => (
          <div key={label} className="border-b border-white/8 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/44">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
            <p className="mt-1 text-sm text-white/46">{hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionPlanPreview() {
  const columns = [
    {
      title: "Järgmised 48 tundi",
      cards: [
        ["Kõrge", "Incident response", "Tee 60-90 minutiline lunavara tabletop-harjutus"],
        ["Kõrge", "Incident response", "Koosta või uuenda lühike incident response plaan"],
      ],
    },
    {
      title: "Järgmised 14 päeva",
      cards: [
        ["Keskmine", "Tuvastus ja monitooring", "Määra kriitilised logid, mida tuleb lunavara uurimiseks säilitada"],
        ["Keskmine", "Administraatoriõigused", "Ekspordi ja vaata üle privilegeeritud kontode nimekiri"],
      ],
    },
    {
      title: "Järgmised 30 päeva",
      cards: [
        ["Madal", "Töötajate turvahügieen", "Lülitage MFA sisse e-posti ja oluliste tööteenuste jaoks kõigile töötajatele"],
        ["Madal", "Töötajate turvahügieen", "Andke töötajatele lühike juhis kahtlaste kirjade tuvastamiseks ja teavitamiseks"],
      ],
    },
  ];

  return (
    <div className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,#0a0d12_0%,#0d1117_100%)] p-4">
      <div>
        <p className="text-3xl font-semibold text-white">Tegevusplaan</p>
        <p className="mt-2 text-sm text-white/46">Backendi raportist tulnud prioriseeritud parandustegevused.</p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <div key={column.title} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-lg font-semibold text-white">{column.title}</p>
            <div className="mt-4 space-y-3">
              {column.cards.map(([priority, domain, text]) => (
                <div key={text} className="rounded-[18px] border border-white/10 bg-black/[0.16] p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-50">
                      {priority}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white/70">
                      {domain}
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-semibold leading-8 text-white">{text}</p>
                  <div className="mt-4 grid gap-2 text-sm text-white/44">
                    <p>Omanik: Management / IT / MSP</p>
                    <p>Tähtaeg: 30 päeva</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AboutOverlay({
  open,
  onClose,
  onStart,
  language = "en",
}: AboutOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const copy = useMemo(() => copyByLanguage[language] || copyByLanguage.en, [language]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        hideClose
        aria-describedby="about-overlay-description"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeButtonRef.current?.focus();
        }}
        className="w-[min(96vw,78rem)] overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(10,14,22,0.96),rgba(7,10,17,0.92))] p-0 text-left text-white shadow-[0_40px_140px_rgba(2,6,23,0.76)] backdrop-blur-2xl data-[state=open]:scale-100 data-[state=closed]:scale-[0.975]"
      >
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>
        <DialogDescription id="about-overlay-description" className="sr-only">
          {copy.subtitle}
        </DialogDescription>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={copy.closeCta}
          className="absolute right-5 top-5 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/72 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(168,85,247,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_38%)]" />

        <div className="relative max-h-[90vh] overflow-y-auto px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/82">
            {copy.eyebrow}
          </div>

          <div className="mt-5 max-w-4xl">
            <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-[3rem]">
              {copy.title}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72 sm:text-base">
              {copy.subtitle}
            </p>
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <section className="rounded-[26px] border border-white/10 bg-white/[0.03] px-5 py-5 sm:px-6">
              <div className="space-y-5">
                {copy.cards.map((card, index) => {
                  const Icon = featureIcons[index] || Sparkles;
                  return (
                    <div key={card.title} className="flex items-start gap-4">
                      <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-white/66">{card.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            <ShowcasePreview label={copy.previewInterview}>
              <InterviewPreview />
            </ShowcasePreview>
            </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-cyan-100">
                  <Calculator className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{copy.scoringTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-white/72">{copy.scoringIntro}</p>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-white/10 bg-black/[0.24] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                  {copy.formulasTitle}
                </p>
                <div className="mt-3 divide-y divide-white/8 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                  {copy.formulas.map((line) => (
                    <div key={line} className="px-3 py-3 font-mono text-[12px] leading-5 text-white/78 sm:text-[13px]">
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">{copy.answerMappingTitle}</p>
                <p className="mt-2 text-sm leading-6 text-white/70">{copy.answerMapping}</p>
              </div>

              <div className="mt-5">
                <ShowcasePreview label={copy.previewScore}>
                  <ScorePreview />
                </ShowcasePreview>
              </div>
            </section>

            <section className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-cyan-100">
                  <Gauge className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{copy.riskTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-white/72">{copy.howBody}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                {copy.riskBands.map((band, index) => (
                  <div
                    key={band.label}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${riskBandStyles[index] || riskBandStyles[0]}`}
                  >
                    <span className="font-semibold">{band.label}</span>
                    <span className="font-mono text-xs sm:text-sm">{band.range}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[22px] border border-white/10 bg-black/[0.2] p-4">
                <p className="text-sm font-semibold text-white">{copy.howTitle}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {copy.steps.map((step, index) => (
                    <div
                      key={step}
                      className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3 py-3"
                    >
                      <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/18 bg-cyan-300/10 text-xs font-semibold text-cyan-100">
                        {index + 1}
                      </div>
                      <p className="pt-0.5 text-sm text-white/74">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <section className="mt-8 rounded-[26px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <section>
              <p className="text-base font-semibold text-white">{copy.domainTitle}</p>
              <div className="mt-4 overflow-hidden rounded-[22px] border border-white/[0.08] bg-black/[0.16]">
                {copy.domains.map((domain) => (
                  <div
                    key={domain.name}
                    className="grid gap-1 border-b border-white/[0.08] px-4 py-3 last:border-b-0 sm:grid-cols-[1.35fr_0.7fr_0.7fr] sm:items-center"
                  >
                    <span className="text-sm font-medium text-white/86">{domain.name}</span>
                    <span className="text-sm text-white/58">{domain.questions}</span>
                    <span className="text-sm text-cyan-100/82">{domain.maxPoints}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[22px] border border-white/10 bg-cyan-300/[0.08] p-4 text-sm leading-6 text-cyan-50/86">
                {copy.optionalNote}
              </div>
            </section>

            <section>
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-cyan-100">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{copy.weightsTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-white/72">{copy.weightsIntro}</p>
                </div>
              </div>
              <div className="mt-4 overflow-hidden rounded-[22px] border border-white/[0.08] bg-black/[0.16]">
                {copy.weights.map((weight) => (
                  <div
                    key={weight.label}
                    className="border-b border-white/[0.08] px-4 py-3 last:border-b-0"
                  >
                    <p className="text-sm font-semibold text-white">{weight.label}</p>
                    <p className="mt-1 text-sm leading-6 text-white/66">{weight.values}</p>
                  </div>
                ))}
              </div>
            </section>
            </div>
          </section>

          <section className="mt-8">
            <ShowcasePreview label={copy.previewActionPlan}>
              <ActionPlanPreview />
            </ShowcasePreview>
          </section>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/74 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              {copy.closeCta}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onStart?.();
              }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-cyan-300/22 bg-cyan-300/12 px-5 text-sm font-semibold text-cyan-50 shadow-[0_16px_42px_rgba(56,189,248,0.18)] transition hover:border-cyan-200/34 hover:bg-cyan-300/18 hover:shadow-[0_18px_56px_rgba(56,189,248,0.24)]"
            >
              {copy.startCta}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
