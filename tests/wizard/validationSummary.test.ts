import { describe, expect, it } from "vitest";

import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { summarizeSchema } from "@/lib/wizard/validationSummary";

describe("summarizeSchema", () => {
  it("counts questions, variables, branches, and validation findings", () => {
    const summary = summarizeSchema(exampleSurveySchema, {
      schemaVersion: "0.0.1",
      hasBlockingErrors: true,
      findings: [
        { level: "error", code: "E", message: "Error", path: "nodes.0" },
        { level: "warning", code: "W", message: "Warning", path: "nodes.1" },
        { level: "suggestion", code: "S", message: "Suggestion", path: "variables.0" },
      ],
    });

    expect(summary.questionCount).toBe(1);
    expect(summary.variableCount).toBe(exampleSurveySchema.variables.length);
    expect(summary.branchCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(1);
    expect(summary.suggestionCount).toBe(1);
  });
});
