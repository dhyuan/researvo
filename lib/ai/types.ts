import type { SurveySchema } from "@/lib/schema/surveySchema";

export type AIProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type GenerateSurveySchemaInput = AIProviderConfig & {
  researchGoal: string;
  fetchImpl?: typeof fetch;
};

export type AIProviderErrorCode =
  | "HTTP_ERROR"
  | "INVALID_PROVIDER_RESPONSE"
  | "INVALID_MODEL_JSON"
  | "INVALID_SCHEMA";

export type AIProviderError = {
  code: AIProviderErrorCode;
  message: string;
};

export type GenerateSurveySchemaResult =
  | { ok: true; schema: SurveySchema }
  | { ok: false; error: AIProviderError };
