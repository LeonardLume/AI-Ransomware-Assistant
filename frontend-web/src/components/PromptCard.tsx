import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { cn } from "./ui";

export default function PromptCard({
  placeholder = "Ask the assistant or start a ransomware readiness assessment...",
  sending,
  onSubmit,
}: {
  placeholder?: string;
  sending?: boolean;
  onSubmit: (message: string) => void;
  onStart: () => void;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const message = value.trim();
    if (!message || sending) {
      return;
    }
    setValue("");
    onSubmit(message);
  }

  return (
    <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-black/50 bg-[#222321] p-5 text-left shadow-[0_34px_90px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.08)]">
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
        placeholder={placeholder}
        className="min-h-[86px] w-full resize-none border-0 bg-transparent text-lg leading-8 text-white outline-none placeholder:text-white/48 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={submit}
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
