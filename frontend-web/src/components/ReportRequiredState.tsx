import { ArrowRight, FileText, Sparkles } from "lucide-react";
import { t, type UiLanguage } from "../utils/i18n";
import { Button } from "./ui/button";

export default function ReportRequiredState({
  title,
  description,
  language = "et",
  loading = false,
  onGenerate,
  onOpenReport,
}: {
  title: string;
  description: string;
  language?: UiLanguage;
  loading?: boolean;
  onGenerate: () => void;
  onOpenReport?: () => void;
}) {
  return (
    <section className="rounded-[30px] border border-dashed border-sky-400/20 bg-[linear-gradient(180deg,rgba(14,23,43,0.94),rgba(9,14,26,0.92))] px-6 py-7 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-sky-400/20 bg-sky-400/12 text-sky-200">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold text-white">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-400">{description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={onGenerate} disabled={loading}>
            <Sparkles className="h-4 w-4" />
            {t(language, "generateReport")}
          </Button>
          {onOpenReport ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenReport}
              className="border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.08]"
            >
              <ArrowRight className="h-4 w-4" />
              {t(language, "report")}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
