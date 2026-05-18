import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "./utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "sm" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-cyan-400/30 bg-cyan-400/15 text-cyan-50 shadow-[0_14px_34px_rgba(34,211,238,0.16)] hover:bg-cyan-400/22",
  secondary:
    "border-white/10 bg-white/[0.04] text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.14)] hover:bg-white/[0.08]",
  ghost: "border-transparent bg-transparent text-slate-300 shadow-none hover:bg-white/[0.05] hover:text-slate-100",
  danger:
    "border-red-400/20 bg-red-500/10 text-red-100 shadow-[0_14px_34px_rgba(127,29,29,0.16)] hover:bg-red-500/18",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-8 rounded-xl px-3 text-xs",
  icon: "h-10 w-10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border text-sm font-medium backdrop-blur-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-55",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button };
