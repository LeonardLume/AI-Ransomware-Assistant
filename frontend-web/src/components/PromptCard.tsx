import { ArrowUp, ListChecks, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { SessionPath } from "../types/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "./ui-helpers";

const animatedPrompts = [
  "Check whether backups can be restored after ransomware...",
  "Review MFA coverage for email and admin accounts...",
  "List evidence needed for the action plan...",
  "Ask what to fix in the next 14 days...",
];

export default function PromptCard({
  placeholder = "Ask the assistant or start a ransomware readiness assessment...",
  sending,
  onSubmit,
  onStartPath,
}: {
  placeholder?: string;
  sending?: boolean;
  onSubmit: (message: string, path?: SessionPath) => void;
  onStartPath?: (path: SessionPath) => void;
}) {
  const [value, setValue] = useState("");
  const [animatedText, setAnimatedText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    if (value) {
      return;
    }

    const fullText =
      animatedPrompts[promptIndex % animatedPrompts.length] || placeholder;

    let index = 0;
    setAnimatedText("");

    const typing = window.setInterval(() => {
      index += 1;
      setAnimatedText(fullText.slice(0, index));

      if (index >= fullText.length) {
        window.clearInterval(typing);
        window.setTimeout(() => {
          setPromptIndex((current) => current + 1);
        }, 1800);
      }
    }, 65);

    return () => window.clearInterval(typing);
  }, [promptIndex, value, placeholder]);

  function submit(path: SessionPath = "questionnaire") {
    const message = value.trim();
    if (!message || sending) {
      return;
    }
    setValue("");
    onSubmit(message, path);
  }

  function choosePath(path: SessionPath) {
    if (sending) {
      return;
    }
    const message = value.trim();
    if (message) {
      submit(path);
      return;
    }
    onStartPath?.(path);
  }

  const showAnimatedPrompt = !value && animatedText;

  return (
    <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-black/50 bg-[#222321] p-5 text-left shadow-[0_34px_90px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="relative">
        {showAnimatedPrompt && (
          <div className="pointer-events-none absolute left-0 top-0 select-none text-lg leading-8 text-slate-200/45">
            {animatedText}
            <span className="ml-0.5 text-slate-500/30">|</span>
          </div>
        )}

        <textarea
          value={value}
          disabled={sending}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder=""
          className="min-h-[86px] w-full resize-none border-0 bg-transparent text-lg leading-8 text-slate-100/90 caret-slate-200 outline-none ring-0 shadow-none focus:border-transparent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={sending}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-200 transition hover:border-white/20 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-55"
              aria-label="Choose session path"
              title="Choose session path"
            >
              <Plus className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-[min(90vw,21rem)] p-2">
            <DropdownMenuLabel>Session path</DropdownMenuLabel>
            <PathChoice
              icon={ShieldCheck}
              title="Recovery Proof"
              description="Start an evidence-first recovery proof session."
              onSelect={() => choosePath("recovery-proof")}
            />
            <PathChoice
              icon={ListChecks}
              title="Questionnaire"
              description="Start the legacy questions-to-report session."
              onSelect={() => choosePath("questionnaire")}
            />
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={() => submit()}
          disabled={sending || !value.trim()}
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-full transition",
            value.trim()
              ? "bg-white text-slate-950 shadow-[0_12px_28px_rgba(255,255,255,0.18)] hover:bg-slate-100"
              : "bg-white/35 text-slate-950/60",
            (sending || !value.trim()) && "cursor-not-allowed opacity-60",
          )}
          aria-label="Send message"
          title="Send"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function PathChoice({
  icon: Icon,
  title,
  description,
  onSelect,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="items-start gap-3 px-3 py-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-100">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </DropdownMenuItem>
  );
}
