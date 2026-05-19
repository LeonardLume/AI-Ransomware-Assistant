import { ShieldAlert, Target } from "lucide-react";
import type { Tone } from "../ui-helpers";
import MetricStrip, { type MetricStripItem } from "./MetricStrip";
import ScoreRing from "./ScoreRing";

export type CockpitHighlight = {
  title: string;
  meta?: string;
};

export default function ReportCockpitHero({
  summary,
  topFinding,
  topAction,
  topFindingLabel,
  topActionLabel,
  metrics,
  score,
  scoreTone,
  scoreLabel,
}: {
  summary: string;
  topFinding?: CockpitHighlight;
  topAction?: CockpitHighlight;
  topFindingLabel: string;
  topActionLabel: string;
  metrics: MetricStripItem[];
  score: number;
  scoreTone: Tone;
  scoreLabel: string;
}) {
  return (
    <section className="report-hero relative px-0 py-0">
      <div className="relative space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-center">
          <div className="space-y-5">
            <p className="max-w-3xl text-lg font-medium leading-8 tracking-normal text-slate-200">
              {summary}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {topFinding ? (
                <div className="report-highlight-row rounded-2xl px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {topFindingLabel}
                      </div>
                      <div className="mt-1 text-[15px] font-semibold text-white">{topFinding.title}</div>
                      {topFinding.meta ? <div className="mt-1 text-sm text-slate-500">{topFinding.meta}</div> : null}
                    </div>
                  </div>
                </div>
              ) : null}
              {topAction ? (
                <div className="report-highlight-row rounded-2xl px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {topActionLabel}
                      </div>
                      <div className="mt-1 text-[15px] font-semibold text-white">{topAction.title}</div>
                      {topAction.meta ? <div className="mt-1 text-sm text-slate-500">{topAction.meta}</div> : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <ScoreRing value={score} tone={scoreTone} label={scoreLabel} className="mx-auto w-full max-w-[18rem]" />
        </div>

        <MetricStrip items={metrics} />
      </div>
    </section>
  );
}
