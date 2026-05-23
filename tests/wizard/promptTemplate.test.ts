import { describe, expect, it } from "vitest";

import { buildExternalSchemaPrompt } from "@/lib/wizard/promptTemplate";

describe("buildExternalSchemaPrompt", () => {
  it("includes user research context and strict survey generator schema constraints", () => {
    const prompt = buildExternalSchemaPrompt({
      title: "Consumer behavior",
      researchGoal: "Measure snack purchase motivation",
      questionDescription: "Ask about age, purchase frequency, and brand preference",
    });

    expect(prompt).toContain("Consumer behavior");
    expect(prompt).toContain("Measure snack purchase motivation");
    expect(prompt).toContain('schemaVersion must be "0.0.1"');
    expect(prompt).toContain("Return only one strict JSON object");
    expect(prompt).toContain('"survey": {}');
    expect(prompt).toContain('- survey.entryNodeId must be "consent".');
    expect(prompt).toContain(
      '- policy must be exactly {"accessMode":"anonymous","duplicatePrevention":"none","captcha":"off","piiHandling":"minimized"}.',
    );
    expect(prompt).toContain('Variable type values must be only: "categorical", "text", "numeric", "scale", "boolean"');
    expect(prompt).toContain("Every variable must include label");
    expect(prompt).toContain(
      '- Every variable.missingValues must include exactly or at least {"reason":"skipped","value":null,"label":"未回答"}.',
    );
    expect(prompt).toContain("Every option must include id, label, and value");
    expect(prompt).toContain("Edge objects must contain only from and to");
    expect(prompt).toContain("Top-level consent must include id, title, body, and required");
    expect(prompt).toContain("respondents may skip questions they do not want to answer");
    expect(prompt).toContain("Every node must include title");
    expect(prompt).toContain('Every likert node must include "scale" metadata');
    expect(prompt).toContain("Scale labels must use scale.anchors");
    expect(prompt).toContain('metadata.mode must describe the generated question mix');
    expect(prompt).toContain("Do not add demographic questions unless the user explicitly requested them");
  });

  it("guides attitude and degree yes/no-shaped questions to likert scales", () => {
    const prompt = buildExternalSchemaPrompt({
      questionDescription: "你觉得家庭、社会或者成长环境，对女性的人生选择影响大吗？",
    });

    expect(prompt).toContain("影响大吗");
    expect(prompt).toContain("重要吗");
    expect(prompt).toContain("agree/disagree or low/high degree judgment");
    expect(prompt).toContain('use node.type "likert" and variable type "scale"');
    expect(prompt).toContain("Pure factual or behavioral yes/no questions");
  });
});
