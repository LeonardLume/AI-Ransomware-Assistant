import { CheckCircle2, FileCode2, ShieldCheck } from "lucide-react";
import type { ArtifactId, ChatTechnicalDetails, ExtractedAnswerItem } from "../types/api";
import { Accordion, Badge, Button, cn } from "./ui";

const artifactLabels: Record<ArtifactId, string> = {
  "readiness-report": "Readiness Report",
  "action-plan": "Action Plan",
  "evidence-binder": "Evidence Binder",
  skills: "Skills",
  "ransomware-playbook": "Ransomware Playbook",
  "technical-json": "Technical JSON",
};

function buildTimeline(details: ChatTechnicalDetails) {
  const steps: Array<{ label: string; detail?: string }> = [];
  if (details.intent) {
    steps.push({ label: "intent detected", detail: details.intent });
  }
  if (details.redactionsApplied !== undefined) {
    const count = details.redactionsApplied.length;
    steps.push({
      label: "redaction status",
      detail: count ? `${count} applied` : "not applied",
    });
  }
  if (details.provider) {
    steps.push({
      label: "LLM provider",
      detail: `${details.provider}${details.usedFallback ? " - fallback" : ""}`,
    });
  }
  if (details.extractedAnswers !== undefined) {
    steps.push({
      label: "extraction completed",
      detail: `${details.extractedAnswers.length} answer${
        details.extractedAnswers.length === 1 ? "" : "s"
      }`,
    });
  }
  if (details.extractedAnswers?.length) {
    steps.push({ label: "answer validated", detail: "backend accepted allowed options" });
  }
  if (details.scoreStatus || details.completionRate !== undefined) {
    steps.push({
      label: "score recalculated",
      detail: `${details.scoreStatus || "preliminary"} - ${details.completionRate ?? 0}%`,
    });
  }
  if (details.promptInjectionBlocked !== undefined) {
    steps.push({
      label: "prompt injection status",
      detail: details.promptInjectionBlocked
        ? `blocked${details.promptInjectionReason ? `: ${details.promptInjectionReason}` : ""}`
        : "not triggered",
    });
  }
  return steps;
}

function confidenceFor(item: ExtractedAnswerItem): number | undefined {
  return (item as ExtractedAnswerItem & { confidence?: number }).confidence;
}

export default function AssistantTechnicalDetails({
  details,
  artifacts,
  onOpenArtifact,
}: {
  details?: ChatTechnicalDetails;
  artifacts?: ArtifactId[];
  onOpenArtifact?: (artifact: ArtifactId) => void;
}) {
  if (!details && !artifacts?.length) {
    return null;
  }

  const timeline = details ? buildTimeline(details) : [];

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      {artifacts?.length ? (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/90 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <FileCode2 className="h-4 w-4" />
            Artifacts opened
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {artifacts.map((artifact) => (
              <Button
                key={artifact}
                type="button"
                variant="secondary"
                onClick={() => onOpenArtifact?.(artifact)}
                className="rounded-full px-2.5 py-1 text-xs"
              >
                {artifactLabels[artifact]}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {timeline.length ? (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            Processing timeline
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {timeline.map((step) => (
              <div
                key={`${step.label}-${step.detail}`}
                className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/90 p-2"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-700">{step.label}</div>
                  {step.detail ? (
                    <div className="truncate text-xs text-slate-500">{step.detail}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Accordion title="Technical details" className="bg-white/95">
        <div className="space-y-3 text-xs leading-5 text-slate-600">
          {details?.extractedAnswers?.length ? (
            <div>
              <div className="font-semibold text-slate-700">Extracted answers</div>
              <div className="mt-2 space-y-2">
                {details.extractedAnswers.map((item) => (
                  <div key={item.questionId} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="neutral">question_id: {item.questionId}</Badge>
                      <Badge tone="info">answer: {item.answerLabel || item.answer}</Badge>
                      {confidenceFor(item) !== undefined ? (
                        <Badge tone="neutral">confidence: {confidenceFor(item)}</Badge>
                      ) : null}
                    </div>
                    {item.questionText ? (
                      <div className="mt-2 text-slate-600">{item.questionText}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>No structured answers were extracted from this assistant turn.</div>
          )}
          <div className={cn("grid gap-2 sm:grid-cols-2")}>
            {details?.provider ? <Badge tone="info">provider: {details.provider}</Badge> : null}
            {details?.usedFallback !== undefined ? (
              <Badge tone={details.usedFallback ? "warning" : "success"}>
                fallback: {String(details.usedFallback)}
              </Badge>
            ) : null}
            {details?.currentDomain ? (
              <Badge tone="neutral">domain: {details.currentDomain}</Badge>
            ) : null}
            {details?.currentQuestionId ? (
              <Badge tone="neutral">question_id: {details.currentQuestionId}</Badge>
            ) : null}
            {details?.responseType ? <Badge tone="neutral">type: {details.responseType}</Badge> : null}
            {details?.redactedForLlm !== undefined ? (
              <Badge tone={details.redactedForLlm ? "success" : "neutral"}>
                redacted for LLM: {String(details.redactedForLlm)}
              </Badge>
            ) : null}
            {details?.redactionsApplied?.length ? (
              <Badge tone="success">redactions: {details.redactionsApplied.join(", ")}</Badge>
            ) : null}
            {details?.missingRequiredQuestions?.length ? (
              <Badge tone="warning">
                missing: {details.missingRequiredQuestions.length}
              </Badge>
            ) : null}
          </div>
        </div>
      </Accordion>
    </div>
  );
}
