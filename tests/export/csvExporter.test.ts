import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { exportResponsesToCsv } from "@/lib/export/csvExporter";

describe("exportResponsesToCsv", () => {
  it("uses stable variable names as headers and coded values as cells", () => {
    const csv = exportResponsesToCsv({
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

    expect(csv).toContain("submission_id,survey_version_id,submitted_at,gender");
    expect(csv).toContain("submission_1,version_1,2026-01-01T00:00:00.000Z,1");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    const schema = {
      ...exampleSurveySchema,
      variables: [
        ...exampleSurveySchema.variables,
        {
          name: "comment",
          label: "Comment",
          type: "text" as const,
          questionNodeId: "q_comment",
        },
      ],
    };

    const csv = exportResponsesToCsv({
      schema,
      submissions: [
        {
          id: "submission_1",
          surveyVersionId: "version_1",
          submittedAt: "2026-01-01T00:00:00.000Z",
          answers: { gender: 1, comment: "hello, \"research\"\nteam" },
        },
      ],
    });

    expect(csv).toContain("\"hello, \"\"research\"\"\nteam\"");
  });
});
