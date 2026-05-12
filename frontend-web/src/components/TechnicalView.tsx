import { Database, ShieldCheck } from "lucide-react";
import type {
  ChatResponse,
  ProviderStatusResponse,
  Question,
  ReportResponse,
  ScoreResponse,
  SessionStateResponse,
  TechnicalFlowResponse,
} from "../types/api";
import { t, valueLabel, type UiLanguage } from "../utils/i18n";
import PrivacySafetyCard from "./PrivacySafetyCard";
import TechnicalJsonView from "./TechnicalJsonView";
import { Accordion, Badge, Card } from "./ui";

function valueOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

export default function TechnicalView({
  backendOnline,
  providerStatus,
  lastResponse,
  session,
  score,
  report,
  questions,
  flow,
  language = "et",
}: {
  backendOnline: boolean;
  providerStatus?: ProviderStatusResponse | null;
  lastResponse?: ChatResponse | null;
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  report?: ReportResponse | null;
  questions: Question[];
  flow?: TechnicalFlowResponse | null;
  language?: UiLanguage;
}) {
  const provider = lastResponse?.provider || providerStatus?.provider || "unknown";
  const fallbackUsed =
    lastResponse?.used_fallback ??
    providerStatus?.used_fallback ??
    providerStatus?.fallback_used ??
    provider === "fallback";
  const answers = Object.entries(session?.answers || {}).filter(
    ([questionId]) => !questionId.startsWith("followup__"),
  );
  const questionLookup = new Map(questions.map((question) => [question.id, question]));
  const redactionCount = lastResponse?.redactions_applied?.length ?? 0;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">{t(language, "technical")}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {t(language, "technicalDescription")}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-950">{t(language, "providerAndGuardrails")}</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <span>{t(language, "backend")}</span>
                <Badge tone={backendOnline ? "success" : "danger"}>
                  {backendOnline ? t(language, "online") : t(language, "offline")}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <span>LLM</span>
                <Badge tone={provider === "fallback" ? "warning" : "info"}>{provider}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <span>{t(language, "fallbackMode")}</span>
                <Badge tone={fallbackUsed ? "warning" : "success"}>
                  {booleanLabel(language, Boolean(fallbackUsed))}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <span>{t(language, "redaction")}</span>
                <Badge tone={redactionCount ? "success" : "neutral"}>
                  {lastResponse?.redactions_applied === undefined
                    ? t(language, "notReported")
                    : redactionCount
                      ? `${redactionCount} ${t(language, "applied")}`
                      : t(language, "notApplied")}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 sm:col-span-2">
                <span>{t(language, "promptInjection")}</span>
                <Badge tone={lastResponse?.prompt_injection_blocked ? "danger" : "neutral"}>
                  {lastResponse?.prompt_injection_blocked === undefined
                    ? t(language, "notReported")
                    : lastResponse.prompt_injection_blocked
                      ? t(language, "blocked")
                      : t(language, "notTriggered")}
                </Badge>
              </div>
            </div>
            {providerStatus?.reason ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">{providerStatus.reason}</p>
            ) : null}
          </Card>

          <Card className="p-4">
            <Accordion
              defaultOpen
              title={
                <span className="inline-flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {t(language, "structuredAnswers")}
                  <Badge tone="neutral">{answers.length}</Badge>
                </span>
              }
              className="border-0 bg-transparent p-0"
            >
              <div className="space-y-2">
                {answers.length ? (
                  answers.map(([questionId, record]) => (
                    <div key={questionId} className="rounded-xl border border-slate-200 p-3">
                      <div className="text-sm font-medium text-slate-900">
                        {questionLookup.get(questionId)?.question || questionId}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone="neutral">id: {questionId}</Badge>
                        <Badge tone="info">{answerLabel(language)}: {valueLabel(language, record.answer)}</Badge>
                        {record.confidence !== undefined ? (
                          <Badge tone="neutral">{t(language, "confidence")}: {valueOrDash(record.confidence)}</Badge>
                        ) : null}
                      </div>
                      {record.details ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500">{record.details}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    {t(language, "noValidatedAnswers")}
                  </div>
                )}
              </div>
            </Accordion>
          </Card>

          <TechnicalJsonView
            session={session}
            score={score}
            report={report}
            lastResponse={lastResponse}
            providerStatus={providerStatus}
            flow={flow}
            language={language}
          />
        </div>

        <div className="space-y-4">
          <Card className="p-4 text-sm leading-6 text-slate-600">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-slate-950">{t(language, "backendSourceOfTruth")}</h3>
                <p className="mt-1">{t(language, "backendSourceText")}</p>
              </div>
            </div>
          </Card>
          <PrivacySafetyCard lastResponse={lastResponse} language={language} />
          {flow?.workflow?.length ? (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-slate-950">{t(language, "technicalTrace")}</h3>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                {flow.workflow.map((step, index) => (
                  <li key={`${step}-${index}`} className="rounded-xl bg-slate-50 p-3">
                    {localizedFlowStep(language, step)}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function booleanLabel(language: UiLanguage, value: boolean): string {
  if (language === "en") return value ? "true" : "false";
  if (language === "ru") return value ? "да" : "нет";
  return value ? "jah" : "ei";
}

function answerLabel(language: UiLanguage): string {
  if (language === "en") return "answer";
  if (language === "ru") return "ответ";
  return "vastus";
}

function localizedFlowStep(language: UiLanguage, step: string): string {
  const normalized = step.toLowerCase();
  if (normalized.includes("prompt firewall")) {
    return language === "ru" ? "Prompt firewall блокирует попытки изменить системные инструкции" : language === "en" ? "Prompt firewall blocks attempts to change system instructions" : "Prompt firewall blokeerib juhiste muutmise katsed";
  }
  if (normalized.includes("redaction")) {
    return language === "ru" ? "Чувствительные данные редактируются перед LLM" : language === "en" ? "Sensitive data is redacted before LLM calls" : "Tundlikud andmed redigeeritakse enne LLM-i";
  }
  if (normalized.includes("confidence")) {
    return language === "ru" ? "Confidence показывается отдельно от score" : language === "en" ? "Confidence is shown separately from score" : "Usaldusväärsus kuvatakse skoorist eraldi";
  }
  if (normalized.includes("external")) {
    return language === "ru" ? "External exposure self-check основан на самооценке, без сканирования" : language === "en" ? "External exposure self-check is self-reported, with no scanning" : "Välise nähtavuse enesekontroll on self-report, ilma skaneerimiseta";
  }
  return step;
}
