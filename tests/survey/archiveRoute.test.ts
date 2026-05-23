import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("app/api/surveys/[surveyId]/archive/route.ts", "utf8");

describe("survey archive route", () => {
  it("archives an owned survey", () => {
    expect(source).toContain("await requireOwnedSurvey(user.id, surveyId);");
    expect(source).toContain("await archiveSurvey(surveyId);");
    expect(source).toContain('return NextResponse.json({ survey });');
  });
});
