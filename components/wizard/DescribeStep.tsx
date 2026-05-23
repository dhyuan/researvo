"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  formatWizardBriefMarkdown,
  parseWizardBriefMarkdown,
  WizardBriefMarkdownError,
} from "@/lib/wizard/markdownBrief";

export type DescribeValue = {
  title: string;
  description: string;
  researchGoal: string;
  questionDescription: string;
  constraints: string;
};

type DescribeStepProps = {
  onChange: (value: DescribeValue) => void;
  value: DescribeValue;
};

const markdownImportError =
  "Markdown import failed. Use # Title and non-empty ## Description, ## Goal, and ## Questions sections.";

function filenameFromTitle(title: string) {
  const safeTitle = title
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^-+|-+$/g, "");

  return `${safeTitle || "survey-brief"}.md`;
}

export function DescribeStep({ onChange, value }: DescribeStepProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof DescribeValue, nextValue: string) => {
    setImportError(null);
    onChange({ ...value, [key]: nextValue });
  };

  const importMarkdown = async (file: File) => {
    try {
      const markdown = await file.text();
      const nextValue = parseWizardBriefMarkdown(markdown);

      setImportError(null);
      onChange(nextValue);
    } catch (error) {
      if (error instanceof WizardBriefMarkdownError || error instanceof Error) {
        setImportError(markdownImportError);
        return;
      }

      setImportError(markdownImportError);
    }
  };

  const exportMarkdown = () => {
    const markdown = formatWizardBriefMarkdown(value);
    const url = window.URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = filenameFromTitle(value.title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setImportError(null);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Markdown brief</p>
          <p className="text-xs text-slate-600">Import or export the first-step survey context.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => fileInputRef.current?.click()} size="sm" type="button" variant="secondary">
            <Upload />
            Import Markdown
          </Button>
          <Button onClick={exportMarkdown} size="sm" type="button" variant="secondary">
            <Download />
            Export Markdown
          </Button>
        </div>
        <input
          ref={fileInputRef}
          accept=".md,.markdown,text/markdown,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              void importMarkdown(file);
            }

            event.target.value = "";
          }}
          type="file"
        />
      </div>
      {importError ? (
        <p className="text-sm text-red-600" role="alert">
          {importError}
        </p>
      ) : null}
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Survey title
        <input
          className="h-10 rounded border border-slate-300 px-3 text-sm text-slate-950"
          onChange={(event) => update("title", event.target.value)}
          value={value.title}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Short description
        <textarea
          className="min-h-24 rounded border border-slate-300 p-3 text-sm text-slate-950"
          onChange={(event) => update("description", event.target.value)}
          value={value.description}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Research goal
        <textarea
          className="min-h-24 rounded border border-slate-300 p-3 text-sm text-slate-950"
          onChange={(event) => update("researchGoal", event.target.value)}
          value={value.researchGoal}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Question description
        <textarea
          className="min-h-32 rounded border border-slate-300 p-3 text-sm text-slate-950"
          onChange={(event) => update("questionDescription", event.target.value)}
          value={value.questionDescription}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Constraints
        <textarea
          className="min-h-20 rounded border border-slate-300 p-3 text-sm text-slate-950"
          onChange={(event) => update("constraints", event.target.value)}
          value={value.constraints}
        />
      </label>
    </div>
  );
}
