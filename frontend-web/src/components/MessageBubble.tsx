import ReactMarkdown from "react-markdown";
import type { ArtifactId, UiMessage } from "../types/api";
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
  showTechnicalDetails = false,
}: {
  message: UiMessage;
  onOpenArtifact?: (artifact: ArtifactId) => void;
  showTechnicalDetails?: boolean;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const toneClass = isUser
    ? "!border-sky-500/70 !bg-sky-600 !text-white shadow-[0_16px_36px_rgba(2,132,199,0.24)]"
    : isSystem
      ? "!border-amber-500/40 !bg-amber-950/40 !text-amber-100"
      : "!border-slate-800 !bg-slate-900/90 !text-slate-100";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <Card className={cn("max-w-[min(760px,92%)] px-4 py-3", toneClass)}>
        <div
          className={cn(
            "mb-1 text-xs font-medium",
            isUser ? "!text-sky-100" : isSystem ? "!text-amber-200" : "!text-slate-400",
          )}
        >
          {isUser ? "You" : isSystem ? "System" : "Assistant"} - {formatTime(message.timestamp)}
        </div>
        <div className="markdown-body text-sm leading-6">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {!isUser && showTechnicalDetails ? (
          <AssistantTechnicalDetails
            details={message.technicalDetails}
            artifacts={message.openedArtifacts}
            onOpenArtifact={onOpenArtifact}
          />
        ) : null}
      </Card>
    </div>
  );
}
