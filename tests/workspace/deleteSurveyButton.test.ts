import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/workspace/DeleteSurveyButton.tsx", "utf8");

describe("DeleteSurveyButton", () => {
  it("confirms with an in-app dialog before permanently deleting a survey", () => {
    expect(source).toContain("ConfirmSurveyActionButton");
    expect(source).toContain("Delete survey?");
    expect(source).toContain("This permanently deletes");
    expect(source).toContain("method: \"DELETE\"");
    expect(source).toContain('variant="danger"');
    expect(source).toContain("router.refresh()");
    expect(source).toContain("toast.error");
  });
});
