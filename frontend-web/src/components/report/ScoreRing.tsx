import { cn, type Tone } from "../ui-helpers";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function toneColor(tone: Tone): string {
  if (tone === "success") return "#34d399";
  if (tone === "warning") return "#fbbf24";
  if (tone === "orange") return "#fb923c";
  if (tone === "danger") return "#f87171";
  if (tone === "info") return "#38bdf8";
  return "#cbd5e1";
}

function fillGradient(tone: Tone): string {
  if (tone === "success") return "linear-gradient(90deg, #10b981, #6ee7b7, rgba(255,255,255,0.94))";
  if (tone === "warning") return "linear-gradient(90deg, #f59e0b, #fcd34d, rgba(255,255,255,0.94))";
  if (tone === "orange") return "linear-gradient(90deg, #fb923c, #fbbf24, rgba(255,255,255,0.94))";
  if (tone === "danger") return "linear-gradient(90deg, #fb7185, #fca5a5, rgba(255,255,255,0.94))";
  return `linear-gradient(90deg, ${toneColor(tone)}, rgba(255,255,255,0.94))`;
}

function statusText(value: number): string {
  if (value <= 35) return "Needs urgent improvement";
  if (value <= 70) return "Below baseline";
  return "Strong readiness signal";
}

export default function ScoreRing({
  value,
  tone,
  label,
  riskLabel,
  className,
}: {
  value: number;
  tone: Tone;
  label: string;
  riskLabel?: string;
  className?: string;
}) {
  const safeValue = clamp(value);
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className={cn("report-score-stage relative flex w-full flex-col justify-center px-5 py-0", className)}>
      <div className="w-full max-w-xl rounded-[28px] border border-white/[0.08] bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_70px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {label}
          </div>
          {riskLabel ? (
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200">
              {riskLabel}
            </span>
          ) : null}
        </div>

        <div className="mt-4 text-6xl font-semibold leading-none tracking-normal text-white">
          {safeValue} <span className="text-2xl text-slate-500">/ 100</span>
        </div>

        <div className="relative mt-5 h-4 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div
            className="relative h-full rounded-full shadow-[0_0_30px_rgba(251,113,133,0.22)] transition-[width] duration-700 ease-out after:absolute after:right-0 after:top-1/2 after:h-6 after:w-6 after:-translate-y-1/2 after:translate-x-1/2 after:rounded-full after:bg-white/80 after:blur-md after:content-['']"
            style={{
              width: `${safeValue}%`,
              background: fillGradient(tone),
            }}
          />
        </div>

        <div className="mt-2 grid grid-cols-5 text-[11px] font-semibold text-slate-600">
          {ticks.map((tick, index) => (
            <span
              key={tick}
              className={cn(
                index === 0 && "text-left",
                index > 0 && index < ticks.length - 1 && "text-center",
                index === ticks.length - 1 && "text-right",
              )}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="mt-3 text-sm font-medium text-slate-400">{statusText(safeValue)}</div>
      </div>
    </div>
  );
}
