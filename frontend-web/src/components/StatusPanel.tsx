import { ChevronDown, Database } from "lucide-react";
import type {
  ChatResponse,
  Question,
  ScoreResponse,
  SessionStateResponse,
} from "../types/api";
import { isEarlyPreview } from "../utils/assessmentUi";
import { Accordion, Badge, Card, Progress } from "./ui";

function valueOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

export default function StatusPanel({
  session,
  score,
  lastResponse,
  questions,
}: {
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  lastResponse?: ChatResponse | null;
  questions: Question[];
}) {
  const completionRate =
    session?.progress?.completion_rate ?? lastResponse?.completion_rate ?? score?.completion_rate ?? 0;
  const currentQuestion =
    lastResponse?.current_question ||
    questions.find((question) => question.id === session?.current_question_id) ||
    null;
  const currentDomain =
    session?.current_domain || lastResponse?.current_domain || currentQuestion?.domain;
  const scoreLabel =
    completionRate <= 0
      ? "not ready"
      : isEarlyPreview(completionRate)
        ? "early preview"
        : score?.score_status || "preliminary";
  const answers = Object.entries(session?.answers || {}).filter(
    ([questionId]) => !questionId.startsWith("followup__"),
  );
  const questionLookup = new Map(questions.map((question) => [question.id, question]));

  return (
    <aside className="space-y-4">
      <Card className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Assessment status</h2>
          <Badge tone={scoreLabel === "final" ? "success" : completionRate ? "warning" : "neutral"}>
            {scoreLabel}
          </Badge>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>Completion</span>
            <span>{completionRate}%</span>
          </div>
          <Progress value={completionRate} tone={completionRate === 100 ? "success" : "info"} />
        </div>

        <div className="mt-5 space-y-4">
          <StatusRow label="Current domain" value={valueOrDash(currentDomain)} />
          <div>
            <div className="text-xs font-medium text-slate-500">Current question</div>
            <div className="mt-1 text-sm leading-6 text-slate-100">
              {currentQuestion?.question || valueOrDash(session?.current_question_id)}
            </div>
          </div>
        </div>
      </Card>

      <Card className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl">
        <Accordion
          title={
            <span className="inline-flex items-center gap-2 text-white">
              <Database className="h-4 w-4" />
              Structured answers
              <Badge tone="neutral">{answers.length}</Badge>
            </span>
          }
          className="border-0 bg-transparent p-0"
        >
          <div className="space-y-2">
            {answers.length ? (
              answers.map(([questionId, record]) => (
                <div key={questionId} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-medium leading-5 text-slate-200">
                    {questionLookup.get(questionId)?.question || questionId}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="neutral">{questionId}</Badge>
                    <Badge tone="info">{valueOrDash(record.answer)}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                No validated answers yet.
              </div>
            )}
          </div>
          <ChevronDown className="hidden" />
        </Accordion>
      </Card>
    </aside>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-100">{value}</div>
    </div>
  );
}
