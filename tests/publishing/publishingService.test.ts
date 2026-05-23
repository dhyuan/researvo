import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { publishSurveyDraft } from "@/lib/publishing/publishingService";

describe("publishSurveyDraft", () => {
  it("blocks publish when validation has errors", async () => {
    const invalid = {
      ...exampleSurveySchema,
      nodes: exampleSurveySchema.nodes.map((node) =>
        node.id === "q_gender" ? { ...node, nextNodeId: "missing_node" } : node,
      ),
    };

    const result = await publishSurveyDraft({
      surveyId: "survey_1",
      draftSchema: invalid,
      nextVersion: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.validationReport.hasBlockingErrors).toBe(true);
  });

  it("creates an immutable version payload when validation passes", async () => {
    const result = await publishSurveyDraft({
      surveyId: "survey_1",
      draftSchema: exampleSurveySchema,
      nextVersion: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.version.version).toBe(1);
      expect(result.version.publicId).toMatch(/^s_/);
    }
  });

  it("deep clones the draft schema into the version payload", async () => {
    const draftSchema = structuredClone(exampleSurveySchema);

    const result = await publishSurveyDraft({
      surveyId: "survey_1",
      draftSchema,
      nextVersion: 1,
    });

    draftSchema.survey.title = "Mutated after publish";
    draftSchema.nodes[0].title = "Changed consent title";
    draftSchema.nodes[1].options?.push({ id: "new_option", label: "New option", value: 4 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.version.schema.survey.title).toBe(exampleSurveySchema.survey.title);
      expect(result.version.schema.nodes[0].title).toBe(exampleSurveySchema.nodes[0].title);
      expect(result.version.schema.nodes[1].options).toHaveLength(exampleSurveySchema.nodes[1].options?.length ?? 0);
    }
  });
});
