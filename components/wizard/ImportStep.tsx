"use client";

import { LinkButton } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValidationReportPanel } from "@/components/validation/ValidationReportPanel";
import type { ValidationReport } from "@/lib/validation/types";

type ImportStepProps = {
  flowEditorHref: string;
  isFlowEditorDisabled: boolean;
  isPublished: boolean;
  onChange: (value: string) => void;
  parseError: string | null;
  schemaText: string;
  validationReport: ValidationReport | null;
};

export function ImportStep({
  flowEditorHref,
  isFlowEditorDisabled,
  isPublished,
  onChange,
  parseError,
  schemaText,
  validationReport,
}: ImportStepProps) {
  const errorCount = validationReport?.findings.filter((finding) => finding.level === "error").length ?? 0;
  const summaryLabel = !validationReport ? "Pending" : errorCount > 0 ? "Blocked" : "Ready";
  const summaryTone = !validationReport ? "neutral" : errorCount > 0 ? "error" : "success";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="wizard-schema-json">
          Schema JSON
        </label>
        <textarea
          className="h-[520px] w-full rounded border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900"
          id="wizard-schema-json"
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          value={schemaText}
        />
        {parseError ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-[#ecc7c1] bg-[#f6e4e1] p-3 text-sm leading-6 text-[var(--hs-error)]">
            {parseError}
          </pre>
        ) : null}
      </div>
      <div className="rounded border border-slate-200 p-4">
        <div className="mb-4 space-y-4 border-b border-[var(--hs-border)] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">Schema summary</h3>
            <StatusBadge tone={isPublished ? "published" : summaryTone}>
              {isPublished ? "Published" : summaryLabel}
            </StatusBadge>
          </div>
          <LinkButton
            className="w-full shadow-[0_16px_30px_-18px_rgba(23,70,63,0.95)]"
            disabled={isFlowEditorDisabled}
            href={flowEditorHref}
            variant="primary"
          >
            Open Flow editor
          </LinkButton>
        </div>
        <ValidationReportPanel report={validationReport} />
      </div>
    </div>
  );
}
