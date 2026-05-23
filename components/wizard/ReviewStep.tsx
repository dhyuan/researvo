"use client";

import { SurveyPreview } from "@/components/survey/SurveyPreview";
import { LinkButton } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValidationReportPanel } from "@/components/validation/ValidationReportPanel";
import type { SurveySchema } from "@/lib/schema/surveySchema";
import type { ValidationReport } from "@/lib/validation/types";

type ReviewStepProps = {
  flowEditorHref: string;
  isFlowEditorDisabled: boolean;
  isPublished: boolean;
  schema: SurveySchema | null;
  schemaText: string;
  validationReport: ValidationReport | null;
};

export function ReviewStep({
  flowEditorHref,
  isFlowEditorDisabled,
  isPublished,
  schema,
  schemaText,
  validationReport,
}: ReviewStepProps) {
  const errorCount = validationReport?.findings.filter((finding) => finding.level === "error").length ?? 0;
  const warningCount = validationReport?.findings.filter((finding) => finding.level === "warning").length ?? 0;
  const isReady = Boolean(schema) && errorCount === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-950">Schema summary</h3>
              <StatusBadge tone={isPublished ? "published" : isReady ? "success" : "error"}>
                {isPublished ? "Published" : isReady ? "Ready" : "Blocked"}
              </StatusBadge>
            </div>
            <LinkButton
              className="shadow-[0_16px_30px_-18px_rgba(23,70,63,0.95)]"
              disabled={isFlowEditorDisabled}
              href={flowEditorHref}
              variant="primary"
            >
              Open Flow editor
            </LinkButton>
          </div>
          {schema ? (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Questions</dt>
                <dd className="font-semibold text-slate-950">{schema.nodes.length}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Variables</dt>
                <dd className="font-semibold text-slate-950">{schema.variables.length}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Edges</dt>
                <dd className="font-semibold text-slate-950">{schema.edges.length}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Warnings</dt>
                <dd className="font-semibold text-slate-950">{warningCount}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Paste valid schema JSON to review the survey.</p>
          )}
        </Panel>
        <Panel>
          <ValidationReportPanel report={validationReport} />
        </Panel>
      </div>
      <Panel>
        <p className="mb-3 text-xs font-semibold uppercase text-blue-700">Preview mode, not recorded</p>
        <SurveyPreview schemaText={schemaText} />
      </Panel>
    </div>
  );
}
