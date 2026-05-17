import { SendHorizontal } from "lucide-react";
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
    <div className="chat-composer-shell rounded-[26px] p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
      <div className="flex items-end gap-2 rounded-[22px] border border-white/80 bg-white/[0.03] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl">
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
          className="max-h-32 min-h-[42px] flex-1 border-0 bg-transparent px-2.5 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:text-slate-600"
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={send}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-sky-500 dark:shadow-[0_14px_34px_rgba(14,165,233,0.2)] dark:hover:bg-sky-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          aria-label="Send message"
          title="Send"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
