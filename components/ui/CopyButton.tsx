"use client";

import { useEffect, useRef, useState } from "react";
import type { ButtonProps } from "./Button";
import { Button } from "./Button";

export interface CopyButtonProps extends Omit<ButtonProps, "children" | "onClick"> {
  copiedLabel?: string;
  label?: string;
  text: string;
}

export function CopyButton({ copiedLabel = "Copied", label = "Copy", text, variant = "secondary", ...props }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minLabelWidth = `${Math.max(label.length, copiedLabel.length)}ch`;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, 1600);
  }

  return (
    <Button onClick={copy} variant={variant} {...props}>
      <span aria-live="polite" className="inline-block text-center" style={{ minWidth: minLabelWidth }}>
        {copied ? copiedLabel : label}
      </span>
    </Button>
  );
}
