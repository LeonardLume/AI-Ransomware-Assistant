import { useId } from "react";
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

export default function ScoreRing({
  value,
  tone,
  label,
  className,
}: {
  value: number;
  tone: Tone;
  label: string;
  className?: string;
}) {
  const ringId = useId().replace(/:/g, "");
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const safeValue = clamp(value);
  const dashOffset = circumference - (safeValue / 100) * circumference;

  return (
    <div className={cn("report-score-stage relative flex flex-col items-center px-5 py-5 text-center", className)}>
      <div className="text-[11px] font-semibold text-slate-400">{label}</div>
      <div className="relative mt-4 h-40 w-40">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id={`ring-${ringId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={toneColor(tone)} />
              <stop offset="100%" stopColor="rgba(255,255,255,0.94)" />
            </linearGradient>
          </defs>
          <circle
            cx="80"
            cy="80"
            r={radius}
            className="fill-none stroke-white/10"
            strokeWidth="12"
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            className="report-ring-progress fill-none"
            stroke={`url(#ring-${ringId})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-5xl font-semibold leading-none tracking-normal text-white">{safeValue}</div>
          <div className="mt-1 text-[12px] font-semibold text-slate-500">/ 100</div>
        </div>
      </div>
    </div>
  );
}
