import { Play, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ArtifactId, UiMessage } from "../types/api";
import Composer from "./Composer";
import MessageBubble from "./MessageBubble";
import { Alert, Button, EmptyState, LoadingSteps } from "./ui";

export default function ChatPanel({
  messages,
  quickActions,
  currentDomain,
  sending,
  error,
  onStart,
  onSend,
  onRetry,
  onOpenArtifact,
  onCreateReport,
}: {
  messages: UiMessage[];
  quickActions: string[];
  currentDomain?: string | null;
  sending: boolean;
  error?: string | null;
  onStart: () => void;
  onSend: (message: string) => void;
  onRetry: () => void;
  onOpenArtifact: (artifact: ArtifactId) => void;
  onCreateReport?: () => void;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  return (
    <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/35 shadow-[0_28px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl lg:h-full lg:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/25 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-white">Interview</h2>
          <p className="mt-0.5 text-xs text-white/55">{currentDomain || "standard assessment"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={onStart} disabled={sending}>
            <Play className="h-4 w-4" />
            Start new assessment
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
        {quickActions.map((action) => (
          <Button
            type="button"
            key={action}
            variant="secondary"
            onClick={() => {
              const normalized = action.toLowerCase();
              if ((normalized === "create report" || normalized === "koosta raport") && onCreateReport) {
                onCreateReport();
                return;
              }
              onSend(action);
            }}
            disabled={sending}
            className="rounded-full px-3 py-1.5 text-xs"
          >
            {action}
          </Button>
        ))}
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 space-y-4 overflow-y-auto bg-black/20 p-4 pb-8">
        {!messages.length ? (
          <div className="flex h-full min-h-[360px] items-center justify-center">
            <EmptyState
              title="Start a defensive readiness assessment"
              description="Start the interview. The backend controls questions, validation, scoring, and reports."
              icon={<Play className="h-5 w-5" />}
              action={
                <Button type="button" variant="primary" onClick={onStart} disabled={sending}>
                  <Play className="h-4 w-4" />
                  Start new assessment
                </Button>
              }
            />
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onOpenArtifact={onOpenArtifact}
            />
          ))
        )}

        {sending ? (
          <div className="flex justify-start">
            <LoadingSteps />
          </div>
        ) : null}

        {error ? (
          <Alert tone="danger">
            <div className="font-semibold">Backend error</div>
            <p className="mt-1 leading-6">{error}</p>
            <Button type="button" variant="danger" onClick={onRetry} className="mt-3">
              <RefreshCw className="h-4 w-4" />
              Retry last message
            </Button>
          </Alert>
        ) : null}
        <div ref={endRef} />
      </div>

      <Composer disabled={sending} onSend={onSend} />
    </section>
  );
}
