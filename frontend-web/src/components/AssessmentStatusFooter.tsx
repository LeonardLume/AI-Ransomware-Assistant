import type {
  ChatResponse,
  Question,
  ScoreResponse,
  SessionStateResponse,
} from "../types/api";
import { domainLabel, t, valueLabel, type UiLanguage } from "../utils/i18n";
import { Progress } from "./ui";

function compact(value: unknown, fallback = "-"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

export default function AssessmentStatusFooter({
  session,
  score,
  lastResponse,
  questions,
  language = "et",
}: {
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  lastResponse?: ChatResponse | null;
  questions: Question[];
  language?: UiLanguage;
}) {
  const completionRate =
    session?.progress?.completion_rate ?? lastResponse?.completion_rate ?? score?.completion_rate ?? 0;
  const currentQuestion =
    lastResponse?.current_question ||
    questions.find((question) => question.id === session?.current_question_id) ||
    null;
  const currentDomain =
    session?.current_domain || lastResponse?.current_domain || currentQuestion?.domain;
  const answersCount = Object.keys(session?.answers || {}).filter(
    (questionId) => !questionId.startsWith("followup__"),
  ).length;
  const scoreStatus =
    completionRate <= 0
      ? "not ready"
      : score?.score_status || (session?.progress?.is_complete ? "final" : "preliminary");

  return (
    <footer className="sticky bottom-0 z-20 mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#07080b]/95 shadow-[0_-18px_54px_rgba(0,0,0,0.38)] backdrop-blur-xl">
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-center">
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-400">
            <span>{t(language, "completion")}</span>
            <span className="font-semibold text-white">{completionRate}%</span>
          </div>
          <Progress value={completionRate} tone={completionRate === 100 ? "success" : "info"} />
        </div>

        <div className="grid min-w-0 gap-2 text-xs text-slate-400 md:grid-cols-2 xl:grid-cols-[minmax(160px,0.9fr)_minmax(0,2.55fr)_minmax(112px,0.72fr)_minmax(112px,0.72fr)]">
          <StatusItem label="Domain" value={domainLabel(language, currentDomain)} />
          <StatusItem
            label="Question"
            value={currentQuestion?.question || compact(session?.current_question_id)}
            emphasized
          />
          <StatusItem label="Score" value={valueLabel(language, scoreStatus)} />
          <StatusItem label="Answers" value={String(answersCount)} />
        </div>
      </div>
    </footer>
  );
}

function StatusItem({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={[
        "min-w-0 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2",
        emphasized ? "status-question-card xl:col-span-1" : "",
      ].join(" ")}
    >
      <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
      <div
        className={
          emphasized
            ? "mt-1 text-[15px] font-semibold leading-5 text-slate-50 sm:pr-2"
            : "mt-0.5 truncate text-sm font-medium text-slate-100"
        }
      >
        {value}
      </div>
    </div>
  );
}
