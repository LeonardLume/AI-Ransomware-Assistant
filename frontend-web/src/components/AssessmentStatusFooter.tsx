import { useState } from "react";
import type {
  AnswerRecord,
  ChatResponse,
  Question,
  ScoreResponse,
  SessionStateResponse,
} from "../types/api";
import { domainLabel, t, valueLabel, type UiLanguage } from "../utils/i18n";
import { Progress } from "./ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

function compact(value: unknown, fallback = "-"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

type ProgressOverlayMode = "domains" | "questions";

export default function AssessmentStatusFooter({
  session,
  score,
  lastResponse,
  questions,
  language = "et",
}: {
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  lastResponse?: ChatResponse | null;
  questions: Question[];
  language?: UiLanguage;
}) {
  const [activeProgressOverlay, setActiveProgressOverlay] =
    useState<ProgressOverlayMode | null>(null);
  const completionRate =
    session?.progress?.completion_rate ?? lastResponse?.completion_rate ?? score?.completion_rate ?? 0;
  const currentQuestion =
    lastResponse?.current_question ||
    questions.find((question) => question.id === session?.current_question_id) ||
    null;
  const currentDomain = session?.current_domain || lastResponse?.current_domain || currentQuestion?.domain;
  const requiredQuestions = questions.filter((question) => question.required !== false);
  const requiredQuestionIds = new Set(requiredQuestions.map((question) => question.id));
  const answeredRequiredQuestionIds = new Set(
    Object.keys(session?.answers || {}).filter((questionId) => requiredQuestionIds.has(questionId)),
  );
  const totalRequiredQuestions =
    session?.progress?.total_required ?? score?.total_questions ?? requiredQuestions.length;
  const answeredRequiredQuestions = clampCount(
    session?.progress?.answered_required ?? score?.answered_questions ?? answeredRequiredQuestionIds.size,
    totalRequiredQuestions,
  );
  const domainProgress = getDomainProgress(requiredQuestions, answeredRequiredQuestionIds, score);
  const progressItems = buildQuestionProgressItems(
    requiredQuestions,
    session?.answers || {},
    currentQuestion?.id,
  );
  const scoreStatus =
    completionRate <= 0
      ? "not ready"
      : score?.score_status || (session?.progress?.is_complete ? "final" : "preliminary");

  return (
    <footer className="sticky bottom-0 z-20 mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#07080b]/95 shadow-[0_-18px_54px_rgba(0,0,0,0.38)] backdrop-blur-xl">
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-center">
        <button
          type="button"
          className="min-w-0 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-left transition-colors hover:border-cyan-300/35 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/55"
          onClick={() => setActiveProgressOverlay("questions")}
          aria-label={progressOpenLabel(language, "questions")}
          aria-haspopup="dialog"
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-400">
            <span>{t(language, "completion")}</span>
            <span className="font-semibold text-white">{completionRate}%</span>
          </div>
          <Progress value={completionRate} tone={completionRate === 100 ? "success" : "info"} />
        </button>

        <div className="grid min-w-0 gap-2 text-xs text-slate-400 md:grid-cols-2 xl:grid-cols-[minmax(160px,0.9fr)_minmax(0,2.55fr)_minmax(112px,0.72fr)_minmax(112px,0.72fr)]">
          <StatusItem
            label={footerLabel(language, "domain")}
            value={domainLabel(language, currentDomain)}
            ariaLabel={progressOpenLabel(language, "domains")}
            onClick={() => setActiveProgressOverlay("domains")}
          />
          <StatusItem
            label={footerLabel(language, "question")}
            value={currentQuestion?.question || compact(session?.current_question_id)}
            ariaLabel={progressOpenLabel(language, "questions")}
            onClick={() => setActiveProgressOverlay("questions")}
            emphasized
          />
          <StatusItem label={footerLabel(language, "score")} value={valueLabel(language, scoreStatus)} />
          <StatusItem
            label={footerLabel(language, "answers")}
            value={`${answeredRequiredQuestions}/${totalRequiredQuestions}`}
            ariaLabel={progressOpenLabel(language, "questions")}
            onClick={() => setActiveProgressOverlay("questions")}
          />
        </div>
      </div>
      <Dialog
        open={Boolean(activeProgressOverlay)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveProgressOverlay(null);
          }
        }}
      >
        {activeProgressOverlay ? (
          <AssessmentProgressOverlay
            mode={activeProgressOverlay}
            language={language}
            items={progressItems}
            domainProgress={domainProgress}
            answeredQuestions={answeredRequiredQuestions}
            totalQuestions={totalRequiredQuestions}
          />
        ) : null}
      </Dialog>
    </footer>
  );
}

