"use client";

import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/Button";

type ConfirmSurveyActionButtonProps = {
  actionLabel: string;
  cancelLabel?: string;
  children: ReactNode;
  confirmLabel: string;
  description: string;
  disabled?: boolean;
  icon: ReactNode;
  isPending: boolean;
  onConfirm: () => boolean | Promise<boolean>;
  pendingLabel: string;
  title: string;
  variant?: ButtonProps["variant"];
};

export function ConfirmSurveyActionButton({
  actionLabel,
  cancelLabel = "Cancel",
  children,
  confirmLabel,
  description,
  disabled = false,
  icon,
  isPending,
  onConfirm,
  pendingLabel,
  title,
  variant = "secondary",
}: ConfirmSurveyActionButtonProps) {
  const [open, setOpen] = useState(false);

  const confirm = async () => {
    const shouldClose = await onConfirm();

    if (shouldClose) {
      setOpen(false);
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button aria-label={actionLabel} disabled={disabled || isPending} size="sm" type="button" variant={variant}>
          {icon}
          {isPending ? pendingLabel : children}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-[rgba(18,28,24,0.36)] backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 grid w-[calc(100vw-2rem)] max-w-[430px] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-xl border border-[var(--hs-border)] bg-[var(--hs-surface)] p-5 shadow-[0_28px_80px_-38px_rgba(23,35,31,0.55)] outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="grid gap-2">
            <AlertDialog.Title className="text-lg font-semibold tracking-tight text-[var(--hs-text)]">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm leading-6 text-[var(--hs-muted)]">
              {description}
            </AlertDialog.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button className="w-full sm:w-auto" disabled={isPending} size="sm" variant="secondary">
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={(event) => {
                  event.preventDefault();
                  void confirm();
                }}
                size="sm"
                variant={variant}
              >
                {isPending ? pendingLabel : confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
