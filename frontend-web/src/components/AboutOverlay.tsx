import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Database,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
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

type AboutCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  close: string;
  start: string;
  howTitle: string;
  howSubtitle: string;
  clarityTitle: string;
  workflow: Array<{
    title: string;
    description: string;
  }>;
  benefits: Array<{
    title: string;
    description: string;
  }>;
  principles: Array<{
    label: string;
    value: string;
  }>;
  advancedTitle: string;
  advancedClosed: string;
  advancedOpen: string;
  rawFormulasTitle: string;
  riskBandsTitle: string;
  scoredDomainsTitle: string;
  scoredDomainsNote: string;
};

const copyByLanguage: Record<UiLanguage, AboutCopy> = {
  et: {
    eyebrow: "AI turvahindamise agent",
    title: "Piiritletud AI turvaagent lunavara valmisoleku hindamiseks.",
    subtitle:
      "Mitte lihtsalt küsimustik: agent juhib turvakontrolle, aitab vastuseid liigitada, küsib tõendeid ja jätab ametliku skoori backend'i kontrolli alla.",
    close: "Sulge",
    start: "Alusta hindamist",
    howTitle: "Kuidas kasutada",
    howSubtitle: "Kolm sammu ja üks kaitsev valmisolekuraport.",
    clarityTitle: "Mis jääb selgeks",
    workflow: [
      {
        title: "Räägi agendiga",
        description: "Kirjelda olukorda vabas vormis. Agent aitab selle muuta valideeritud kontrolli vastuseks.",
      },
      {
        title: "Kinnita tõendid",
        description: "Küsi, mis tõend sobib: poliitika, logi, ekraanipilt, taastamistesti kirje või omanike nimekiri.",
      },
      {
        title: "Vaata tegevusplaani",
        description: "Raport näitab backend'i kontrollitud skoori, nõrku kohti, tõendeid ja järgmisi samme.",
      },
    ],
    benefits: [
      {
        title: "Agentic, aga piiritletud",
        description: "Disain järgib CAI-laadset agentide mustrit, kuid ohtlikke offensive tööriistu ei lubata.",
      },
      {
        title: "Backend kontrollib skoori",
        description: "LLM võib selgitada ja soovitada, kuid ametlik valmisoleku skoor tuleb fikseeritud backend'i reeglitest.",
      },
      {
        title: "Kasulik IT/MSP üleandmiseks",
        description: "Tulemus on struktureeritud kontrollide, tõendite, riskide ja prioriseeritud paranduste järgi.",
      },
    ],
    principles: [
      { label: "Kontrollid", value: "27 kohustuslikku" },
      { label: "Skoor", value: "Backend'i kontrollitud" },
      { label: "Agendi režiim", value: "Ainult kaitsev" },
    ],
    advancedTitle: "Täpsemad tulemuse arvutuse detailid",
    advancedClosed: "Näita tehnilisi detaile",
    advancedOpen: "Peida tehnilised detailid",
    rawFormulasTitle: "Toorvalemid",
    riskBandsTitle: "Riskivahemikud",
    scoredDomainsTitle: "Hinnatavad domeenid",
    scoredDomainsNote:
      "Töötajate turvahügieeni soovitused võivad raportis ilmuda, kuid need ei muuda ametlikku valmisoleku tulemust.",
  },
  en: {
    eyebrow: "AI security assessment agent",
    title: "A bounded AI security agent for ransomware readiness.",
    subtitle:
      "Not just a questionnaire: the agent guides security controls, helps classify answers, asks for evidence, and keeps official scoring under backend control.",
    close: "Close",
    start: "Start assessment",
    howTitle: "How to use",
    howSubtitle: "Three steps, one defensive report.",
    clarityTitle: "What stays clear",
    workflow: [
      {
        title: "Talk to the agent",
        description: "Describe the current situation in plain language. The agent helps turn it into a validated control answer.",
      },
      {
        title: "Validate evidence",
        description: "Ask what proof would support the answer: policies, logs, screenshots, restore-test records or owner lists.",
      },
      {
        title: "Review the plan",
        description: "The report shows backend-owned score, weak areas, evidence to collect and next actions.",
      },
    ],
    benefits: [
      {
        title: "Agentic, but bounded",
        description: "The design follows CAI-style agent patterns, but unsafe offensive tools are not enabled.",
      },
      {
        title: "Backend owns scoring",
        description: "The LLM can explain and propose, but official readiness score comes from fixed backend rules.",
      },
      {
        title: "Useful for IT and MSP handoff",
        description: "The output is structured around controls, evidence, risks and prioritized remediation.",
      },
    ],
    principles: [
      { label: "Controls", value: "27 required" },
      { label: "Score", value: "Backend-owned" },
      { label: "Agent mode", value: "Defensive only" },
    ],
    advancedTitle: "Advanced Scoring Details",
    advancedClosed: "Show technical details",
    advancedOpen: "Hide technical details",
    rawFormulasTitle: "Raw formulas",
    riskBandsTitle: "Risk bands",
    scoredDomainsTitle: "Scored domains",
    scoredDomainsNote:
      "Optional employee hygiene guidance can appear in the report, but it does not change the official readiness score.",
  },
  ru: {
    eyebrow: "AI security assessment agent",
    title: "AI-агент для оценки готовности к ransomware.",
    subtitle:
      "Это не просто questionnaire: агент ведет по security controls, помогает выбрать ответ, запрашивает доказательства и оставляет официальный score под контролем backend.",
    close: "Закрыть",
    start: "Начать оценку",
    howTitle: "Как использовать",
    howSubtitle: "Три шага и один IT-ready отчёт.",
    clarityTitle: "Что остаётся прозрачным",
    workflow: [
      {
        title: "Говорите с агентом",
        description: "Опишите ситуацию обычным языком. Агент поможет превратить это в валидированный ответ по контролю.",
      },
      {
        title: "Проверяйте доказательства",
        description: "Спросите, какие policy, логи, screenshots, restore-test records или списки владельцев подтверждают ответ.",
      },
      {
        title: "Смотрите план",
        description: "Отчет показывает backend-owned score, слабые области, доказательства и следующие действия.",
      },
    ],
    benefits: [
      {
        title: "Agentic, но bounded",
        description: "Архитектура вдохновлена CAI-style agent patterns, но опасные offensive tools не включены.",
      },
      {
        title: "Score считает backend",
        description: "LLM может объяснять и предлагать, но официальный readiness score идет из фиксированных backend rules.",
      },
      {
        title: "Ценность для IT/MSP",
        description: "Результат структурирован вокруг controls, evidence, risks и prioritized remediation.",
      },
    ],
    principles: [
      { label: "Controls", value: "27 required" },
      { label: "Score", value: "Backend-owned" },
      { label: "Agent mode", value: "Defensive only" },
    ],
    advancedTitle: "Advanced Scoring Details",
    advancedClosed: "Показать технические детали",
    advancedOpen: "Скрыть технические детали",
    rawFormulasTitle: "Raw formulas",
    riskBandsTitle: "Risk bands",
    scoredDomainsTitle: "Scored domains",
    scoredDomainsNote:
      "Optional employee hygiene guidance can appear in the report, but it does not change the official readiness score.",
  },
};

