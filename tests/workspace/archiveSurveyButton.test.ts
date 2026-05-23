import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/workspace/ArchiveSurveyButton.tsx", "utf8");

describe("ArchiveSurveyButton", () => {
  it("confirms with an in-app dialog before archiving a survey", () => {
    expect(source).toContain("ConfirmSurveyActionButton");
    expect(source).toContain("Archive survey?");
    expect(source).toContain("Archive survey");
    expect(source).toContain("method: \"POST\"");
    expect(source).toContain("router.refresh()");
    expect(source).toContain("toast.error");
  });
});
