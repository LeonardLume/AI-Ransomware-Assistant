import type { Question, SessionStateResponse } from "../types/api";
import { t, valueLabel, type UiLanguage } from "../utils/i18n";

type StructuredAnswerRecord = {
  answer?: string;
  details?: string;
};

export default function TechnicalView({
  session,
  questions,
  language = "et",
}: {
  session?: SessionStateResponse | null;
  questions: Question[];
  language?: UiLanguage;
}) {
  const answers = Object.entries(session?.answers || {}).filter(
    ([questionId]) => !questionId.startsWith("followup__"),
  ) as Array<[string, StructuredAnswerRecord]>;
  const questionLookup = new Map(questions.map((question) => [question.id, question]));

  return (
    <section className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(125,211,252,0.08),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.045),transparent_32%)]" />

      <div className="relative">
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
                      <StatusPill
                        value={`${answerLabel(language)}: ${valueLabel(language, record.answer)}`}
                        tone="info"
                      />
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
      </div>
    </section>
  );
}

type StatusTone = "neutral" | "info";

function StatusPill({ value, tone }: { value: string; tone: StatusTone }) {
  const toneClass: Record<StatusTone, string> = {
    neutral: "border-white/[0.08] bg-white/[0.035] text-slate-300",
    info: "border-sky-300/20 bg-sky-300/[0.08] text-sky-100",
  };

  return (
    <span
      className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${toneClass[tone]}`}
    >
      <span className="truncate">{value}</span>
    </span>
  );
}

function answerLabel(language: UiLanguage): string {
  if (language === "en") return "answer";
  if (language === "ru") return "ответ";
  return "vastus";
}