const workflowIcons = [MessageSquareText, BookOpenCheck, ClipboardList];
const benefitIcons = [Database, LockKeyhole, ShieldCheck];

function advancedFormulasFor(language: UiLanguage) {
  if (language === "et") {
    return [
      "Domeeni tulemus = ümarda((teenitud domeenipunktid / maksimaalsed domeenipunktid) * 100)",
      "Üldtulemus = ümarda((hinnatud domeenide protsentide summa) / hinnatud domeenide arv)",
      "Täidetuse määr = ümarda((vastatud kohustuslikud küsimused / kõik kohustuslikud küsimused) * 100)",
      "Jah = täispunktid, Osaliselt = vähendatud punktid, Ei = 0, Ei tea = 0",
    ];
  }
  return [
    "Domain score = round((earned domain points / max domain points) * 100)",
    "Overall score = round((sum of scored domain percentages) / scored domain count)",
    "Completion rate = round((answered required questions / total required questions) * 100)",
    "Yes = full fixed points, Partial = reduced fixed points, No = 0, Unsure = 0",
  ];
}

function rawDomainsFor(language: UiLanguage) {
  if (language === "et") {
    return [
      ["Varukoopiad ja taastamine", "5 küsimust", "100 maksimum punkti"],
      ["MFA ja ligipääs", "4 küsimust", "100 maksimum punkti"],
      ["Paikamine", "4 küsimust", "100 maksimum punkti"],
      ["Administraatoriõigused", "4 küsimust", "100 maksimum punkti"],
      ["Intsidendile reageerimine", "5 küsimust", "120 maksimum punkti"],
      ["Tuvastus ja seire", "5 küsimust", "100 maksimum punkti"],
    ];
  }
  return [
    ["Backups & recovery", "5 questions", "100 max points"],
    ["MFA & access", "4 questions", "100 max points"],
    ["Patching", "4 questions", "100 max points"],
    ["Admin rights", "4 questions", "100 max points"],
    ["Incident response", "5 questions", "120 max points"],
    ["Detection & monitoring", "5 questions", "100 max points"],
  ];
}

function riskBandsFor(language: UiLanguage) {
  if (language === "et") {
    return [
      ["Madal", "80-100"],
      ["Keskmine", "60-79"],
      ["Kõrge", "40-59"],
      ["Kriitiline", "0-39"],
    ];
  }
  return [
    ["Low", "80-100"],
    ["Medium", "60-79"],
    ["High", "40-59"],
    ["Critical", "0-39"],
  ];
}

