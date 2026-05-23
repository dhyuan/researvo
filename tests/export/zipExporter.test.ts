import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";

import { exportSurveyPackage } from "@/lib/export/zipExporter";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";

describe("exportSurveyPackage", () => {
  it("packages the schema and response exports in a zip archive", () => {
    const archive = exportSurveyPackage({
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

    const files = unzipSync(archive);

    expect(strFromU8(files["schema.json"])).toContain(exampleSurveySchema.survey.title);
    expect(strFromU8(files["responses.json"])).toContain("submission_1");
    expect(strFromU8(files["responses.csv"])).toContain("gender");
  });
});
