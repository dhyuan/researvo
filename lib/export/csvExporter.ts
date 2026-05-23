import type { SurveySchema } from "@/lib/schema/surveySchema";

export type ExportableSubmission = {
  id: string;
  surveyVersionId: string;
  submittedAt: string;
  answers: Record<string, unknown>;
};

export type ExportResponsesInput = {
  schema: SurveySchema;
  submissions: ExportableSubmission[];
};

const stringifyCell = (value: unknown) => {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(";");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const escapeCsvCell = (value: unknown) => {
  const cell = stringifyCell(value);

  if (!/[",\n\r]/.test(cell)) {
    return cell;
  }

  return `"${cell.replaceAll("\"", "\"\"")}"`;
};

export const exportResponsesToCsv = ({ schema, submissions }: ExportResponsesInput) => {
  const variableNames = schema.variables.map((variable) => variable.name);
  const header = ["submission_id", "survey_version_id", "submitted_at", ...variableNames];
  const rows = submissions.map((submission) => [
    submission.id,
    submission.surveyVersionId,
    submission.submittedAt,
    ...variableNames.map((variableName) => submission.answers[variableName]),
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
};
