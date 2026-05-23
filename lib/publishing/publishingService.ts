import { randomBytes } from "node:crypto";
import type { SurveySchema } from "@/lib/schema/surveySchema";
import { validateSurveySchema } from "@/lib/validation/schemaValidator";
import type { ValidationReport } from "@/lib/validation/types";

export type PublishSurveyDraftInput = {
  surveyId: string;
  draftSchema: SurveySchema;
  nextVersion: number;
};

export type PublishedSurveyVersion = {
  surveyId: string;
  version: number;
  publicId: string;
  schema: SurveySchema;
  createdAt: Date;
};

export type PublishSurveyDraftResult =
  | { ok: false; validationReport: ValidationReport }
  | { ok: true; validationReport: ValidationReport; version: PublishedSurveyVersion };

const generatePublicId = () => `s_${randomBytes(16).toString("base64url")}`;

export const publishSurveyDraft = async ({
  surveyId,
  draftSchema,
  nextVersion,
}: PublishSurveyDraftInput): Promise<PublishSurveyDraftResult> => {
  const validationReport = validateSurveySchema(draftSchema);

  if (validationReport.hasBlockingErrors) {
    return { ok: false, validationReport };
  }

  return {
    ok: true,
    validationReport,
    version: {
      surveyId,
      version: nextVersion,
      publicId: generatePublicId(),
      schema: structuredClone(draftSchema),
      createdAt: new Date(),
    },
  };
};
