import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("app/api/surveys/[surveyId]/route.ts", "utf8");

describe("survey delete route", () => {
  it("deletes an owned survey", () => {
    expect(source).toContain("export async function DELETE");
    expect(source).toContain("await requireOwnedSurvey(user.id, surveyId);");
    expect(source).toContain("await deleteSurvey(surveyId);");
    expect(source).toContain('return NextResponse.json({ ok: true });');
  });
});
