import { ArrowRight, FileText } from "lucide-react";
import type { ChatResponse, Question, ScoreResponse, SessionStateResponse } from "../types/api";
import { isEarlyPreview } from "../utils/assessmentUi";
import { Badge, Button, Card, Progress } from "./ui";

function valueOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

export default function CompactStatusPanel({
  session,
  score,
  lastResponse,
  questions,
  canGenerateReport,
  loading,
  onOpenResults,
  onCreateReport,
}: {
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  lastResponse?: ChatResponse | null;
  questions: Question[];
  canGenerateReport: boolean;
  loading?: boolean;
  onOpenResults: () => void;
  onCreateReport: () => void;
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
      ? "Pole valmis"
      : isEarlyPreview(completionRate)
        ? "Esialgne eelvaade"
        : score?.score_status === "final" || score?.is_complete
          ? "Lõplik"
          : "Esialgne";

  return (
    <aside className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-950">Olek</h2>
          <Badge tone={scoreLabel === "Lõplik" ? "success" : completionRate ? "warning" : "neutral"}>
            {scoreLabel}
          </Badge>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>Täidetud</span>
            <span>{completionRate}%</span>
          </div>
          <Progress value={completionRate} tone={completionRate === 100 ? "success" : "info"} />
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <div className="text-xs font-medium text-slate-500">Praegune domeen</div>
            <div className="mt-1 text-slate-900">{valueOrDash(currentDomain)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Praegune küsimus</div>
            <div className="mt-1 leading-6 text-slate-900">
              {currentQuestion?.question || valueOrDash(session?.current_question_id)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          <Button type="button" variant="primary" onClick={onOpenResults}>
            <ArrowRight className="h-4 w-4" />
            Ava tulemused
          </Button>
          <Button
            type="button"
            onClick={onCreateReport}
            disabled={!canGenerateReport || loading}
          >
            <FileText className="h-4 w-4" />
            Koosta raport
          </Button>
        </div>
      </Card>
    </aside>
  );
}
