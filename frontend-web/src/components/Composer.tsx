import { SendHorizontal } from "lucide-react";
import { useState } from "react";

export default function Composer({
  disabled,
  onSend,
}: {
  disabled?: boolean;
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
    <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-end gap-2 rounded-lg border border-slate-300 bg-white p-2 shadow-[0_10px_28px_rgba(15,23,42,0.08)] focus-within:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_18px_40px_rgba(0,0,0,0.28)] dark:focus-within:border-sky-500">
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
          placeholder="Write an answer or ask for an explanation. A new session starts automatically if needed..."
          className="max-h-32 min-h-[44px] flex-1 border-0 bg-transparent px-2 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:text-slate-600"
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={send}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-sky-500 dark:hover:bg-sky-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          aria-label="Send message"
          title="Send"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
