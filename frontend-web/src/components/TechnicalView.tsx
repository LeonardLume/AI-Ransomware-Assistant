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
}: {
  backendOnline: boolean;
  providerStatus?: ProviderStatusResponse | null;
  lastResponse?: ChatResponse | null;
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  report?: ReportResponse | null;
  questions: Question[];
  flow?: TechnicalFlowResponse | null;
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
        <h2 className="text-xl font-semibold text-slate-950">Technical</h2>
        <p className="mt-1 text-sm text-slate-500">
          Provider status, structured backend state, and debug payloads.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-950">Provider and guardrails</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <span>Backend</span>
                <Badge tone={backendOnline ? "success" : "danger"}>
                  {backendOnline ? "online" : "offline"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <span>LLM</span>
                <Badge tone={provider === "fallback" ? "warning" : "info"}>{provider}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <span>Fallback</span>
                <Badge tone={fallbackUsed ? "warning" : "success"}>
                  {String(Boolean(fallbackUsed))}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <span>Redaction</span>
                <Badge tone={redactionCount ? "success" : "neutral"}>
                  {lastResponse?.redactions_applied === undefined
                    ? "not reported"
                    : redactionCount
                      ? `${redactionCount} applied`
                      : "not applied"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 sm:col-span-2">
                <span>Prompt injection</span>
                <Badge tone={lastResponse?.prompt_injection_blocked ? "danger" : "neutral"}>
                  {lastResponse?.prompt_injection_blocked === undefined
                    ? "not reported"
                    : lastResponse.prompt_injection_blocked
                      ? "blocked"
                      : "not triggered"}
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
                  Structured answers
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
                        <Badge tone="info">answer: {valueOrDash(record.answer)}</Badge>
                        {record.confidence !== undefined ? (
                          <Badge tone="neutral">confidence: {record.confidence}</Badge>
                        ) : null}
                      </div>
                      {record.details ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500">{record.details}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    No validated structured answers yet.
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
          />
        </div>

        <div className="space-y-4">
          <Card className="p-4 text-sm leading-6 text-slate-600">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-slate-950">Backend source of truth</h3>
                <p className="mt-1">
                  The React app displays backend state only. FastAPI owns questions, structured
                  answers, scoring, reports, skills, evidence, and simulations.
                </p>
              </div>
            </div>
          </Card>
          <PrivacySafetyCard lastResponse={lastResponse} />
          {flow?.workflow?.length ? (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-slate-950">Technical trace</h3>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                {flow.workflow.map((step, index) => (
                  <li key={`${step}-${index}`} className="rounded-xl bg-slate-50 p-3">
                    {step}
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
