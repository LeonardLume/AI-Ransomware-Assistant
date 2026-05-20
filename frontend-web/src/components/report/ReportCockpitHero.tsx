import { ShieldAlert, Target } from "lucide-react";
import type { Tone } from "../ui-helpers";
import MetricStrip, { type MetricStripItem } from "./MetricStrip";
import ScoreRing from "./ScoreRing";

export type CockpitHighlight = {
  title: string;
  meta?: string;
};

export default function ReportCockpitHero({
  topFinding,
  topAction,
  topFindingLabel,
  topActionLabel,
  metrics,
  score,
  scoreTone,
  scoreLabel,
  riskLabel,
}: {
  topFinding?: CockpitHighlight;
  topAction?: CockpitHighlight;
  topFindingLabel: string;
  topActionLabel: string;
  metrics: MetricStripItem[];
  score: number;
  scoreTone: Tone;
  scoreLabel: string;
  riskLabel?: string;
}) {
  return (
    <section className="report-hero relative px-0 py-0">
      <div className="relative space-y-4">
        <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.82fr)_minmax(360px,1.18fr)] xl:items-center">
          <div className="space-y-6 pl-2 sm:pl-4 xl:-mt-5 xl:max-w-[38rem] xl:pl-7">
            {topFinding ? (
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {topFindingLabel}
                  </div>
                  <div className="mt-1 text-lg font-semibold leading-7 text-white">{topFinding.title}</div>
                  {topFinding.meta ? <div className="mt-1 text-base text-slate-400">{topFinding.meta}</div> : null}
                </div>
              </div>
            ) : null}

            {topAction ? (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                  <Target className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {topActionLabel}
                  </div>
                  <div className="mt-1 text-lg font-semibold leading-7 text-white">{topAction.title}</div>
                  {topAction.meta ? <div className="mt-1 text-base text-slate-400">{topAction.meta}</div> : null}
                </div>
              </div>
            ) : null}
          </div>

          <ScoreRing
            value={score}
            tone={scoreTone}
            label={scoreLabel}
            riskLabel={riskLabel}
            className="mx-auto w-full max-w-[31rem] xl:ml-8 xl:mr-auto"
          />
        </div>

        <MetricStrip items={metrics} />
      </div>
    </section>
  );
}
