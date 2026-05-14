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

function shorten(value: string, maxLength = 86): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}...`;
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

        <div className="grid min-w-0 gap-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
          <StatusItem label="Domain" value={domainLabel(language, currentDomain)} />
          <StatusItem
            label="Question"
            value={shorten(currentQuestion?.question || compact(session?.current_question_id))}
          />
          <StatusItem label="Score" value={valueLabel(language, scoreStatus)} />
          <StatusItem label="Answers" value={String(answersCount)} />
        </div>
      </div>
    </footer>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2">
      <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}
