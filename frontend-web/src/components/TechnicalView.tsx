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
  const provider = providerStatus?.provider || lastResponse?.provider || "unknown";
  const providerDisplay = valueLabel(language, provider);
  const fallbackUsed = providerStatus
    ? providerStatus.provider === "fallback"
    : (lastResponse?.used_fallback ?? provider === "fallback");
  const answers = Object.entries(session?.answers || {}).filter(
    ([questionId]) => !questionId.startsWith("followup__"),
  );
  const questionLookup = new Map(questions.map((question) => [question.id, question]));
  const redactionCount = lastResponse?.redactions_applied?.length ?? 0;

  return (
    <section className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(125,211,252,0.08),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.045),transparent_32%)]" />

      <div className="relative space-y-6">
        <section className="report-panel rounded-[34px] px-6 py-7 sm:px-8">
          <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
            {t(language, "technical")}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            {t(language, "technicalDescription")}
          </p>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <section className="report-panel rounded-[30px] px-5 py-5 sm:px-6">
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
                {t(language, "providerAndGuardrails")}
              </h3>
              <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                <StatusRow
                  label={t(language, "backend")}
                  value={backendOnline ? t(language, "online") : t(language, "offline")}
                  tone={backendOnline ? "success" : "danger"}
                />
                <StatusRow
                  label="LLM"
                  value={providerDisplay}
                  tone={provider === "fallback" ? "warning" : "info"}
                />
                <StatusRow
                  label={t(language, "fallbackMode")}
                  value={booleanLabel(language, Boolean(fallbackUsed))}
                  tone={fallbackUsed ? "warning" : "success"}
                />
                <StatusRow
                  label={t(language, "redaction")}
                  value={
                    lastResponse?.redactions_applied === undefined
                      ? t(language, "notReported")
                      : redactionCount
                        ? `${redactionCount} ${t(language, "applied")}`
                        : t(language, "notApplied")
                  }
                  tone={redactionCount ? "success" : "neutral"}
                />
                <StatusRow
                  label={t(language, "promptInjection")}
                  value={
                    lastResponse?.prompt_injection_blocked === undefined
                      ? t(language, "notReported")
                      : lastResponse.prompt_injection_blocked
                        ? t(language, "blocked")
                        : t(language, "notTriggered")
                  }
                  tone={lastResponse?.prompt_injection_blocked ? "danger" : "neutral"}
                  wide
                />
              </div>
              {providerStatus?.reason ? (
                <p className="mt-4 text-xs leading-5 text-slate-500">{providerStatus.reason}</p>
              ) : null}
            </section>

            <section className="report-panel rounded-[30px] px-5 py-5 sm:px-6">
              <details open>
                <summary className="cursor-pointer list-none text-xl font-semibold tracking-[-0.03em] text-white">
                  {t(language, "structuredAnswers")} ({answers.length})
                </summary>
                <div className="mt-5 space-y-2">
                  {answers.length ? (
                    answers.map(([questionId, record]) => (
                      <article
                        key={questionId}
                        className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] px-4 py-3"
                      >
                        <div className="text-sm font-medium leading-6 text-slate-100">
                          {questionLookup.get(questionId)?.question || questionId}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusPill value={`id: ${questionId}`} tone="neutral" />
                          <StatusPill value={`${answerLabel(language)}: ${valueLabel(language, record.answer)}`} tone="info" />
                          {record.confidence !== undefined ? (
                            <StatusPill value={`${t(language, "confidence")}: ${valueOrDash(record.confidence)}`} tone="neutral" />
                          ) : null}
                        </div>
                        {record.details ? (
                          <p className="mt-2 text-xs leading-5 text-slate-500">{record.details}</p>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-white/[0.10] bg-white/[0.02] p-4 text-sm text-slate-500">
                      {t(language, "noValidatedAnswers")}
                    </div>
                  )}
                </div>
              </details>
            </section>

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
            <section className="report-panel rounded-[30px] px-5 py-5 text-sm leading-6 text-slate-400 sm:px-6">
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">
                {t(language, "backendSourceOfTruth")}
              </h3>
              <p className="mt-2">{t(language, "backendSourceText")}</p>
            </section>
            <PrivacySafetyCard lastResponse={lastResponse} language={language} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusRow({
  label,
  value,
  tone,
  wide,
}: {
  label: string;
  value: string;
  tone: StatusTone;
  wide?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-[18px] border border-white/[0.07] bg-white/[0.025] px-3 py-3 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-slate-400">{label}</span>
      <StatusPill value={value} tone={tone} />
    </div>
  );
}

type StatusTone = "neutral" | "success" | "info" | "warning" | "danger";

function StatusPill({ value, tone }: { value: string; tone: StatusTone }) {
  const toneClass: Record<StatusTone, string> = {
    neutral: "border-white/[0.08] bg-white/[0.035] text-slate-300",
    success: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100",
    info: "border-sky-300/20 bg-sky-300/[0.08] text-sky-100",
    warning: "border-amber-300/20 bg-amber-300/[0.08] text-amber-100",
    danger: "border-rose-300/20 bg-rose-300/[0.08] text-rose-100",
  };
  return (
    <span className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${toneClass[tone]}`}>
      <span className="truncate">{value}</span>
    </span>
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

