import { Circle, SendHorizontal } from "lucide-react";
import { useState } from "react";
import type { AssessmentAnswer, ChatIntentMode, ChatRequestOptions, Question } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";

const answerLabels: Record<UiLanguage, Record<AssessmentAnswer, string>> = {
  et: { yes: "Jah", partial: "Osaliselt", no: "Ei", unsure: "Ei tea" },
  en: { yes: "Yes", partial: "Partial", no: "No", unsure: "Unsure" },
  ru: { yes: "Да", partial: "Частично", no: "Нет", unsure: "Не знаю" },
};

const modeLabels: Record<UiLanguage, Record<ChatIntentMode, string>> = {
  et: {
    auto: "Auto",
    direct_answer: "Vastus",
    clarification: "Küsi / selgita",
    context_note: "Lisa kontekst",
    advisory: "Küsi AI-lt",
  },
  en: {
    auto: "Auto",
    direct_answer: "Answer",
    clarification: "Ask / clarify",
    context_note: "Add context",
    advisory: "Ask AI",
  },
  ru: {
    auto: "Авто",
    direct_answer: "Ответ",
    clarification: "Спросить / уточнить",
    context_note: "Добавить контекст",
    advisory: "Спросить AI",
  },
};

const modeHelp: Record<UiLanguage, Record<ChatIntentMode, string>> = {
  et: {
    auto: "Backend otsustab semantiliselt.",
    direct_answer: "Salvesta ainult selge hindamisvastus.",
    clarification: "Küsimus jääb samaks.",
    context_note: "Ei mõjuta skoori.",
    advisory: "Nõuanne ilma skoori muutmata.",
  },
  en: {
    auto: "Backend decides semantically.",
    direct_answer: "Save only a clear assessment answer.",
    clarification: "Current question stays unchanged.",
    context_note: "Does not affect score.",
    advisory: "Advice without changing score.",
  },
  ru: {
    auto: "Backend решает семантически.",
    direct_answer: "Сохранить только ясный assessment-ответ.",
    clarification: "Текущий вопрос не двигается.",
    context_note: "Не влияет на score.",
    advisory: "Совет без изменения score.",
  },
};

const quickAnswers: AssessmentAnswer[] = ["yes", "partial", "no", "unsure"];
const intentModes: ChatIntentMode[] = ["auto", "direct_answer", "clarification", "context_note", "advisory"];
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
  const [intentMode, setIntentMode] = useState<ChatIntentMode>("auto");
  const canSend = value.trim().length > 0 && !disabled;

  function send() {
    const message = value.trim();
    if (!message || disabled) {
      return;
    }
    setValue("");
    onSend(message, intentMode === "auto" ? {} : { intent_mode: intentMode });
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
    <div className="chat-composer-shell space-y-2.5 rounded-[30px] border border-white/10 bg-[rgba(15,17,24,0.78)] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
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

      <div className="flex flex-wrap items-center gap-2 px-1">
        {intentModes.map((mode) => {
          const active = intentMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              title={modeHelp[language][mode]}
              onClick={() => setIntentMode(mode)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                active
                  ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                  : "border-white/8 bg-white/[0.025] text-slate-400 hover:border-white/16 hover:text-slate-200",
              ].join(" ")}
            >
              {modeLabels[language][mode]}
            </button>
          );
        })}
      </div>

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
