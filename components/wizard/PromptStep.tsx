"use client";

import { CopyButton } from "@/components/ui/CopyButton";

type PromptStepProps = {
  prompt: string;
};

export function PromptStep({ prompt }: PromptStepProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <p id="prompt-copy-hint" className="text-sm text-slate-600">
          Please copy the generated prompt and paste it into ChatGPT or another AI tool to generate the survey structure data. Then copy the generated data into the “Schema JSON” text box in the next step.
        </p>
        <CopyButton aria-describedby="prompt-copy-hint" label="Copy prompt" text={prompt} />
      </div>
      <pre className="max-h-[520px] overflow-auto rounded border border-slate-200 bg-slate-950 p-4 text-sm leading-6 text-slate-50">
        {prompt}
      </pre>
    </div>
  );
}
