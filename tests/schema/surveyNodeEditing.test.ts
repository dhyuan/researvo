import { describe, expect, it } from "vitest";

import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import type { SurveySchema } from "@/lib/schema/surveySchema";
import {
  addNodeAfter,
  insertNodeBefore,
  isBranchDecisionNode,
  renameNodeId,
  rebuildDefaultPathEdges,
  updateNode,
} from "@/lib/schema/surveyNodeEditing";

const cloneSchema = (schema: SurveySchema = exampleSurveySchema): SurveySchema => structuredClone(schema);

describe("survey node editing", () => {
  it("renames node ids and updates structural references", () => {
    const schema = renameNodeId(cloneSchema(), "q_gender", "q_demographics_gender");

    expect(schema.nodes.some((node) => node.id === "q_demographics_gender")).toBe(true);
    expect(schema.nodes.find((node) => node.id === "consent")?.nextNodeId).toBe("q_demographics_gender");
    expect(schema.edges[0]).toMatchObject({ from: "consent", to: "q_demographics_gender" });
    expect(schema.variables[0].questionNodeId).toBe("q_demographics_gender");
  });

  it("renames entry node references", () => {
    const schema = renameNodeId(cloneSchema(), "consent", "study_consent");

    expect(schema.survey.entryNodeId).toBe("study_consent");
    expect(schema.edges[0].from).toBe("study_consent");
  });

  it("renames saved flow layout positions with the node id", () => {
    const base = cloneSchema();
    const schema = renameNodeId(
      {
        ...base,
        metadata: {
          ...base.metadata,
          flowLayout: {
            nodes: {
              q_gender: { x: 420, y: 220 },
            },
          },
        },
      },
      "q_gender",
      "q_demographics_gender",
    );

    expect(schema.metadata.flowLayout).toEqual({
      nodes: {
        q_demographics_gender: { x: 420, y: 220 },
      },
    });
  });

  it("rejects empty or duplicate node ids", () => {
    expect(() => renameNodeId(cloneSchema(), "q_gender", " ")).toThrow("Node ID is required");
    expect(() => renameNodeId(cloneSchema(), "q_gender", "consent")).toThrow("Node ID already exists");
  });

  it("updates question text without changing other nodes", () => {
    const schema = updateNode(cloneSchema(), "q_gender", { title: "What gender do you identify with?" });

    expect(schema.nodes.find((node) => node.id === "q_gender")?.title).toBe("What gender do you identify with?");
    expect(schema.nodes.find((node) => node.id === "consent")?.title).toBe("Consent");
  });

  it("normalizes fields when changing question type", () => {
    const shortText = updateNode(cloneSchema(), "q_gender", { type: "short_text" });
    const shortTextNode = shortText.nodes.find((node) => node.id === "q_gender");

    expect(shortTextNode?.options).toBeUndefined();
    expect(shortTextNode?.scale).toBeUndefined();

    const singleChoice = updateNode(shortText, "q_gender", { type: "single_choice" });
    const singleChoiceNode = singleChoice.nodes.find((node) => node.id === "q_gender");

    expect(singleChoiceNode?.options).toHaveLength(2);
    expect(singleChoiceNode?.options?.[0]).toMatchObject({ id: "option_1", label: "Option 1", value: "option_1" });

    const numberSchema = updateNode(singleChoice, "q_gender", { type: "number" });

    expect(numberSchema.nodes.find((node) => node.id === "q_gender")?.options).toBeUndefined();
  });

  it("defaults required for branch decision nodes using their own variable", () => {
    const base = cloneSchema();
    const branching: SurveySchema = {
      ...base,
      nodes: base.nodes.map((node) =>
        node.id === "q_gender"
          ? {
              ...node,
              required: false,
              branches: [{ variableName: "gender", operator: "equals", value: 1, goto: "end" }],
            }
          : node,
      ),
    };
    const schema = updateNode(branching, "q_gender", { title: "Branching gender question" });

    expect(isBranchDecisionNode(schema.nodes.find((node) => node.id === "q_gender")!)).toBe(true);
    expect(schema.nodes.find((node) => node.id === "q_gender")?.required).toBe(true);
  });

  it("updates variable names and matching variable definitions", () => {
    const schema = updateNode(cloneSchema(), "q_gender", { variableName: "gender_identity" });

    expect(schema.nodes.find((node) => node.id === "q_gender")?.variableName).toBe("gender_identity");
    expect(schema.variables.some((variable) => variable.name === "gender")).toBe(false);
    expect(schema.variables.find((variable) => variable.name === "gender_identity")).toMatchObject({
      questionNodeId: "q_gender",
    });
  });

  it("rebuilds default path edges after changing next node", () => {
    const schemaWithExtraNode: SurveySchema = {
      ...cloneSchema(),
      nodes: [
        ...cloneSchema().nodes,
        { id: "q_extra", type: "short_text", title: "Extra question", variableName: "q_extra", nextNodeId: "end" },
      ],
    };
    const updated = updateNode(schemaWithExtraNode, "q_gender", { nextNodeId: "q_extra" });
    const rebuilt = rebuildDefaultPathEdges(updated);

    expect(rebuilt.edges).toContainEqual({ from: "q_gender", to: "q_extra" });
    expect(rebuilt.edges).not.toContainEqual({ from: "q_gender", to: "end" });
  });

  it("ignores nextNodeId when set to the node itself (prevents self-loop)", () => {
    const schema = cloneSchema();
    const updated = updateNode(schema, "q_gender", { nextNodeId: "q_gender" });

    expect(updated.nodes.find((n) => n.id === "q_gender")?.nextNodeId).toBeUndefined();
  });

  it("inserts a node before a regular question", () => {
    const schema = insertNodeBefore(cloneSchema(), "q_gender", { id: "q_intro", title: "Intro question" });

    expect(schema.nodes.some((node) => node.id === "q_intro")).toBe(true);
    expect(schema.nodes.find((node) => node.id === "consent")?.nextNodeId).toBe("q_intro");
    expect(schema.nodes.find((node) => node.id === "q_intro")?.nextNodeId).toBe("q_gender");
    expect(schema.edges).toContainEqual({ from: "consent", to: "q_intro" });
    expect(schema.edges).toContainEqual({ from: "q_intro", to: "q_gender" });
    expect(schema.variables.find((variable) => variable.questionNodeId === "q_intro")).toMatchObject({
      name: "q_intro",
      type: "text",
    });
  });

  it("does not insert before the entry node", () => {
    expect(() => insertNodeBefore(cloneSchema(), "consent", { id: "q_before_consent" })).toThrow("Cannot insert before entry node");
  });

  it("adds a node after a regular question", () => {
    const schema = addNodeAfter(cloneSchema(), "q_gender", { id: "q_follow_up", title: "Follow-up question" });

    expect(schema.nodes.find((node) => node.id === "q_gender")?.nextNodeId).toBe("q_follow_up");
    expect(schema.nodes.find((node) => node.id === "q_follow_up")?.nextNodeId).toBe("end");
    expect(schema.edges).toContainEqual({ from: "q_gender", to: "q_follow_up" });
    expect(schema.edges).toContainEqual({ from: "q_follow_up", to: "end" });
  });

  it("does not add after terminal nodes", () => {
    expect(() => addNodeAfter(cloneSchema(), "end", { id: "q_after_end" })).toThrow("Cannot add after terminal node");
  });

  it("preserves branch targets when adding after a branching node", () => {
    const base = cloneSchema();
    const branching: SurveySchema = {
      ...base,
      nodes: base.nodes.map((node) =>
        node.id === "q_gender"
          ? {
              ...node,
              branches: [{ variableName: "gender", operator: "equals", value: 1, goto: "end" }],
            }
          : node,
      ),
    };
    const schema = addNodeAfter(branching, "q_gender", { id: "q_follow_up" });
    const genderNode = schema.nodes.find((node) => node.id === "q_gender");

    expect(genderNode?.nextNodeId).toBe("q_follow_up");
    expect(genderNode?.branches?.[0].goto).toBe("end");
  });
});
