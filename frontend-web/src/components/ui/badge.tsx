import * as React from "react";
import { cn } from "./utils";

type BadgeVariant = "neutral" | "success" | "info" | "warning" | "orange" | "danger";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "border-white/10 bg-white/[0.04] text-slate-200",
  success: "border-emerald-400/20 bg-emerald-400/12 text-emerald-100",
  info: "border-cyan-400/20 bg-cyan-400/12 text-cyan-100",
  warning: "border-amber-300/20 bg-amber-300/12 text-amber-100",
  orange: "border-orange-400/20 bg-orange-400/12 text-orange-100",
  danger: "border-red-400/20 bg-red-400/12 text-red-100",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium leading-none backdrop-blur-md",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
