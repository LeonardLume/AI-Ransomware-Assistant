import * as React from "react";
import { cn } from "./utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/[0.08]", className)} {...props} />;
}

export { Skeleton };
