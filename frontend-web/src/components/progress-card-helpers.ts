import type { RiskLevel } from "../types/api";

export type Tone = "neutral" | "good" | "success" | "info" | "warning" | "orange" | "danger";

export const toneClasses: Record<Tone, string> = {
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