function footerLabel(
  language: UiLanguage,
  key: "domain" | "question" | "score" | "answers",
): string {
  const labels = {
    et: {
      domain: "Domeen",
      question: "Kusimus",
      score: "Tulemus",
      answers: "Vastused",
    },
    en: {
      domain: "Domain",
      question: "Question",
      score: "Score",
      answers: "Answers",
    },
    ru: {
      domain: "Домен",
      question: "Вопрос",
      score: "Оценка",
      answers: "Ответы",
    },
  };
  return labels[language][key];
}

type QuestionProgressItem = {
  id: string;
  domain: string;
  question: string;
  answer?: string;
  answered: boolean;
  current: boolean;
};

function buildQuestionProgressItems(
  questions: Question[],
  answers: Record<string, AnswerRecord>,
  currentQuestionId?: string | null,
): QuestionProgressItem[] {
  return questions.map((question) => {
    const answer = compact(answers[question.id]?.answer, "");
    return {
      id: question.id,
      domain: question.domain || "unknown",
      question: question.question,
      answer: answer || undefined,
      answered: Boolean(answer),
      current: question.id === currentQuestionId,
    };
  });
}

function clampCount(value: number | undefined, total: number): number {
  const safeValue = Math.max(0, Number(value ?? 0));
  if (total <= 0) {
    return safeValue;
  }
  return Math.min(safeValue, total);
}

function getDomainProgress(
  questions: Question[],
  answeredQuestionIds: Set<string>,
  score?: ScoreResponse | null,
): { completed: number; total: number } {
  const domains = new Map<string, { answered: number; total: number }>();

  for (const question of questions) {
    const domain = question.domain || "unknown";
    const current = domains.get(domain) || { answered: 0, total: 0 };
    current.total += 1;
    if (answeredQuestionIds.has(question.id)) {
      current.answered += 1;
    }
    domains.set(domain, current);
  }

  if (domains.size > 0) {
    const completed = [...domains.values()].filter(
      (domain) => domain.total > 0 && domain.answered >= domain.total,
    ).length;
    return { completed, total: domains.size };
  }

  const scoreDomains = Object.values(score?.domain_details || {});
  return {
    completed: scoreDomains.filter(
      (domain) =>
        Number(domain.total_questions ?? 0) > 0 &&
        Number(domain.answered_questions ?? 0) >= Number(domain.total_questions ?? 0),
    ).length,
    total: scoreDomains.length,
  };
}

function groupItemsByDomain(items: QuestionProgressItem[]): Array<{
  domain: string;
  answered: number;
  total: number;
  items: QuestionProgressItem[];
}> {
  const sections = new Map<
    string,
    { domain: string; answered: number; total: number; items: QuestionProgressItem[] }
  >();

  for (const item of items) {
    const section = sections.get(item.domain) || {
      domain: item.domain,
      answered: 0,
      total: 0,
      items: [],
    };
    section.items.push(item);
    section.total += 1;
    if (item.answered) {
      section.answered += 1;
    }
    sections.set(item.domain, section);
  }

  return [...sections.values()];
}

function progressOpenLabel(language: UiLanguage, mode: ProgressOverlayMode): string {
  const labels = {
    et: {
      domains: "Open domain progress overview",
      questions: "Open question progress overview",
    },
    en: {
      domains: "Open domain progress overview",
      questions: "Open question progress overview",
    },
    ru: {
      domains: "Открыть прогресс по доменам",
      questions: "Открыть прогресс по вопросам",
    },
  };
  return labels[language][mode];
}

