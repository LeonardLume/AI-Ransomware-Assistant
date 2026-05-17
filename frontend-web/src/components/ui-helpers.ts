import type { RiskLevel } from "../types/api";

export type Tone = "neutral" | "success" | "info" | "warning" | "orange" | "danger";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function riskTone(level?: RiskLevel): Tone {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "low") return "success";
  if (normalized === "medium") return "warning";
  if (normalized === "high") return "orange";
  if (normalized === "critical") return "danger";
  return "neutral";
}
