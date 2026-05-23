import type { SurveySchema } from "@/lib/schema/surveySchema";
import type { ValidationReport } from "@/lib/validation/types";

export function summarizeSchema(schema: SurveySchema, report: ValidationReport | null) {
  return {
    questionCount: schema.nodes.filter((node) => node.type !== "terminal" && node.type !== "consent").length,
    variableCount: schema.variables.length,
    branchCount: schema.nodes.reduce((count, node) => count + (node.branches?.length ?? 0), 0),
    errorCount: report?.findings.filter((finding) => finding.level === "error").length ?? 0,
    warningCount: report?.findings.filter((finding) => finding.level === "warning").length ?? 0,
    suggestionCount: report?.findings.filter((finding) => finding.level === "suggestion").length ?? 0,
  };
}
