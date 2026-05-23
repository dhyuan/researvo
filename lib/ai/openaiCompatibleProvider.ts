import { formatSurveySchemaError } from "@/lib/schema/schemaParseFeedback";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";
import { buildSurveySchemaSystemPrompt, buildSurveySchemaUserPrompt } from "./prompts";
import type { GenerateSurveySchemaInput, GenerateSurveySchemaResult } from "./types";

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

const parseProviderResponse = async (response: Response): Promise<string> => {
  const body = (await response.json()) as OpenAICompatibleResponse;
  const content = body.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new Error("Provider response did not include choices[0].message.content");
  }

  return content;
};

const parseModelJson = (content: string): unknown => {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Model content was not valid JSON");
  }
};

export const generateSurveySchema = async ({
  baseUrl,
  apiKey,
  model,
  researchGoal,
  fetchImpl = fetch,
}: GenerateSurveySchemaInput): Promise<GenerateSurveySchemaResult> => {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSurveySchemaSystemPrompt() },
        { role: "user", content: buildSurveySchemaUserPrompt(researchGoal) },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: "HTTP_ERROR",
        message: `Provider returned HTTP ${response.status}`,
      },
    };
  }

  let content: string;

  try {
    content = await parseProviderResponse(response);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INVALID_PROVIDER_RESPONSE",
        message: error instanceof Error ? error.message : "Invalid provider response",
      },
    };
  }

  let parsedJson: unknown;

  try {
    parsedJson = parseModelJson(content);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INVALID_MODEL_JSON",
        message: error instanceof Error ? error.message : "Model content was not valid JSON",
      },
    };
  }

  const schemaResult = SurveySchemaZ.safeParse(parsedJson);

  if (!schemaResult.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_SCHEMA",
        message: formatSurveySchemaError(schemaResult.error),
      },
    };
  }

  return { ok: true, schema: schemaResult.data };
};
