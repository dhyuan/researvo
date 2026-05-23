import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("app/api/surveys/[surveyId]/draft/route.ts", "utf8");

describe("survey draft route", () => {
  it("returns the latest published version with the draft payload", () => {
    expect(source).toContain("const latestVersion = await getLatestSurveyVersion(surveyId);");
    expect(source).toContain("return NextResponse.json({ draft, latestVersion });");
  });
});
