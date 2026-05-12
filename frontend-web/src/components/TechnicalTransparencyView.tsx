import { ArrowRight, BrainCircuit, Database, FileJson, Filter, MessageSquare, ShieldCheck } from "lucide-react";
import type { ProviderStatusResponse, TechnicalFlowResponse } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import { Badge, Card, Accordion } from "./ui";

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
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-white">{t(language, "technicalTransparency")}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {subtitleFor(language)}
        </p>
      </div>

      <Card className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl">
        <h3 className="text-lg font-semibold text-white">{t(language, "workflow")}</h3>
        <div className="mt-5 grid gap-3 xl:grid-cols-9">
          {workflow.map((step, index) => (
            <div key={step} className="relative rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                {stepLabel(language)} {index + 1}
              </div>
              <div className="mt-1 text-sm font-medium leading-5 text-slate-100">{step}</div>
              {index < workflow.length - 1 ? (
                <ArrowRight className="absolute -right-4 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-white/25 xl:block" />
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <InfoCard
            key={card.title}
            icon={card.icon}
            title={card.title}
            text={card.text}
            warning={card.warning}
            language={language}
          />
        ))}
      </section>

      <Accordion title={t(language, "debugTechnicalData")}>
        <pre className="scrollbar-slim max-h-72 overflow-auto rounded-2xl bg-black/50 p-4 text-xs leading-5 text-slate-200">
          {JSON.stringify({ flow, providerStatus }, null, 2)}
        </pre>
      </Accordion>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
  warning,
  language,
}: {
  icon: typeof FileJson;
  title: string;
  text: string;
  warning?: boolean;
  language: UiLanguage;
}) {
  return (
    <Card className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className={warning ? "h-4 w-4 text-amber-300" : "h-4 w-4 text-sky-300"} />
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
      {warning ? (
        <div className="mt-3">
          <Badge tone="warning">{t(language, "defensiveOnly")}</Badge>
        </div>
      ) : null}
    </Card>
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
      "Отчет и план действий",
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
    "Prompt firewall",
    "Tundlike andmete redigeerimine",
    "Kavatsuse tuvastus",
    "LLM selgitus või väljavõte",
    "Backendi valideerimine",
    "Struktureeritud vastused",
    "Reeglipõhine skoor",
    "Raport ja tegevusplaan",
  ];
}

function infoCardsFor(language: UiLanguage, provider: string) {
  if (language === "ru") {
    return [
      { icon: FileJson, title: "Источник вопросов", text: "Вопросы приходят из questions.json. UI не задает официальный questionnaire." },
      { icon: BrainCircuit, title: "Роль LLM", text: "LLM объясняет понятия и извлекает кандидаты структурированных ответов. Он не считает официальный score." },
      { icon: ShieldCheck, title: "Backend validation", text: "FastAPI проверяет question IDs и допустимые options перед сохранением ответов." },
      { icon: Database, title: "Rule scoring", text: "Score детерминированно считается backend-правилами из scoring_rules.json." },
      { icon: Filter, title: "Fallback mode", text: `Fallback работает без API key. Сейчас provider сообщает ${provider}.` },
      { icon: MessageSquare, title: "Чувствительные данные", text: "Это self-assessment, а не технический аудит. Сканирование или pentesting не выполняются.", warning: true },
    ];
  }
  if (language === "en") {
    return [
      { icon: FileJson, title: "Question source", text: "Questions come from questions.json. The UI does not define the official questionnaire." },
      { icon: BrainCircuit, title: "LLM role", text: "The LLM explains concepts and extracts candidate structured answers. It does not invent or calculate the official score." },
      { icon: ShieldCheck, title: "Backend validation", text: "FastAPI validates question IDs and allowed options before storing structured answers." },
      { icon: Database, title: "Rule scoring", text: "The score is deterministic and rule-based from scoring_rules.json." },
      { icon: Filter, title: "Fallback mode", text: `Fallback works without an API key. Provider currently reports ${provider}.` },
      { icon: MessageSquare, title: "Sensitive data", text: "This tool is a self-assessment, not scanning, pentesting, or a full technical audit.", warning: true },
    ];
  }
  return [
    { icon: FileJson, title: "Küsimuste allikas", text: "Küsimused tulevad failist questions.json. UI ei määra ametlikku küsimustikku." },
    { icon: BrainCircuit, title: "LLM-i roll", text: "LLM selgitab mõisteid ja pakub struktureeritud vastuste kandidaate. Ametlikku skoori ta ei arvuta." },
    { icon: ShieldCheck, title: "Backendi valideerimine", text: "FastAPI kontrollib question ID-sid ja lubatud vastusevariante enne salvestamist." },
    { icon: Database, title: "Reeglipõhine skoor", text: "Skoor on deterministlik ja arvutatakse backendi scoring_rules.json reeglitega." },
    { icon: Filter, title: "Fallback režiim", text: `Fallback töötab ilma API võtmeta. Praegune provider on ${provider}.` },
    { icon: MessageSquare, title: "Tundlikud andmed", text: "See tööriist on enesehindamine, mitte skaneerimine, pentest ega täielik tehniline audit.", warning: true },
  ];
}

function subtitleFor(language: UiLanguage): string {
  if (language === "en") {
    return "What the UI sends, what the LLM can influence, and what remains deterministic in FastAPI.";
  }
  if (language === "ru") {
    return "Что отправляет UI, на что может влиять LLM, и что остается детерминированным в FastAPI.";
  }
  return "Mida UI saadab, mida LLM mõjutab ja mis jääb FastAPI-s deterministlikuks.";
}

function stepLabel(language: UiLanguage): string {
  if (language === "en") return "Step";
  if (language === "ru") return "Шаг";
  return "Samm";
}
