import type { ReactNode } from "react";
import { toneClasses, type Tone } from "./progress-card-helpers";

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function ProgressBar({
  value = 0,
  tone = "info",
}: {
  value?: number;
  tone?: Tone;
}) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const barColor =
    tone === "good" || tone === "success"
      ? "bg-emerald-500"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "orange"
          ? "bg-orange-500"
          : tone === "danger"
            ? "bg-red-500"
            : tone === "neutral"
              ? "bg-slate-500"
              : "bg-sky-500";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div
        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export default function ProgressCard({
  label,
  value,
  caption,
  progress,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  progress?: number;
  tone?: Tone;
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClasses[tone]}`}>
      <div className="text-xs font-medium uppercase text-inherit opacity-75">{label}</div>
      <div className="mt-1 text-2xl font-semibold leading-tight">{value}</div>
      {progress !== undefined ? (
        <div className="mt-3">
          <ProgressBar value={progress} tone={tone === "neutral" ? "info" : tone} />
        </div>
      ) : null}
      {caption ? <div className="mt-2 text-xs opacity-80">{caption}</div> : null}
    </div>
  );
}
