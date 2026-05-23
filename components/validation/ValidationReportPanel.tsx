"use client";

import type { ValidationReport } from "@/lib/validation/types";

type ValidationReportPanelProps = {
  report: ValidationReport | null;
};

const levelOrder = ["error", "warning", "suggestion"] as const;

export function ValidationReportPanel({ report }: ValidationReportPanelProps) {
  if (!report) {
    return <p className="text-sm text-slate-500">No validation report yet.</p>;
  }

  return (
    <div className="space-y-4">
      {levelOrder.map((level) => {
        const findings = report.findings.filter((finding) => finding.level === level);

        return (
          <section key={level}>
            <h3 className="text-sm font-semibold capitalize text-slate-800">
              {level}s ({findings.length})
            </h3>
            {findings.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">None</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {findings.map((finding, index) => (
                  <li key={`${finding.code}-${finding.path}-${index}`} className="rounded border border-slate-200 p-3 text-sm">
                    <div className="font-medium text-slate-900">{finding.code}</div>
                    <div className="mt-1 text-slate-700">{finding.message}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {finding.path}
                      {finding.nodeId ? ` · node: ${finding.nodeId}` : ""}
                      {finding.variableName ? ` · variable: ${finding.variableName}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
