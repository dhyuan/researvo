import { strToU8, zipSync } from "fflate";

import { exportResponsesToCsv } from "./csvExporter";
import { exportResponsesToJson, type ExportSubmission } from "./jsonExporter";
import type { SurveySchema } from "@/lib/schema/surveySchema";

export type ExportSurveyPackageInput = {
  schema: SurveySchema;
  submissions: ExportSubmission[];
};

export const exportSurveyPackage = ({ schema, submissions }: ExportSurveyPackageInput) =>
  zipSync({
    "schema.json": strToU8(JSON.stringify(schema, null, 2)),
    "responses.json": strToU8(JSON.stringify(exportResponsesToJson({ schema, submissions }), null, 2)),
    "responses.csv": strToU8(exportResponsesToCsv({ schema, submissions })),
  });
