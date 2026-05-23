import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/workspace/ConfirmSurveyActionButton.tsx", "utf8");

describe("ConfirmSurveyActionButton", () => {
  it("uses a styled Radix alert dialog instead of native confirms", () => {
    expect(source).toContain("AlertDialog.Root");
    expect(source).toContain("AlertDialog.Overlay");
    expect(source).toContain("AlertDialog.Content");
    expect(source).toContain("AlertDialog.Cancel");
    expect(source).toContain("AlertDialog.Action");
    expect(source).not.toContain("window.confirm");
    expect(source).not.toContain("window.alert");
  });
});
