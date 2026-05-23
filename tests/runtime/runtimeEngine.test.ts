import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import type { SurveySchema } from "@/lib/schema/surveySchema";
import { getNextNode, startAnonymousAccess } from "@/lib/runtime/runtimeEngine";

describe("runtime engine", () => {
  it("allows anonymous access when policy is anonymous", () => {
    const result = startAnonymousAccess(exampleSurveySchema.policy);

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.accessMode).toBe("anonymous");
    }
  });

  it("rejects non-anonymous access modes in the MVP runtime", () => {
    const result = startAnonymousAccess({
      ...exampleSurveySchema.policy,
      accessMode: "oauth",
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("ACCESS_MODE_NOT_ENABLED");
    }
  });

  it("moves from consent to the first question", () => {
    const result = getNextNode({
      schema: exampleSurveySchema,
      currentNodeId: "consent",
      answers: {},
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextNode?.id).toBe("q_gender");
    }
  });

  it("moves from gender question to terminal node", () => {
    const result = getNextNode({
      schema: exampleSurveySchema,
      currentNodeId: "q_gender",
      answers: { gender: 1 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextNode?.id).toBe("end");
    }
  });

  it("uses the first matching branch before default traversal", () => {
    const schema: SurveySchema = {
      ...exampleSurveySchema,
      variables: [
        ...exampleSurveySchema.variables,
        {
          name: "male_followup",
          label: "Male follow-up",
          type: "text",
          questionNodeId: "q_male_followup",
        },
      ],
      nodes: [
        ...exampleSurveySchema.nodes.map((node) =>
          node.id === "q_gender"
            ? {
                ...node,
                branches: [{ variableName: "gender", operator: "equals" as const, value: 1, goto: "q_male_followup" }],
              }
            : node,
        ),
        {
          id: "q_male_followup",
          type: "short_text",
          title: "Male follow-up",
          variableName: "male_followup",
          nextNodeId: "end",
        },
      ],
      edges: [
        ...exampleSurveySchema.edges,
        { from: "q_gender", to: "q_male_followup" },
        { from: "q_male_followup", to: "end" },
      ],
    };

    const result = getNextNode({
      schema,
      currentNodeId: "q_gender",
      answers: { gender: 1 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextNode?.id).toBe("q_male_followup");
    }
  });
});
