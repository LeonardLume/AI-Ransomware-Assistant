import { AlertTriangle } from "lucide-react";
import type { ReportResponse } from "../types/api";
import type { UiLanguage } from "../utils/i18n";

function badgeCopy(language: UiLanguage) {
  const copy = {
    et: {
      primary: "Kõik küsimused pole vastatud",
      secondary: "parima tulemuse jaoks vasta kõigile",
      title: "Raport põhineb osalistel vastustel.",
    },
    en: {
      primary: "Not all questions answered",
      secondary: "answer all for the best result",
      title: "This report is based on partial answers.",
    },
    ru: {
      primary: "Не все вопросы отвечены",
      secondary: "для лучшего результата ответьте на все",
      title: "Отчет построен на неполных ответах.",
    },
  };
  return copy[language];
}

function isIncompleteReport(report?: ReportResponse | null): boolean {
  if (!report) {
    return false;
  }

  const totalQuestions = Number(report.total_questions ?? 0);
  const answeredQuestions = Number(report.answered_questions ?? 0);
  if (totalQuestions > 0) {
    return answeredQuestions < totalQuestions;
  }

  const completionRate = Number(report.completion_rate ?? 100);
  return Number.isFinite(completionRate) && completionRate < 100;
}

export default function IncompleteReportBadge({
  report,
  language = "et",
}: {
  report?: ReportResponse | null;
  language?: UiLanguage;
}) {
  if (!isIncompleteReport(report)) {
    return null;
  }

  const copy = badgeCopy(language);
  const totalQuestions = Number(report?.total_questions ?? 0);
  const answeredQuestions = Number(report?.answered_questions ?? 0);
  const progressText = totalQuestions > 0 ? ` ${answeredQuestions}/${totalQuestions}` : "";

  return (
    <span
      title={`${copy.title}${progressText}`}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/[0.09] px-3 py-1.5 text-xs font-semibold leading-none text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.12)]"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-200" />
      <span className="truncate">{copy.primary}</span>
      <span className="hidden text-amber-100/65 xl:inline">{copy.secondary}</span>
    </span>
  );
}
