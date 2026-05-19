import { memo } from "react";
import ReactMarkdown from "react-markdown";
import type { ArtifactId, UiMessage } from "../types/api";
import type { UiLanguage } from "../utils/i18n";
import AssistantTechnicalDetails from "./AssistantTechnicalDetails";
import { Card } from "./ui";
import { cn } from "./ui-helpers";

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function answerTypeLabel(value?: string): string {
  const labels: Record<string, string> = {
    interview_question: "Interview question",
    interview_answer: "Assessment answer",
    client_question: "Clarification",
    clarification: "Clarifying follow-up",
    general_advisory_chat: "General advisory",
    knowledge_grounded_answer: "Grounded answer",
    smalltalk: "Smalltalk",
    guardrail: "Safety refusal",
    prompt_injection_blocked: "Prompt injection blocked",
    report: "Report",
    report_request_blocked: "Report blocked",
  };
  return labels[String(value || "")] || "Assistant reply";
}

function answerStatusLabel(value?: string): string {
  const labels: Record<string, string> = {
    saved_and_advanced: "Saved answer; moved to next question",
    answer_saved: "Saved answer",
    question_unchanged: "Current question unchanged",
    followup_requested: "Waiting for clarification",
    question_presented: "Current interview question",
    report_ready: "Report prepared",
    blocked: "Blocked by backend policy",
    info_only: "Informational reply",
  };
  return labels[String(value || "")] || "Informational reply";
}

function compactAnswerLabel(value?: string): string {
  const labels: Record<string, string> = {
    yes: "yes",
    partial: "partial",
    no: "no",
    unsure: "unsure",
  };
  return labels[String(value || "")] || String(value || "");
}

function MessageBubble({
  message,
  onOpenArtifact,
  language = "et",
  showTechnicalDetails = false,
}: {
  message: UiMessage;
  onOpenArtifact?: (artifact: ArtifactId) => void;
  language?: UiLanguage;
  showTechnicalDetails?: boolean;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const compactUserAnswer =
    isUser && message.content.trim().length <= 56 && !message.content.includes("\n");
  const toneClass = isUser
    ? "chat-bubble-user !text-white"
    : isSystem
      ? "chat-bubble-system !text-amber-100"
      : "chat-bubble-assistant !text-slate-100";
  const transparency = !isUser && !isSystem ? message.assistantTransparency : undefined;
  const visibleSources = (transparency?.sources || []).slice(0, 3);
  const hiddenSourceCount = Math.max(
    0,
    (transparency?.sources || []).length - visibleSources.length,
  );
  const savedAnswers = (transparency?.saved_answers || []).slice(0, 2);

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <Card
        className={cn(
          "chat-bubble w-full px-4 py-3.5",
          isUser
            ? compactUserAnswer
              ? "max-w-fit px-5 py-3"
              : "max-w-[min(360px,92%)] px-5 py-4"
            : isSystem
              ? "max-w-[min(720px,100%)] border-white/8 shadow-[0_18px_50px_rgba(0,0,0,0.16)]"
              : "max-w-[min(820px,100%)] border-transparent bg-transparent px-0 py-0 shadow-none",
          toneClass,
        )}
      >
        {isSystem ? (
          <div className="mb-1.5 text-[11px] font-medium tracking-[0.02em] text-amber-200/80">
            System <span className="mx-1 text-white/20">•</span> {formatTime(message.timestamp)}
          </div>
        ) : null}

        <div
          className={cn(
            "markdown-body text-inherit",
            isUser ? "text-[15px] font-medium leading-7" : "text-[15px] leading-8",
          )}
        >
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {transparency ? (
          <div className="mt-3 text-[11px] text-slate-400">
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 backdrop-blur-md">
                Type: {answerTypeLabel(transparency.answer_type)}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 backdrop-blur-md">
                Status: {answerStatusLabel(transparency.answer_status)}
              </span>
              {savedAnswers.map((item) => (
                <span
                  key={`${item.question_id}-${item.answer}`}
                  className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/12 px-2 py-1 text-[11px] text-cyan-100 backdrop-blur-md"
                  title={item.question_id}
                >
                  Saved: {compactAnswerLabel(item.answer)}
                </span>
              ))}
            </div>
            {visibleSources.length ? (
              <div className="mt-2 leading-5 text-slate-400/95">
                <span className="text-slate-500">Based on:</span>{" "}
                {visibleSources.map((source, index) => (
                  <span key={`${source.label}-${source.url || index}`}>
                    {index > 0 ? <span className="text-slate-500"> • </span> : null}
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-200 transition-colors hover:text-cyan-100"
                        title={source.kind || source.label}
                      >
                        {source.label}
                      </a>
                    ) : (
                      <span title={source.kind || source.label} className="text-slate-300">
                        {source.label}
                      </span>
                    )}
                  </span>
                ))}
                {hiddenSourceCount > 0 ? (
                  <span className="text-slate-500"> • +{hiddenSourceCount} more</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {!isUser && showTechnicalDetails ? (
          <AssistantTechnicalDetails
            details={message.technicalDetails}
            artifacts={message.openedArtifacts}
            language={language}
            onOpenArtifact={onOpenArtifact}
          />
        ) : null}
      </Card>
    </div>
  );
}

export default memo(MessageBubble);
