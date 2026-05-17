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

export default function MessageBubble({
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

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <Card
        className={cn(
          "chat-bubble w-full border-white/8 px-4 py-3.5 shadow-[0_18px_50px_rgba(0,0,0,0.16)]",
          compactUserAnswer ? "max-w-fit px-3.5 py-2.5" : "max-w-[min(720px,100%)]",
          toneClass,
        )}
      >
        <div
          className={cn(
            "mb-1.5 text-[11px] font-medium tracking-[0.02em]",
            isUser ? "!text-sky-100/78" : isSystem ? "!text-amber-200/80" : "!text-slate-400",
          )}
        >
          {isUser ? "You" : isSystem ? "System" : "Assistant"} <span className="mx-1 text-white/20">•</span> {formatTime(message.timestamp)}
        </div>
        <div className={cn("markdown-body text-sm text-inherit", compactUserAnswer ? "leading-5" : "leading-6")}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
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
