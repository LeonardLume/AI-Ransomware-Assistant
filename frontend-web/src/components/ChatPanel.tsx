import { Play, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ArtifactId, UiMessage } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import Composer from "./Composer";
import MessageBubble from "./MessageBubble";
import { Alert, Button, EmptyState, LoadingSteps } from "./ui";

export default function ChatPanel({
  messages,
  language = "et",
  sending,
  error,
  onStart,
  onSend,
  onRetry,
  onOpenArtifact,
  onCreateReport,
}: {
  messages: UiMessage[];
  language?: UiLanguage;
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
    <section className="chat-panel-shell relative flex min-h-[560px] flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[rgba(8,11,18,0.54)] shadow-[0_34px_90px_rgba(0,0,0,0.38)] backdrop-blur-[28px] lg:h-full lg:min-h-0">
      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto bg-black/8 px-4 py-4 sm:px-5">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 pb-6">
        {!messages.length ? (
            <div className="flex min-h-[360px] items-center justify-center py-6">
            <EmptyState
              title={t(language, "chatEmptyTitle")}
              description={t(language, "chatEmptyDescription")}
              icon={<Play className="h-5 w-5" />}
              action={
                <Button type="button" variant="primary" onClick={onStart} disabled={sending}>
                  <Play className="h-4 w-4" />
                  {t(language, "startNewAssessment")}
                </Button>
              }
            />
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              language={language}
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
            <div className="font-semibold">{t(language, "backendError")}</div>
            <p className="mt-1 leading-6">{error}</p>
            <Button type="button" variant="danger" onClick={onRetry} className="mt-3">
              <RefreshCw className="h-4 w-4" />
              {t(language, "retryLastMessage")}
            </Button>
          </Alert>
        ) : null}
        <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-white/8 bg-black/10 px-4 py-3 sm:px-5">
        <div className="mx-auto w-full max-w-4xl">
          <Composer disabled={sending} language={language} onSend={onSend} />
        </div>
      </div>
    </section>
  );
}
