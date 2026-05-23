import { describe, expect, it } from "vitest";
import type { SurveySchema } from "@/lib/schema/surveySchema";
import { validateGraph } from "@/lib/validation/graphValidator";

describe("graphValidator", () => {
  it("does not warn for nodes reachable only via schema.edges", () => {
    const schema: SurveySchema = {
      schemaVersion: "0.0.1",
      survey: {
        id: "s1",
        title: "S1",
        language: "en",
        entryNodeId: "consent",
      },
      policy: {
        accessMode: "anonymous",
      },
      consent: {
        id: "consent",
        title: "Consent",
        body: "ok",
        required: true,
      },
      variables: [
        {
          name: "conf",
          label: "Confidence",
          type: "categorical",
          questionNodeId: "q_survey_tool_confidence",
          coding: [{ label: "Low", value: 1 }],
        },
      ],
      nodes: [
        { id: "consent", type: "consent", title: "Consent", variableName: null },
        {
          id: "q_survey_tool_confidence",
          type: "single_choice",
          title: "Confidence",
          variableName: "conf",
          options: [{ id: "o1", label: "Low", value: 1 }],
        },
        { id: "end", type: "terminal", title: "End", variableName: null },
      ],
      edges: [
        { from: "consent", to: "q_survey_tool_confidence" },
        { from: "q_survey_tool_confidence", to: "end" },
      ],
      metadata: {},
    };

    const findings = validateGraph(schema);

    const unreachable = findings.some(
      (f) => f.code === "UNREACHABLE_NODE" && f.nodeId === "q_survey_tool_confidence"
    );

    expect(unreachable).toBe(false);
  });

  it("does warn for nodes connected only by schema.edges from terminal nodes", () => {
    const schema: SurveySchema = {
      schemaVersion: "0.0.1",
      survey: {
        id: "s1",
        title: "S1",
        language: "en",
        entryNodeId: "consent",
      },
      policy: {
        accessMode: "anonymous",
      },
      consent: {
        id: "consent",
        title: "Consent",
        body: "ok",
        required: true,
      },
      variables: [
        {
          name: "after_end",
          label: "After end",
          type: "text",
          questionNodeId: "q_after_end",
        },
      ],
      nodes: [
        { id: "consent", type: "consent", title: "Consent", variableName: null, nextNodeId: "end" },
        { id: "end", type: "terminal", title: "End", variableName: null },
        { id: "q_after_end", type: "short_text", title: "After end", variableName: "after_end" },
      ],
      edges: [
        { from: "consent", to: "end" },
        { from: "end", to: "q_after_end" },
      ],
      metadata: {},
    };

    const findings = validateGraph(schema);

    const unreachable = findings.some(
      (f) => f.code === "UNREACHABLE_NODE" && f.nodeId === "q_after_end",
    );

    expect(unreachable).toBe(true);
  });
});
