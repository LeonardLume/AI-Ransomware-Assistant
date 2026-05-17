import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { ChevronDown, Info, Loader2 } from "lucide-react";
import type { RiskLevel } from "../types/api";
import { cn, riskTone, type Tone } from "./ui-helpers";
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
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

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_18px_42px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-[0_1px_2px_rgba(0,0,0,0.22),0_24px_58px_rgba(0,0,0,0.34)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
        toneClasses[tone],
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Button({
  children,
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] hover:bg-slate-800 disabled:border-slate-300 disabled:bg-slate-300 dark:border-sky-500 dark:bg-sky-500 dark:shadow-[0_14px_34px_rgba(14,165,233,0.20)] dark:hover:bg-sky-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:shadow-none",
    secondary:
      "border-slate-200 bg-white text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_10px_28px_rgba(0,0,0,0.18)] dark:hover:border-slate-600 dark:hover:bg-slate-800",
    ghost:
      "border-transparent bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
    danger:
      "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Progress({
  value = 0,
  tone = "info",
  className,
}: {
  value?: number;
  tone?: Tone;
  className?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const bar: Record<Tone, string> = {
    neutral: "bg-slate-500",
    success: "bg-emerald-500",
    info: "bg-sky-500",
    warning: "bg-amber-500",
    orange: "bg-orange-500",
    danger: "bg-red-500",
  };
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", bar[tone])}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export function Alert({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4 text-sm leading-6", toneClasses[tone], className)}>
      {children}
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; icon?: ReactNode; disabled?: boolean }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="scrollbar-slim flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-950/80">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active === tab.id
              ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
              : "text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100",
            tab.disabled && "cursor-not-allowed opacity-45",
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Accordion({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn("rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900", className)}
    >
      <summary className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex items-center gap-1">
      {children}
      <Info className="h-3.5 w-3.5 text-slate-400" />
      <span className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden w-56 rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 text-xs leading-5 text-white shadow-xl dark:border-slate-700 group-hover:block">
        {label}
      </span>
    </span>
  );
}

export function MetricCard({
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
    <Card className={cn("p-4", tone !== "neutral" && toneClasses[tone])}>
      <div className="text-xs font-medium uppercase text-inherit opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold leading-tight">{value}</div>
      {progress !== undefined ? <Progress value={progress} tone={tone} className="mt-3" /> : null}
      {caption ? <div className="mt-2 text-xs leading-5 opacity-80">{caption}</div> : null}
    </Card>
  );
}

export function RiskBadge({ level, preview = false }: { level?: RiskLevel; preview?: boolean }) {
  return <Badge tone={preview ? "neutral" : riskTone(level)}>{preview ? "Early preview" : level || "-"}</Badge>;
}

export function StatusBadge({
  label,
  ok,
  tooltip,
}: {
  label: string;
  ok?: boolean;
  tooltip?: string;
}) {
  const badge = <Badge tone={ok === undefined ? "neutral" : ok ? "success" : "warning"}>{label}</Badge>;
  return tooltip ? <Tooltip label={tooltip}>{badge}</Tooltip> : badge;
}

export function ArtifactCard({
  title,
  description,
  active,
  available,
  icon,
  onOpen,
}: {
  title: string;
  description: string;
  active?: boolean;
  available?: boolean;
  icon?: ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!available}
      onClick={onOpen}
      className={cn(
        "group rounded-xl border p-4 text-left transition-all",
        active
          ? "border-slate-900 bg-slate-950 text-white shadow-soft"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-soft dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700",
        !available && "cursor-not-allowed opacity-55 hover:translate-y-0 hover:shadow-none",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", active ? "bg-white/10" : "bg-slate-100 dark:bg-slate-800")}>
          {icon}
        </span>
        <Badge tone={available ? "success" : "neutral"}>{available ? "Open" : "Empty"}</Badge>
      </div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      <div className={cn("mt-1 text-xs leading-5", active ? "text-slate-300" : "text-slate-500 dark:text-slate-400")}>
        {description}
      </div>
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent" />
      {icon ? <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingSteps() {
  return (
    <Card className="max-w-md p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
        Processing assessment turn
      </div>
    </Card>
  );
}
