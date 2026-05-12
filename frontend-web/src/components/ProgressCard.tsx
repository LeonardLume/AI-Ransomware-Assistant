import type { ReactNode } from "react";
import type { RiskLevel } from "../types/api";

export type Tone = "neutral" | "good" | "success" | "info" | "warning" | "orange" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  good:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-950/50 dark:text-sky-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300",
  orange:
    "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-950/50 dark:text-orange-300",
  danger:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300",
};

export function riskTone(level?: RiskLevel): Tone {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "low") {
    return "success";
  }
  if (normalized === "medium") {
    return "warning";
  }
  if (normalized === "high") {
    return "orange";
  }
  if (normalized === "critical") {
    return "danger";
  }
  return "neutral";
}

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
