import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { BranchRuleZ, SurveySchemaZ } from "@/lib/schema/surveySchema";

describe("Survey Schema V0.0.1", () => {
  it("accepts the example research survey schema", () => {
    const parsed = SurveySchemaZ.parse(exampleSurveySchema);

    expect(parsed.schemaVersion).toBe("0.0.1");
    expect(parsed.variables[0].name).toBe("gender");
    expect(parsed.nodes[0].id).toBe("consent");
  });

  it("rejects unsupported schema versions", () => {
    const invalid = { ...exampleSurveySchema, schemaVersion: "0.0.2" };

    expect(() => SurveySchemaZ.parse(invalid)).toThrow();
  });

  it("rejects unknown top-level keys", () => {
    const invalid = { ...exampleSurveySchema, unexpected: true };

    expect(() => SurveySchemaZ.parse(invalid)).toThrow();
  });

  it("rejects invalid branch rules", () => {
    expect(() =>
      BranchRuleZ.parse({
        variableName: "gender",
        operator: "in",
        value: 1,
        goto: "end",
      }),
    ).toThrow();

    expect(() =>
      BranchRuleZ.parse({
        variableName: "gender",
        operator: "exists",
        value: 1,
        goto: "end",
      }),
    ).toThrow();
  });

  it("accepts valid branch rules", () => {
    expect(
      BranchRuleZ.parse({
        variableName: "gender",
        operator: "equals",
        value: 1,
        goto: "end",
      }),
    ).toMatchObject({ operator: "equals" });

    expect(
      BranchRuleZ.parse({
        variableName: "gender",
        operator: "in",
        value: [1, 2],
        goto: "end",
      }),
    ).toMatchObject({ operator: "in" });

    expect(
      BranchRuleZ.parse({
        variableName: "gender",
        operator: "exists",
        goto: "end",
      }),
    ).toMatchObject({ operator: "exists" });

    expect(
      BranchRuleZ.parse({
        variableName: "gender",
        operator: "missing",
        goto: "end",
      }),
    ).toMatchObject({ operator: "missing" });
  });
});
