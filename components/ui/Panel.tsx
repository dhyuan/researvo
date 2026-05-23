import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Panel({ children, className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--hs-border)] bg-[var(--hs-surface)] p-4 shadow-[0_18px_44px_-34px_rgba(38,54,47,0.35)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
