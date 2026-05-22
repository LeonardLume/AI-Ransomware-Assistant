import { ChevronDown, ChevronUp, Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArtifactId, ChatRequestOptions, Question, UiMessage } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import Composer from "./Composer";
import MessageBubble from "./MessageBubble";
import { Alert, Button, EmptyState, LoadingSteps } from "./ui";

export default function ChatPanel({
  messages,
  language = "et",
  currentQuestion,
  sending,
  error,
  onStart,
  onSend,
  onRetry,
  onOpenArtifact,
}: {
  messages: UiMessage[];
  language?: UiLanguage;
  currentQuestion?: Question | null;
  sending: boolean;
  error?: string | null;
  onStart: () => void;
  onSend: (message: string, options?: ChatRequestOptions) => void;
  onRetry: () => void;
  onOpenArtifact: (artifact: ArtifactId) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const updateScrollControls = useCallback(() => {
    scrollFrameRef.current = null;
    const node = scrollRef.current;
    if (!node) {
      setShowScrollUp(false);
      setShowScrollDown(false);
      return;
    }
    const isScrollable = node.scrollHeight - node.clientHeight > 120;
    if (!isScrollable) {
      setShowScrollUp(false);
      setShowScrollDown(false);
      return;
    }
    const nextShowScrollUp = node.scrollTop > 80;
    const nextShowScrollDown = node.scrollTop + node.clientHeight < node.scrollHeight - 80;
    setShowScrollUp((current) => (current === nextShowScrollUp ? current : nextShowScrollUp));
    setShowScrollDown((current) => (current === nextShowScrollDown ? current : nextShowScrollDown));
  }, []);

  const scheduleScrollControlUpdate = useCallback(() => {
    if (scrollFrameRef.current !== null) {
      return;
    }
    scrollFrameRef.current = window.requestAnimationFrame(updateScrollControls);
  }, [updateScrollControls]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  useEffect(() => {
    const timer = window.setTimeout(updateScrollControls, 120);
    return () => window.clearTimeout(timer);
  }, [messages.length, sending, updateScrollControls]);

  useEffect(() => {
    window.addEventListener("resize", updateScrollControls);
    return () => {
      window.removeEventListener("resize", updateScrollControls);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, [updateScrollControls]);

  return (
    <section className="chat-panel-shell relative flex min-h-[560px] flex-col overflow-hidden bg-transparent shadow-none lg:h-full lg:min-h-0">
      {showScrollUp ? (
        <button
          type="button"
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="absolute left-3 top-20 z-10 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[rgba(8,11,18,0.92)] text-slate-200 shadow-[0_12px_28px_rgba(0,0,0,0.28)] transition-colors hover:border-white/20 hover:text-white"
          aria-label="Scroll chat to top"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      ) : null}
      {showScrollDown ? (
        <button
          type="button"
          onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
          className="absolute bottom-24 left-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[rgba(8,11,18,0.92)] text-slate-200 shadow-[0_12px_28px_rgba(0,0,0,0.28)] transition-colors hover:border-white/20 hover:text-white"
          aria-label="Scroll chat to bottom"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      ) : null}
      <div
        ref={scrollRef}
        onScroll={scheduleScrollControlUpdate}
        className="scrollbar-slim min-h-0 flex-1 overflow-y-auto bg-transparent px-5 py-8 sm:px-7"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-10">
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

      <div className="chat-composer-band border-t border-transparent bg-transparent px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <Composer
            disabled={sending}
            language={language}
            currentQuestion={currentQuestion}
            onSend={onSend}
          />
        </div>
      </div>
    </section>
  );
}
