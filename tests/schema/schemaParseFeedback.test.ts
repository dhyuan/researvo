import { describe, expect, it } from "vitest";

import { formatSurveySchemaError } from "@/lib/schema/schemaParseFeedback";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";

describe("formatSurveySchemaError", () => {
  it("explains schema mismatches with field paths and concrete fixes", () => {
    const result = SurveySchemaZ.safeParse({
      schemaVersion: "0.0.1",
      survey: {
        id: "income-inequality",
        title: "Income inequality",
        language: "zh",
        entryNodeId: "consent_1",
      },
      policy: { accessMode: "anonymous" },
      variables: [
        { name: "equal_costs_income_career", type: "ordinal" },
        { name: "extra_costs_women", type: "array" },
      ],
      nodes: [
        {
          id: "consent_1",
          type: "consent",
          title: "知情同意",
          description: "Extra field should be body or top-level consent.body.",
          analysis: "consent",
          variableName: "consent_participate",
        },
        {
          id: "q_gender_identity",
          type: "single_choice",
          title: "你的性别认同是？",
          variableName: "gender_identity",
          options: [{ value: "female", label: "女性" }],
        },
      ],
      edges: [
        {
          from: "consent_1",
          to: "q_gender_identity",
          condition: { variable: "consent_participate", equals: true },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    const message = formatSurveySchemaError(result.error);

    expect(message).toContain("variables[0].label");
    expect(message).toContain("Add a human-readable label");
    expect(message).toContain("variables[0].type");
    expect(message).toContain('"scale"');
    expect(message).toContain("array is not supported");
    expect(message).toContain("nodes[0]");
    expect(message).toContain("Unexpected field");
    expect(message).toContain("nodes[1].options[0].id");
    expect(message).toContain("edges[0].condition.operator");
    expect(message).toContain('"equals"');
  });

  it("prioritizes distinct actionable issues instead of repeating missing node titles", () => {
    const result = SurveySchemaZ.safeParse({
      schemaVersion: "0.0.1",
      survey: {
        id: "income-inequality",
        title: "Income inequality",
        language: "zh-CN",
        entryNodeId: "consent_001",
      },
      policy: { accessMode: "anonymous" },
      consent: {
        body: "Consent text without id or title.",
      },
      variables: [],
      nodes: [
        {
          id: "consent_001",
          type: "consent",
          body: "Consent text",
          variableName: "consent_given",
        },
        {
          id: "q001",
          type: "likert",
          body: "Question text",
          variableName: "q001",
        },
        {
          id: "terminal_complete",
          type: "terminal",
          body: "Done",
        },
      ],
      edges: [
        {
          from: "consent_001",
          to: "q001",
          conditions: [
            {
              variableName: "consent_given",
              operator: "equals",
              value: true,
              goto: "q001",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    const message = formatSurveySchemaError(result.error);

    expect(message).toContain("consent.id");
    expect(message).toContain("Top-level consent must include id, title, and body");
    expect(message).toContain("nodes[0].title");
    expect(message).toContain("Every node must include title");
    expect(message).toContain("edges[0]");
    expect(message).toContain("Unexpected field(s): conditions");
    expect(message).toContain('Use "condition"');
  });

  it("explains unsupported scale labels and edge ids from generated schemas", () => {
    const result = SurveySchemaZ.safeParse({
      schemaVersion: "0.0.1",
      survey: {
        id: "income-inequality",
        title: "Income inequality",
        language: "zh-CN",
        entryNodeId: "q001",
      },
      policy: { accessMode: "anonymous" },
      variables: [],
      nodes: [
        {
          id: "q001",
          type: "likert",
          title: "你觉得影响大吗？",
          variableName: "q001",
          scale: {
            min: 1,
            max: 5,
            minLabel: "完全没有影响",
            maxLabel: "影响非常大",
          },
        },
        {
          id: "end",
          type: "terminal",
          title: "完成",
        },
      ],
      edges: [
        {
          id: "e_q001_end",
          from: "q001",
          to: "end",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    const message = formatSurveySchemaError(result.error);

    expect(message).toContain("nodes[0].scale");
    expect(message).toContain("Use scale.anchors");
    expect(message).toContain("edges[0]");
    expect(message).toContain("Do not include edge id");
  });
});