function overlayCopy(language: UiLanguage, mode: ProgressOverlayMode) {
  const copy = {
    et: {
      title: mode === "domains" ? "Domain progress" : "Question progress",
      description:
        mode === "domains"
          ? "Questions are grouped by domain. Color shows the saved answer."
          : "All required questions and their answer status.",
      answered: "answered",
      domains: "domains complete",
      questions: "questions answered",
      empty: "Questions are not loaded yet.",
    },
    en: {
      title: mode === "domains" ? "Domain progress" : "Question progress",
      description:
        mode === "domains"
          ? "Questions are grouped by domain. Color shows the saved answer."
          : "All required questions and their answer status.",
      answered: "answered",
      domains: "domains complete",
      questions: "questions answered",
      empty: "Questions are not loaded yet.",
    },
    ru: {
      title: mode === "domains" ? "Прогресс по доменам" : "Прогресс по вопросам",
      description:
        mode === "domains"
          ? "Вопросы сгруппированы по доменам. Цвет показывает сохраненный ответ."
          : "Все обязательные вопросы и статус ответа по каждому.",
      answered: "отвечено",
      domains: "доменов закрыто",
      questions: "вопросов отвечено",
      empty: "Вопросы еще не загружены.",
    },
  };
  return copy[language];
}

function answerStatus(answer: string | undefined, language: UiLanguage) {
  const normalized = String(answer || "").toLowerCase();
  const labels = {
    et: {
      yes: "Yes",
      partial: "Partial",
      no: "No",
      unsure: "Unsure",
      unanswered: "Not answered",
    },
    en: {
      yes: "Yes",
      partial: "Partial",
      no: "No",
      unsure: "Unsure",
      unanswered: "Not answered",
    },
    ru: {
      yes: "Да",
      partial: "Частично",
      no: "Нет",
      unsure: "Не уверен(а)",
      unanswered: "Не отвечено",
    },
  };

  if (normalized === "yes") {
    return {
      label: labels[language].yes,
      dotClass: "bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.6)]",
      badgeClass: "border-emerald-300/35 bg-emerald-400/12 text-emerald-100",
    };
  }
  if (normalized === "partial") {
    return {
      label: labels[language].partial,
      dotClass: "bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.55)]",
      badgeClass: "border-amber-300/35 bg-amber-400/12 text-amber-100",
    };
  }
  if (normalized === "no") {
    return {
      label: labels[language].no,
      dotClass: "bg-red-300 shadow-[0_0_16px_rgba(252,165,165,0.58)]",
      badgeClass: "border-red-300/35 bg-red-400/12 text-red-100",
    };
  }
  if (normalized === "unsure") {
    return {
      label: labels[language].unsure,
      dotClass: "bg-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.48)]",
      badgeClass: "border-sky-300/35 bg-sky-400/12 text-sky-100",
    };
  }
  return {
    label: labels[language].unanswered,
    dotClass: "bg-slate-500",
    badgeClass: "border-white/10 bg-white/[0.045] text-slate-400",
  };
}

