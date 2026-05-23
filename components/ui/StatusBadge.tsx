import type { HTMLAttributes, ReactNode } from "react";

type StatusTone = "draft" | "published" | "success" | "warning" | "error" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  draft: "bg-[#eef1ec] text-[#4c5952] ring-[#d9e0da]",
  published: "bg-[var(--hs-primary-soft)] text-[var(--hs-primary-deep)] ring-[#c7d9d1]",
  success: "bg-[var(--hs-primary-soft)] text-[var(--hs-primary-deep)] ring-[#c7d9d1]",
  warning: "bg-[#f3ead8] text-[var(--hs-warning)] ring-[#e4d4b5]",
  error: "bg-[#f6e4e1] text-[var(--hs-error)] ring-[#ecc7c1]",
  neutral: "bg-white text-[var(--hs-muted)] ring-[var(--hs-border)]",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: StatusTone;
}

export function StatusBadge({ children, className, tone = "neutral", ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
