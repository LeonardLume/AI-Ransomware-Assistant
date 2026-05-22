import { Circle, SendHorizontal } from "lucide-react";
import { useState } from "react";
import type { AssessmentAnswer, ChatRequestOptions, Question } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";

const answerLabels: Record<UiLanguage, Record<AssessmentAnswer, string>> = {
  et: { yes: "Jah", partial: "Osaliselt", no: "Ei", unsure: "Ei tea" },
  en: { yes: "Yes", partial: "Partial", no: "No", unsure: "Unsure" },
  ru: { yes: "Да", partial: "Частично", no: "Нет", unsure: "Не знаю" },
};

const quickAnswers: AssessmentAnswer[] = ["yes", "partial", "no", "unsure"];
const quickAnswerLabel: Record<UiLanguage, string> = {
  et: "Kiirvastus",
  en: "Quick answer",
  ru: "Быстрый ответ",
};

export default function Composer({
  disabled,
  language = "et",
  currentQuestion,
  onSend,
}: {
  disabled?: boolean;
  language?: UiLanguage;
  currentQuestion?: Question | null;
  onSend: (message: string, options?: ChatRequestOptions) => void;
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

  function sendQuickAnswer(answer: AssessmentAnswer) {
    if (disabled) {
      return;
    }
    onSend(answerLabels[language][answer], {
      intent_mode: "direct_answer",
      selected_answer: answer,
    });
  }

  return (
    <div className="chat-composer-shell space-y-2.5 p-3">
      {currentQuestion ? (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {quickAnswerLabel[language]}
          </span>
          {quickAnswers.map((answer) => (
            <button
              key={answer}
              type="button"
              disabled={disabled}
              onClick={() => sendQuickAnswer(answer)}
              className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all duration-200 hover:border-cyan-300/35 hover:bg-cyan-300/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {answerLabels[language][answer]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-3 rounded-[999px] border border-white/10 bg-white/[0.05] px-2.5 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-sky-300">
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
