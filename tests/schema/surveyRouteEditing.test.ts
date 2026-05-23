import { describe, expect, it } from "vitest";

import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import type { SurveySchema } from "@/lib/schema/surveySchema";
import {
  applyRouteTargets,
  createDefaultBranchRule,
  deriveRouteTargets,
} from "@/lib/schema/surveyRouteEditing";

const cloneSchema = (
  schema: SurveySchema = exampleSurveySchema,
): SurveySchema => structuredClone(schema);

const node = (schema: SurveySchema, nodeId = "q_gender") => {
  const found = schema.nodes.find((candidate) => candidate.id === nodeId);

  if (!found) {
    throw new Error(`Missing test node ${nodeId}`);
  }

  return found;
};

describe("survey route editing", () => {
  it("derives branch targets first and default target last", () => {
    const base = cloneSchema();
    const schema: SurveySchema = {
      ...base,
      nodes: base.nodes.map((candidate) =>
        candidate.id === "q_gender"
          ? {
              ...candidate,
              nextNodeId: "end",
              branches: [
                {
                  variableName: "gender",
                  operator: "equals",
                  value: 1,
                  goto: "consent",
                },
                {
                  variableName: "gender",
                  operator: "equals",
                  value: 2,
                  goto: "end",
                },
              ],
            }
          : candidate,
      ),
    };

    expect(deriveRouteTargets(node(schema))).toEqual({
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });
  });

  it("selects one target as nextNodeId without branches", () => {
    const updated = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["end"],
      defaultTargetId: "end",
    });

    expect(node(updated).nextNodeId).toBe("end");
    expect(node(updated).branches).toBeUndefined();
    expect(updated.edges).toContainEqual({ from: "q_gender", to: "end" });
  });

  it("uses the last newly selected target as the default route", () => {
    const updated = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["consent", "end"],
      addedTargetId: "end",
    });

    expect(node(updated).nextNodeId).toBe("end");
    expect(node(updated).branches).toEqual([
      { variableName: "gender", operator: "equals", value: 1, goto: "consent" },
    ]);
    expect(updated.edges).toContainEqual({
      from: "q_gender",
      to: "consent",
      condition: {
        variableName: "gender",
        operator: "equals",
        value: 1,
        goto: "consent",
      },
    });
    expect(updated.edges).toContainEqual({ from: "q_gender", to: "end" });
  });

  it("changes default and moves the previous default into conditional routes", () => {
    const base = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });
    const updated = applyRouteTargets(base, "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "consent",
    });

    expect(node(updated).nextNodeId).toBe("consent");
    expect(node(updated).branches).toEqual([
      { variableName: "gender", operator: "equals", value: 1, goto: "end" },
    ]);
  });

  it("removes deselected conditional targets", () => {
    const base = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });
    const updated = applyRouteTargets(base, "q_gender", {
      selectedTargetIds: ["end"],
      defaultTargetId: "end",
    });

    expect(node(updated).nextNodeId).toBe("end");
    expect(node(updated).branches).toBeUndefined();
  });

  it("chooses the remaining target when the default target is deselected", () => {
    const base = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });
    const updated = applyRouteTargets(base, "q_gender", {
      selectedTargetIds: ["consent"],
      removedTargetId: "end",
    });

    expect(node(updated).nextNodeId).toBe("consent");
    expect(node(updated).branches).toBeUndefined();
  });

  it("clears nextNodeId and branches when all route targets are deselected", () => {
    const base = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });
    const updated = applyRouteTargets(base, "q_gender", {
      selectedTargetIds: [],
      removedTargetId: "end",
    });

    expect(node(updated).nextNodeId).toBeUndefined();
    expect(node(updated).branches).toBeUndefined();
    expect(updated.edges.some((edge) => edge.from === "q_gender")).toBe(false);
  });

  it("preserves existing branch details for selected non-default targets", () => {
    const base = cloneSchema();
    const schema: SurveySchema = {
      ...base,
      nodes: base.nodes.map((candidate) =>
        candidate.id === "q_gender"
          ? {
              ...candidate,
              nextNodeId: "end",
              branches: [
                {
                  variableName: "gender",
                  operator: "not_equals",
                  value: 2,
                  goto: "consent",
                },
              ],
            }
          : candidate,
      ),
    };
    const updated = applyRouteTargets(schema, "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });

    expect(node(updated).branches).toEqual([
      {
        variableName: "gender",
        operator: "not_equals",
        value: 2,
        goto: "consent",
      },
    ]);
  });

  it("creates an exists rule when the selected node has no option value", () => {
    const base = cloneSchema();
    const schema: SurveySchema = {
      ...base,
      variables: [
        ...base.variables,
        {
          name: "comment",
          label: "Comment",
          type: "text",
          questionNodeId: "q_comment",
        },
      ],
      nodes: [
        ...base.nodes,
        {
          id: "q_comment",
          type: "short_text",
          title: "Comment",
          variableName: "comment",
          nextNodeId: "end",
        },
      ],
    };

    expect(createDefaultBranchRule(schema, node(schema, "q_comment"), "end")).toEqual({
      variableName: "comment",
      operator: "exists",
      goto: "end",
    });
  });
});
