import { describe, expect, it } from "vitest";

import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import type { ValidationFinding } from "@/lib/validation/types";
import { getFindingNodeId, getNodeSeverity, groupFindingsByNode } from "@/lib/validation/nodeFindingMap";

const finding = (overrides: Partial<ValidationFinding>): ValidationFinding => ({
  level: "warning",
  code: "TEST_FINDING",
  message: "Test finding",
  path: "nodes.0",
  ...overrides,
});

describe("node finding map", () => {
  it("maps explicit node ids", () => {
    expect(getFindingNodeId(exampleSurveySchema, finding({ nodeId: "q_gender", path: "survey.entryNodeId" }))).toBe("q_gender");
  });

  it("maps node index paths to node ids", () => {
    expect(getFindingNodeId(exampleSurveySchema, finding({ path: "nodes.1.variableName" }))).toBe("q_gender");
    expect(getFindingNodeId(exampleSurveySchema, finding({ path: "nodes.0.branches.0.goto" }))).toBe("consent");
  });

  it("does not infer node ids from non-node paths", () => {
    expect(getFindingNodeId(exampleSurveySchema, finding({ path: "survey.entryNodeId" }))).toBeNull();
  });

  it("groups findings by node", () => {
    const grouped = groupFindingsByNode(exampleSurveySchema, [
      finding({ nodeId: "q_gender", code: "EXPLICIT" }),
      finding({ path: "nodes.1.variableName", code: "PATH" }),
      finding({ path: "survey.entryNodeId", code: "GLOBAL" }),
    ]);

    expect(grouped.get("q_gender")?.map((item) => item.code)).toEqual(["EXPLICIT", "PATH"]);
    expect(grouped.has("consent")).toBe(false);
  });

  it("returns the highest node severity", () => {
    expect(getNodeSeverity([])).toBeNull();
    expect(getNodeSeverity([finding({ level: "suggestion" })])).toBe("suggestion");
    expect(getNodeSeverity([finding({ level: "suggestion" }), finding({ level: "warning" })])).toBe("warning");
    expect(getNodeSeverity([finding({ level: "warning" }), finding({ level: "error" })])).toBe("error");
  });
});
