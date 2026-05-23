import type { SurveySchema } from "@/lib/schema/surveySchema";
import type { ExportableSubmission } from "./csvExporter";

export type ExportSubmission = ExportableSubmission;

export type JsonExport = {
  schemaVersion: "0.0.1";
  survey: SurveySchema["survey"];
  variables: SurveySchema["variables"];
  submissions: ExportSubmission[];
};

export const exportResponsesToJson = ({
  schema,
  submissions,
}: {
  schema: SurveySchema;
  submissions: ExportSubmission[];
}): JsonExport => ({
  schemaVersion: schema.schemaVersion,
  survey: schema.survey,
  variables: schema.variables,
  submissions,
});
