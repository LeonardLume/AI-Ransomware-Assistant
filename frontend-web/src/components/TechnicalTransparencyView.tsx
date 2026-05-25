import type { ProviderStatusResponse, TechnicalFlowResponse } from "../types/api";
import { t, valueLabel, type UiLanguage } from "../utils/i18n";

export default function TechnicalTransparencyView({
  flow,
  providerStatus,
  language = "et",
}: {
  flow?: TechnicalFlowResponse | null;
  providerStatus?: ProviderStatusResponse | null;
  language?: UiLanguage;
}) {
  const workflow = workflowFor(language);
  const cards = infoCardsFor(language, providerStatus?.provider || "unknown");

  return (
    <div className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.09),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.05),transparent_32%)]" />

      <div className="relative space-y-6">
        <section className="report-panel rounded-[34px] px-6 py-7 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                {t(language, "technicalTransparency")}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
                {subtitleFor(language)}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/[0.07] bg-black/[0.14] px-4 py-3 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {providerLabel(language)}
              </div>
              <div className="mt-0.5 text-2xl font-semibold leading-none tracking-[-0.05em] text-white">
                {valueLabel(language, providerStatus?.provider || "unknown")}
              </div>
            </div>
          </div>
        </section>

        <section className="report-panel rounded-[32px] px-5 py-6 sm:px-7">
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
            {t(language, "workflow")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {workflowDescription(language)}
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9">
            {workflow.map((step, index) => (
              <article
                key={step}
                className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] px-3 py-3"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                  {stepLabel(language)} {index + 1}
                </div>
                <div className="mt-2 text-sm font-medium leading-5 text-slate-100">
                  {step}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <InfoCard
              key={card.title}
              title={card.title}
              text={card.text}
              warning={card.warning}
              language={language}
            />
          ))}
        </section>

        <details className="rounded-[30px] border border-white/[0.08] bg-white/[0.025] px-5 py-4 backdrop-blur-2xl sm:px-6">
          <summary className="cursor-pointer list-none text-base font-semibold tracking-[-0.02em] text-white">
            {t(language, "debugTechnicalData")}
          </summary>
          <pre className="scrollbar-slim mt-4 max-h-72 overflow-auto rounded-[22px] border border-white/[0.07] bg-black/50 p-4 text-xs leading-5 text-slate-200">
            {JSON.stringify({ flow, providerStatus }, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  text,
  warning,
  language,
}: {
  title: string;
  text: string;
  warning?: boolean;
  language: UiLanguage;
}) {
  return (
    <article className="rounded-[28px] border border-white/[0.065] bg-white/[0.026] px-5 py-5 backdrop-blur-xl">
      <div className="text-lg font-semibold leading-7 tracking-[-0.03em] text-white">
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
      {warning ? (
        <div className="mt-4 inline-flex rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1 text-xs font-medium text-amber-100">
          {t(language, "defensiveOnly")}
        </div>
      ) : null}
    </article>
  );
}

function workflowFor(language: UiLanguage): string[] {
  if (language === "ru") {
    return [
      "Сообщение пользователя",
      "Prompt firewall",
      "Редакция чувствительных данных",
      "Определение намерения",
      "LLM объяснение или извлечение",
      "Backend validation",
      "Структурированные ответы",
      "Rule-based score",
      "Отчёт и план действий",
    ];
  }
  if (language === "en") {
    return [
      "User message",
      "Prompt firewall",
      "Redaction",
      "Intent detection",
      "LLM extraction/advisor",
      "Backend validation",
      "Structured answers",
      "Rule-based scoring",
      "Report/action plan",
    ];
  }
  return [
    "Kasutaja sõnum",
    "Juhiste kaitsefilter",
    "Tundlike andmete redigeerimine",
    "Kavatsuse tuvastus",
    "LLM selgitus või väljavõte",
    "Taustsüsteemi valideerimine",
    "Struktureeritud vastused",
    "Reeglipõhine tulemus",
    "Raport ja tegevusplaan",
  ];
}

function infoCardsFor(language: UiLanguage, provider: string) {
  if (language === "ru") {
    return [
      { title: "Источник вопросов", text: "Вопросы приходят из questions.json. UI не задаёт официальный questionnaire." },
      { title: "Роль LLM", text: "LLM объясняет понятия и извлекает кандидаты структурированных ответов. Он не считает официальный score." },
      { title: "Backend validation", text: "FastAPI проверяет question IDs и допустимые options перед сохранением ответов." },
      { title: "Rule scoring", text: "Score детерминированно считается backend-правилами из scoring_rules.json." },
      { title: "Fallback mode", text: `Fallback работает без API key. Сейчас provider сообщает ${provider}.` },
      { title: "Чувствительные данные", text: "Это self-assessment, а не технический аудит. Сканирование или pentesting не выполняются.", warning: true },
    ];
  }
  if (language === "en") {
    return [
      { title: "Question source", text: "Questions come from questions.json. The UI does not define the official questionnaire." },
      { title: "LLM role", text: "The LLM explains concepts and extracts candidate structured answers. It does not invent or calculate the official score." },
      { title: "Backend validation", text: "FastAPI validates question IDs and allowed options before storing structured answers." },
      { title: "Rule scoring", text: "The score is deterministic and rule-based from scoring_rules.json." },
      { title: "Fallback mode", text: `Fallback works without an API key. Provider currently reports ${provider}.` },
      { title: "Sensitive data", text: "This tool is a self-assessment, not scanning, pentesting, or a full technical audit.", warning: true },
    ];
  }
  return [
    { title: "Küsimuste allikas", text: "Küsimused tulevad failist questions.json. Kasutajaliides ei määra ametlikku küsimustikku." },
    { title: "LLM-i roll", text: "LLM selgitab mõisteid ja pakub struktureeritud vastuste kandidaate. Ametlikku tulemust ta ei arvuta." },
    { title: "Taustsüsteemi valideerimine", text: "FastAPI kontrollib küsimuste tunnuseid ja lubatud vastusevariante enne salvestamist." },
    { title: "Reeglipõhine tulemus", text: "Tulemus on deterministlik ja arvutatakse taustsüsteemi faili scoring_rules.json reeglitega." },
    { title: "Varurežiim", text: `Varurežiim töötab ilma API võtmeta. Praegune teenusepakkuja on ${valueLabel(language, provider)}.` },
    { title: "Tundlikud andmed", text: "See tööriist on enesehindamine, mitte skaneerimine, pentest ega täielik tehniline audit.", warning: true },
  ];
}

function subtitleFor(language: UiLanguage): string {
  if (language === "en") {
    return "What the UI sends, what the LLM can influence, and what remains deterministic in FastAPI.";
  }
  if (language === "ru") {
    return "Что отправляет UI, на что может влиять LLM, и что остаётся детерминированным в FastAPI.";
  }
  return "Mida kasutajaliides saadab, mida LLM mõjutab ja mis jääb FastAPI-s deterministlikuks.";
}

function workflowDescription(language: UiLanguage): string {
  if (language === "en") return "The main path from user input to validated answers, scoring, and report output.";
  if (language === "ru") return "Основной путь от сообщения пользователя до validated answers, scoring и отчёта.";
  return "Põhitee kasutaja sisendist valideeritud vastuste, tulemuse ja raportini.";
}

function stepLabel(language: UiLanguage): string {
  if (language === "en") return "Step";
  if (language === "ru") return "Шаг";
  return "Samm";
}

function providerLabel(language: UiLanguage): string {
  if (language === "en") return "Provider";
  if (language === "ru") return "Провайдер";
  return "Teenusepakkuja";
}
