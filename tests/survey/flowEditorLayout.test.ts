import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/survey/SurveyFlowEditor.tsx", "utf8");

describe("SurveyFlowEditor split layout", () => {
  it("only exposes the split resize handle while fullscreen", () => {
    expect(source).toContain("{isFullscreen ? (");
    expect(source).toMatch(/\{isFullscreen \? \(\s*<button\s+aria-label="Resize flow editor panels"/);
  });
});
