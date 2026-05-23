import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { exportResponsesToJson } from "@/lib/export/jsonExporter";

describe("exportResponsesToJson", () => {
  it("preserves survey metadata, variable definitions, and submissions", () => {
    const exported = exportResponsesToJson({
      schema: exampleSurveySchema,
      submissions: [
        {
          id: "submission_1",
          surveyVersionId: "version_1",
          submittedAt: "2026-01-01T00:00:00.000Z",
          answers: { gender: 1 },
        },
      ],
    });

    expect(exported.schemaVersion).toBe("0.0.1");
    expect(exported.survey.id).toBe(exampleSurveySchema.survey.id);
    expect(exported.variables[0].name).toBe("gender");
    expect(exported.submissions[0].answers).toEqual({ gender: 1 });
  });
});
