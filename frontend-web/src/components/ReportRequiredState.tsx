import { ArrowRight } from "lucide-react";
import { t, type UiLanguage } from "../utils/i18n";
import { Button } from "./ui/button";

export default function ReportRequiredState({
  title,
  description,
  language = "et",
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
    <section className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.09),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.05),transparent_32%)]" />
      <div className="report-panel relative rounded-[34px] px-6 py-10 text-center sm:px-8">
        <h3 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">{title}</h3>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400">{description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onOpenReport ? (
            <Button
              type="button"
              variant="primary"
              onClick={onOpenReport}
              className="rounded-full border-sky-500/20 bg-sky-600 px-6 text-white shadow-[0_16px_40px_rgba(2,132,199,0.22)] hover:bg-sky-500"
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
