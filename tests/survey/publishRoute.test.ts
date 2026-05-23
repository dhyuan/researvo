import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("app/api/surveys/[surveyId]/publish/route.ts", "utf8");

describe("survey publish route", () => {
  it("completes the creation draft for wizard-created surveys after publishing", () => {
    expect(source).toContain('import { completeCreationDraftForSurvey } from "@/lib/wizard/creationDraftService";');
    expect(source).toContain("await completeCreationDraftForSurvey(user.id, surveyId);");
  });
});
