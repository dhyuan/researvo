"use client";

import { CopyButton } from "@/components/ui/CopyButton";

type PromptStepProps = {
  prompt: string;
};

export function PromptStep({ prompt }: PromptStepProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CopyButton label="Copy prompt" text={prompt} />
      </div>
      <pre className="max-h-[520px] overflow-auto rounded border border-slate-200 bg-slate-950 p-4 text-sm leading-6 text-slate-50">
        {prompt}
      </pre>
    </div>
  );
}
