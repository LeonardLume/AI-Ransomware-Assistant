import { CheckCircle2, FileCode2, ShieldCheck } from "lucide-react";
import type { ArtifactId, ChatTechnicalDetails, ExtractedAnswerItem } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { cn } from "./ui-helpers";

function artifactLabel(artifact: ArtifactId, language: UiLanguage): string {
  if (artifact === "readiness-report") return t(language, "report");
  if (artifact === "action-plan") return t(language, "actionPlan");
  if (artifact === "evidence-binder") return t(language, "evidenceBinder");
  if (artifact === "skills" || artifact === "ransomware-playbook") return t(language, "skills");
  return t(language, "technicalJson");
}

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

function responseTypeVariant(responseType?: string) {
  const normalized = String(responseType || "").toLowerCase();
  if (normalized.includes("error") || normalized.includes("blocked")) return "danger" as const;
  if (normalized.includes("question")) return "warning" as const;
  if (normalized.includes("answer")) return "info" as const;
  if (normalized.includes("artifact") || normalized.includes("report")) return "success" as const;
  return "neutral" as const;
}

export default function AssistantTechnicalDetails({
  details,
  artifacts,
  language = "et",
  onOpenArtifact,
}: {
  details?: ChatTechnicalDetails;
  artifacts?: ArtifactId[];
  language?: UiLanguage;
  onOpenArtifact?: (artifact: ArtifactId) => void;
}) {
  if (!details && !artifacts?.length) {
    return null;
  }

  const timeline = details ? buildTimeline(details) : [];

  return (
    <div className="mt-3 border-t border-white/8 pt-3">
      {artifacts?.length ? (
        <div className="mb-3 rounded-[18px] border border-white/8 bg-white/[0.03] p-3 backdrop-blur-md">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <FileCode2 className="h-4 w-4" />
            {t(language, "artifactsOpened")}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {artifacts.map((artifact) => (
              <Button
                key={artifact}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onOpenArtifact?.(artifact)}
                className="rounded-full border-white/8 bg-white/[0.03] text-slate-300 shadow-none hover:bg-white/[0.06]"
              >
                {artifactLabel(artifact, language)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {timeline.length ? (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            {t(language, "processingTimeline")}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {timeline.map((step) => (
              <div
                key={`${step.label}-${step.detail}`}
                className="flex items-start gap-2 rounded-[16px] border border-white/7 bg-white/[0.025] p-2.5 backdrop-blur-md"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-300">{step.label}</div>
                  {step.detail ? (
                    <div className="truncate text-xs text-slate-500">{step.detail}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Accordion type="single" collapsible>
        <AccordionItem value="technical-details" className="border-white/8 bg-white/[0.03]">
          <AccordionTrigger>{t(language, "technicalDetails")}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-xs leading-5 text-slate-600">
              {details?.extractedAnswers?.length ? (
                <div>
                  <div className="font-semibold text-slate-300">{t(language, "extractedAnswers")}</div>
                  <div className="mt-2 space-y-2">
                    {details.extractedAnswers.map((item) => (
                      <div key={item.questionId} className="rounded-[16px] border border-white/7 bg-white/[0.025] p-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="neutral">question_id: {item.questionId}</Badge>
                          <Badge variant="info">answer: {item.answerLabel || item.answer}</Badge>
                          {confidenceFor(item) !== undefined ? (
                            <Badge variant="neutral">confidence: {confidenceFor(item)}</Badge>
                          ) : null}
                        </div>
                        {item.questionText ? (
                          <div className="mt-2 text-slate-500">{item.questionText}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>{t(language, "noStructuredAnswers")}</div>
              )}
              <Separator className="bg-white/6" />
              <div className={cn("grid gap-2 sm:grid-cols-2")}>
                {details?.provider ? <Badge variant="info">provider: {details.provider}</Badge> : null}
                {details?.usedFallback !== undefined ? (
                  <Badge variant={details.usedFallback ? "warning" : "success"}>
                    fallback: {String(details.usedFallback)}
                  </Badge>
                ) : null}
                {details?.currentDomain ? (
                  <Badge variant="neutral">domain: {details.currentDomain}</Badge>
                ) : null}
                {details?.currentQuestionId ? (
                  <Badge variant="neutral">question_id: {details.currentQuestionId}</Badge>
                ) : null}
                {details?.responseType ? (
                  <Badge variant={responseTypeVariant(details.responseType)}>type: {details.responseType}</Badge>
                ) : null}
                {details?.redactedForLlm !== undefined ? (
                  <Badge variant={details.redactedForLlm ? "success" : "neutral"}>
                    redacted for LLM: {String(details.redactedForLlm)}
                  </Badge>
                ) : null}
                {details?.redactionsApplied?.length ? (
                  <Badge variant="success">redactions: {details.redactionsApplied.join(", ")}</Badge>
                ) : null}
                {details?.missingRequiredQuestions?.length ? (
                  <Badge variant="warning">
                    missing: {details.missingRequiredQuestions.length}
                  </Badge>
                ) : null}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
