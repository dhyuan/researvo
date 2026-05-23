"use client";

import { SurveySchemaZ, type SurveySchema } from "@/lib/schema/surveySchema";
import { RespondentSurvey } from "@/components/respondent/RespondentSurvey";

type SurveyPreviewProps = {
  schemaText: string;
};

const parseSchema = (schemaText: string): SurveySchema | null => {
  try {
    return SurveySchemaZ.parse(JSON.parse(schemaText));
  } catch {
    return null;
  }
};

export function SurveyPreview({ schemaText }: SurveyPreviewProps) {
  const schema = parseSchema(schemaText);

  if (!schema) {
    return <p className="text-sm text-slate-500">Enter valid schema JSON to preview.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-[var(--hs-border)] bg-[var(--hs-primary-soft)] px-3 py-2 text-xs font-semibold uppercase text-[var(--hs-primary-deep)]">
        Preview mode, not recorded
      </p>
      <RespondentSurvey schema={schema} previewMode />
    </div>
  );
}
