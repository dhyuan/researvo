import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/respondent/RespondentSurvey.tsx", "utf8");

describe("RespondentSurvey navigation", () => {
  it("renders a back button before the forward action and right-aligns survey navigation", () => {
    expect(source).toContain("const goBack = () => {");
    expect(source).toContain("disabled={branchPath.length <= 1}");
    expect(source).toContain('<div className="mt-6 flex justify-end gap-3">');
    expect(source.indexOf(">Back<")).toBeLessThan(source.indexOf("currentNode.type === \"terminal\" ? \"Submit\" : \"Continue\""));
  });
});