function SoftIcon({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: "blue" | "violet" | "slate";
}) {
  const toneClass =
    tone === "violet"
      ? "border-violet-300/20 bg-violet-300/10 text-violet-100 shadow-[0_0_30px_rgba(168,85,247,0.14)]"
      : tone === "slate"
        ? "border-white/10 bg-white/[0.06] text-white/80"
        : "border-sky-300/20 bg-sky-300/10 text-sky-100 shadow-[0_0_30px_rgba(56,189,248,0.14)]";

  return (
    <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneClass}`}>
      {children}
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const copy = useMemo(() => copyByLanguage[language] || copyByLanguage.en, [language]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        hideClose
        overlayClassName="bg-black/60 backdrop-blur-md"
        aria-describedby="about-overlay-description"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeButtonRef.current?.focus();
        }}
        className="w-[min(94vw,64rem)] overflow-hidden rounded-3xl border border-white/10 bg-[#1c1c1e] p-0 text-left text-white shadow-[0_40px_120px_rgba(0,0,0,0.56)]"
        style={{
          fontFamily:
            'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>
        <DialogDescription id="about-overlay-description" className="sr-only">
          {copy.subtitle}
        </DialogDescription>

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015)_42%,rgba(0,0,0,0.16))]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-[36rem] -translate-x-1/2 rounded-full bg-sky-300/10 blur-3xl" />

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-gray-300 transition hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative max-h-[88vh] overflow-y-auto px-5 py-7 sm:px-8 sm:py-9 lg:px-12 lg:py-12">
          <div className="mx-auto max-w-4xl space-y-12">
            <section>
              <h2 className="max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
                {copy.title}
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-7 text-gray-400 sm:text-lg">
                {copy.subtitle}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStart?.();
                  }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-sky-300/25 bg-sky-600 px-6 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(2,132,199,0.28)] transition hover:bg-sky-500 hover:shadow-[0_22px_60px_rgba(2,132,199,0.34)]"
                >
                  {copy.start}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-white">{copy.howTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                {copy.howSubtitle}
              </p>
              <div className="mt-6 space-y-4">
                {copy.workflow.map((step, index) => {
                  const Icon = workflowIcons[index] || CheckCircle2;
                  return (
                    <div
                      key={step.title}
                      className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"
                    >
                      <SoftIcon tone={index === 1 ? "violet" : "blue"}>
                        <Icon className="h-5 w-5" />
                      </SoftIcon>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-gray-500">
                            0{index + 1}
                          </span>
                          <h4 className="text-lg font-semibold text-white">{step.title}</h4>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-400">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="text-2xl font-semibold text-white">{copy.clarityTitle}</h3>
              <div className="mt-6 divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.035]">
                {copy.benefits.map((benefit, index) => {
                  const Icon = benefitIcons[index] || ShieldCheck;
                  return (
                    <div key={benefit.title} className="flex gap-4 p-4 sm:p-5">
                      <SoftIcon tone={index === 1 ? "violet" : "slate"}>
                        <Icon className="h-5 w-5" />
                      </SoftIcon>
                      <div>
                        <h4 className="text-lg font-semibold text-white">{benefit.title}</h4>
                        <p className="mt-2 text-sm leading-6 text-gray-400">{benefit.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                  aria-expanded={advancedOpen}
                >
                  <div>
                    <p className="text-lg font-semibold text-white">{copy.advancedTitle}</p>
                    <p className="mt-1 text-sm text-gray-400">
                      {advancedOpen ? copy.advancedOpen : copy.advancedClosed}
                    </p>
                  </div>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-gray-300">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-300 ${
                        advancedOpen ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>

                <div
                  data-open={advancedOpen}
                  className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-out data-[open=true]:grid-rows-[1fr]"
                >
                  <div className="overflow-hidden">
                    <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {copy.rawFormulasTitle}
                        </p>
                        <div className="mt-4 space-y-2">
                          {advancedFormulasFor(language).map((formula) => (
                            <div
                              key={formula}
                              className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 font-mono text-xs leading-5 text-gray-300"
                            >
                              {formula}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {copy.riskBandsTitle}
                        </p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {riskBandsFor(language).map(([label, range]) => (
                            <div
                              key={label}
                              className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3"
                            >
                              <p className="text-sm font-semibold text-white">{label}</p>
                              <p className="mt-1 font-mono text-xs text-gray-400">{range}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5 lg:col-span-2">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {copy.scoredDomainsTitle}
                        </p>
                        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                          {rawDomainsFor(language).map(([domain, questions, maxPoints]) => (
                            <div
                              key={domain}
                              className="grid gap-1 border-b border-white/10 px-4 py-3 last:border-b-0 sm:grid-cols-[1.35fr_0.7fr_0.7fr] sm:items-center"
                            >
                              <span className="text-sm font-medium text-white">{domain}</span>
                              <span className="text-sm text-gray-400">{questions}</span>
                              <span className="text-sm text-gray-300">{maxPoints}</span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-4 text-sm leading-6 text-gray-400">
                          {copy.scoredDomainsNote}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
