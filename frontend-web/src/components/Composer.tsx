import { Circle, SendHorizontal } from "lucide-react";
import { useState } from "react";
import { t, type UiLanguage } from "../utils/i18n";

export default function Composer({
  disabled,
  language = "et",
  onSend,
}: {
  disabled?: boolean;
  language?: UiLanguage;
  onSend: (message: string) => void;
}) {
  const [value, setValue] = useState("");
  const canSend = value.trim().length > 0 && !disabled;

  function send() {
    const message = value.trim();
    if (!message || disabled) {
      return;
    }
    setValue("");
    onSend(message);
  }

  return (
    <div className="chat-composer-shell rounded-[999px] border border-white/10 bg-[rgba(15,17,24,0.78)] p-2.5 shadow-[0_28px_90px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
      <div className="flex items-center gap-3 rounded-[999px] bg-white/[0.02] px-2.5 py-1.5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-sky-300">
          <Circle className="h-3 w-3 fill-current stroke-0" />
        </span>
        <textarea
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={t(language, "composerPlaceholder")}
          className="max-h-32 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[15px] leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={send}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-[0_14px_34px_rgba(14,165,233,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-600 disabled:shadow-none"
          aria-label="Send message"
          title="Send"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
