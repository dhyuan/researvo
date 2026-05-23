import { describe, expect, it } from "vitest";
import { generateSurveySchema } from "@/lib/ai/openaiCompatibleProvider";

describe("generateSurveySchema", () => {
  it("extracts JSON schema content from an OpenAI-compatible response", async () => {
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "{\"schemaVersion\":\"0.0.1\",\"survey\":{\"id\":\"s\",\"title\":\"T\",\"description\":\"D\",\"language\":\"en\",\"entryNodeId\":\"end\"},\"policy\":{\"accessMode\":\"anonymous\",\"duplicatePrevention\":\"none\",\"captcha\":\"off\",\"piiHandling\":\"none\"},\"variables\":[],\"nodes\":[{\"id\":\"end\",\"type\":\"terminal\",\"title\":\"Complete\",\"variableName\":null}],\"edges\":[],\"metadata\":{}}",
              },
            },
          ],
        }),
      );

    const result = await generateSurveySchema({
      baseUrl: "http://localhost:11434/v1",
      apiKey: "local",
      model: "llama3.1",
      researchGoal: "Measure student study habits.",
      fetchImpl: fakeFetch,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.schema.schemaVersion).toBe("0.0.1");
    }
  });

  it("returns a structured error when model content is not valid schema JSON", async () => {
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "not json" } }],
        }),
      );

    const result = await generateSurveySchema({
      baseUrl: "http://localhost:11434/v1",
      apiKey: "local",
      model: "llama3.1",
      researchGoal: "Measure student study habits.",
      fetchImpl: fakeFetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_MODEL_JSON");
    }
  });

  it("returns actionable schema feedback when model JSON does not match Researvo format", async () => {
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "{\"schemaVersion\":\"0.0.1\",\"survey\":{\"id\":\"s\",\"title\":\"T\",\"language\":\"en\",\"entryNodeId\":\"q\"},\"policy\":{\"accessMode\":\"anonymous\"},\"variables\":[{\"name\":\"income\",\"type\":\"ordinal\"}],\"nodes\":[{\"id\":\"q\",\"type\":\"single_choice\",\"title\":\"Q\",\"variableName\":\"income\",\"options\":[{\"label\":\"A\",\"value\":\"a\"}]}],\"edges\":[]}",
              },
            },
          ],
        }),
      );

    const result = await generateSurveySchema({
      baseUrl: "http://localhost:11434/v1",
      apiKey: "local",
      model: "llama3.1",
      researchGoal: "Measure student study habits.",
      fetchImpl: fakeFetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_SCHEMA");
      expect(result.error.message).toContain("variables[0].label");
      expect(result.error.message).toContain("Variable type values must be only");
      expect(result.error.message).toContain("options[0].id");
    }
  });
});
