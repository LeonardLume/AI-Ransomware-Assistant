import { HelpCircle, SendHorizontal } from "lucide-react";
import { useState } from "react";
import type { AssessmentAnswer, ChatRequestOptions, Question } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

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

const llmInfoCopy: Record<
  UiLanguage,
  {
    triggerLabel: string;
    title: string;
    description: string;
    sections: Array<{ title: string; text: string }>;
  }
> = {
  et: {
    triggerLabel: "Kuidas AI töötab",
    title: "Kuidas AI töötab",
    description: "Avatud tehniline ülevaade: kuidas kasutaja vastus liigub LLM-i, backend'i valideerimise ja raportini.",
    sections: [
      {
        title: "1. Kasutaja vastus",
        text: "Kui kirjutad vabateksti või valid kiirvastuse, saadab UI selle backend'i /chat endpoint'i koos sessiooni ID, praeguse küsimuse ja vajadusel selected_answer väärtusega.",
      },
      {
        title: "2. LLM-i töö",
        text: "LLM-i kasutatakse abilisena: ta selgitab mõisteid, tuvastab kasutaja kavatsuse ja pakub kandidaate stiilis question_id + answer. Ta ei kirjuta otse lõplikku olekut ega muuda scoring rules faile.",
      },
      {
        title: "3. Backend'i kontroll",
        text: "FastAPI kontrollib, kas question_id on olemas, kas vastus on lubatud valik yes/partial/no/unsure ja kas vastus sobib aktiivse intervjuu konteksti. Alles seejärel salvestatakse struktureeritud vastus sessiooni.",
      },
      {
        title: "4. Skoor ja allikad",
        text: "Skoor, riskitase, domeenide edenemine ja raport arvutatakse backend'is questions.json, scoring_rules, domain metadata, source notes, skills ja evidence checklist andmete põhjal. LLM võib teksti selgitada, kuid ametlik arvutus on reeglipõhine.",
      },
      {
        title: "5. Piirangud",
        text: "Rakendus ei tee skaneerimist, OSINT-i, Shodani/Censysi/HIBP päringuid ega väliseid turvakontrolle. Kui raport on osaline, tähendab see, et kõik vajalikud küsimused pole veel vastatud.",
      },
    ],
  },
  en: {
    triggerLabel: "How AI works",
    title: "How AI Works",
    description: "Open technical overview: how a user answer moves through the LLM, backend validation, and report output.",
    sections: [
      {
        title: "1. User answer",
        text: "When you type free text or choose a quick answer, the UI sends it to the backend /chat endpoint with the session ID, current question, and selected_answer when available.",
      },
      {
        title: "2. LLM work",
        text: "The LLM acts as an assistant: it explains concepts, detects intent, and proposes candidates like question_id + answer. It does not directly write final state or change scoring rule files.",
      },
      {
        title: "3. Backend validation",
        text: "FastAPI checks that the question_id exists, the answer is one of yes/partial/no/unsure, and the answer fits the active interview context. Only then is the structured answer stored in the session.",
      },
      {
        title: "4. Scoring and sources",
        text: "Score, risk level, domain progress, and reports are calculated in the backend from questions.json, scoring_rules, domain metadata, source notes, skills, and evidence checklist data. The LLM can explain text, but official calculation is rule-based.",
      },
      {
        title: "5. Limits",
        text: "The app performs no scanning, OSINT, Shodan/Censys/HIBP lookup, or external security checks. If the report is partial, it means not all required questions have been answered yet.",
      },
    ],
  },
  ru: {
    triggerLabel: "Как работает AI",
    title: "Как работает AI",
    description: "Открытый технический обзор: как ответ пользователя проходит через LLM, backend validation и отчет.",
    sections: [
      {
        title: "1. Ответ пользователя",
        text: "Когда вы пишете свободный текст или выбираете быстрый ответ, UI отправляет это в backend endpoint /chat вместе с ID сессии, текущим вопросом и selected_answer, если он есть.",
      },
      {
        title: "2. Работа LLM",
        text: "LLM работает как помощник: объясняет термины, определяет intent и предлагает кандидаты вида question_id + answer. Она не записывает финальное состояние напрямую и не меняет scoring rules файлы.",
      },
      {
        title: "3. Проверка backend",
        text: "FastAPI проверяет, что question_id существует, ответ входит в yes/partial/no/unsure и подходит к активному контексту интервью. Только после этого структурированный ответ сохраняется в сессии.",
      },
      {
        title: "4. Score и источники",
        text: "Score, уровень риска, прогресс доменов и отчет считаются в backend на основе questions.json, scoring_rules, domain metadata, source notes, skills и evidence checklist data. LLM может объяснять текст, но официальный расчет rule-based.",
      },
      {
        title: "5. Ограничения",
        text: "Приложение не делает scanning, OSINT, запросы Shodan/Censys/HIBP или внешние security checks. Если отчет partial, значит еще не все обязательные вопросы отвечены.",
      },
    ],
  },
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
        <LlmInfoDialog language={language} />
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

function LlmInfoDialog({ language }: { language: UiLanguage }) {
  const copy = llmInfoCopy[language];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100 transition-colors hover:border-cyan-300/35 hover:bg-cyan-300/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          aria-label={copy.triggerLabel}
          title={copy.triggerLabel}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="w-[min(94vw,42rem)] max-w-none rounded-[28px] border-white/[0.12] bg-[#07090d]/95 p-0"
        overlayClassName="bg-black/60 backdrop-blur-md"
        aria-describedby="llm-info-description"
      >
        <div className="border-b border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-6 py-5 pr-14">
          <DialogTitle className="text-2xl font-semibold tracking-[-0.045em] text-white">
            {copy.title}
          </DialogTitle>
          <DialogDescription id="llm-info-description" className="mt-2 text-sm leading-6 text-slate-400">
            {copy.description}
          </DialogDescription>
        </div>
        <div className="px-5 py-5 sm:px-6">
          <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.025]">
            {copy.sections.map((section) => (
              <section
                key={section.title}
                className="grid gap-3 border-b border-white/[0.06] px-4 py-4 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)]"
              >
                <h3 className="text-sm font-semibold leading-6 text-white">{section.title}</h3>
                <p className="text-sm leading-6 text-slate-400">{section.text}</p>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
