"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { LinkProps } from "next/link";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-[0_10px_24px_-16px_rgba(23,70,63,0.75)] hover:bg-[var(--hs-primary-deep)]",
        default: "bg-primary text-primary-foreground shadow-[0_10px_24px_-16px_rgba(23,70,63,0.75)] hover:bg-[var(--hs-primary-deep)]",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "border-border bg-background text-foreground hover:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground",
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        danger:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-7 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 rounded-md px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-5",
        icon: "size-10",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-md",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

export interface ButtonProps
  extends Omit<React.ComponentProps<"button">, "className">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  className?: string;
}

export function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export interface LinkButtonProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">,
    Pick<LinkProps, "href" | "prefetch" | "replace" | "scroll" | "shallow" | "locale"> {
  children: ReactNode;
  disabled?: boolean;
  size?: VariantProps<typeof buttonVariants>["size"];
  variant?: ButtonVariant;
}

export function LinkButton({
  className,
  disabled = false,
  size = "default",
  variant = "primary",
  onClick,
  tabIndex,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      aria-disabled={disabled}
      className={cn(buttonVariants({ variant, size }), disabled && "pointer-events-none opacity-50", className)}
      data-slot="button"
      data-variant={variant}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }

        onClick?.(event);
      }}
      tabIndex={disabled ? -1 : tabIndex}
      {...props}
    />
  );
}

export { buttonVariants };