function AssessmentProgressOverlay({
  mode,
  language,
  items,
  domainProgress,
  answeredQuestions,
  totalQuestions,
}: {
  mode: ProgressOverlayMode;
  language: UiLanguage;
  items: QuestionProgressItem[];
  domainProgress: { completed: number; total: number };
  answeredQuestions: number;
  totalQuestions: number;
}) {
  const copy = overlayCopy(language, mode);
  const sections = groupItemsByDomain(items);

  return (
    <DialogContent
      className="w-[min(94vw,58rem)] max-w-none overflow-hidden rounded-[28px] border-white/[0.12] bg-[#07090d]/95 p-0"
      overlayClassName="bg-black/60 backdrop-blur-md"
      aria-describedby="assessment-progress-overlay-description"
    >
      <div className="border-b border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-5 py-5 pr-14 sm:px-6">
        <DialogTitle className="text-2xl font-semibold tracking-[-0.045em] text-white">
          {copy.title}
        </DialogTitle>
        <DialogDescription
          id="assessment-progress-overlay-description"
          className="mt-2 text-sm leading-6 text-slate-400"
        >
          {copy.description}
        </DialogDescription>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-200">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1">
            {answeredQuestions}/{totalQuestions} {copy.questions}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1">
            {domainProgress.completed}/{domainProgress.total} {copy.domains}
          </span>
        </div>
      </div>

      <div className="scrollbar-slim max-h-[min(68vh,620px)] overflow-y-auto px-4 py-4 sm:px-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-5 text-sm text-slate-400">
            {copy.empty}
          </div>
        ) : mode === "domains" ? (
          <div className="space-y-7">
            {sections.map((section) => (
              <DomainQuestionSection key={section.domain} section={section} language={language} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.06]">
            {items.map((item, index) => (
              <QuestionProgressRow
                key={item.id}
                item={item}
                index={index + 1}
                language={language}
                showDomain
              />
            ))}
          </div>
        )}
      </div>
    </DialogContent>
  );
}

function DomainQuestionSection({
  section,
  language,
}: {
  section: {
    domain: string;
    answered: number;
    total: number;
    items: QuestionProgressItem[];
  };
  language: UiLanguage;
}) {
  const completion = section.total > 0 ? Math.round((section.answered / section.total) * 100) : 0;
  const copy = overlayCopy(language, "domains");

  return (
    <section className="border-b border-white/[0.08] pb-6 last:border-b-0 last:pb-0">
      <div className="px-1 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">{domainLabel(language, section.domain)}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {section.answered}/{section.total} {copy.answered}
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-semibold text-slate-300">
            {completion}%
          </span>
        </div>
        <Progress
          value={completion}
          tone={completion === 100 ? "success" : completion > 0 ? "info" : "neutral"}
          className="mt-3 h-1.5 bg-white/[0.08]"
        />
      </div>
      <div className="overflow-hidden rounded-[20px] border border-white/[0.075] bg-white/[0.018] divide-y divide-white/[0.055]">
        {section.items.map((item, index) => (
          <QuestionProgressRow key={item.id} item={item} index={index + 1} language={language} />
        ))}
      </div>
    </section>
  );
}

function QuestionProgressRow({
  item,
  index,
  language,
  showDomain = false,
}: {
  item: QuestionProgressItem;
  index: number;
  language: UiLanguage;
  showDomain?: boolean;
}) {
  const status = answerStatus(item.answer, language);

  return (
    <article
      className={[
        "px-3 py-3.5 transition-colors sm:px-4",
        item.current ? "bg-cyan-300/[0.055] ring-1 ring-inset ring-cyan-300/45" : "hover:bg-white/[0.025]",
      ].join(" ")}
    >
      <div className="flex gap-3">
        <div className="pt-1">
          <span className={["block h-2.5 w-2.5 rounded-full", status.dotClass].join(" ")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 text-sm font-medium leading-5 text-slate-100">
              <span className="mr-2 text-xs font-semibold text-slate-500">#{index}</span>
              {item.question}
            </p>
            <span
              className={[
                "inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
                status.badgeClass,
              ].join(" ")}
            >
              {status.label}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {showDomain ? <span>{domainLabel(language, item.domain)}</span> : null}
            <span>{item.id}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusItem({
  label,
  value,
  ariaLabel,
  onClick,
  emphasized = false,
}: {
  label: string;
  value: string;
  ariaLabel?: string;
  onClick?: () => void;
  emphasized?: boolean;
}) {
  const className = [
    "min-w-0 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2",
    onClick
      ? "appearance-none text-left transition-colors hover:border-cyan-300/35 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/55"
      : "",
    emphasized ? "status-question-card xl:col-span-1" : "",
  ].join(" ");
  const content = (
    <>
      <div className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div
        className={
          emphasized
            ? "mt-1 text-[15px] font-semibold leading-5 text-slate-50 sm:pr-2"
            : "mt-0.5 truncate text-sm font-medium text-slate-100"
        }
      >
        {value}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-label={ariaLabel} aria-haspopup="dialog">
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
