import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { requireOwnedSurvey } from "@/lib/auth/ownership";
import { exportResponsesToCsv } from "@/lib/export/csvExporter";
import { exportResponsesToJson } from "@/lib/export/jsonExporter";
import { exportSurveyPackage } from "@/lib/export/zipExporter";
import { listSubmissionsForSurvey, prisma } from "@/lib/persistence/repositories";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";

type RouteContext = {
  params: Promise<{ surveyId: string }>;
};

const latestVersionForSurvey = (surveyId: string) =>
  prisma.surveyVersion.findFirst({
    where: { surveyId },
    orderBy: { version: "desc" },
  });

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { surveyId } = await context.params;

    await requireOwnedSurvey(user.id, surveyId);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const version = await latestVersionForSurvey(surveyId);

    if (!version) {
      return NextResponse.json({ error: "PUBLISHED_VERSION_NOT_FOUND" }, { status: 404 });
    }

    const schemaResult = SurveySchemaZ.safeParse(version.schema);

    if (!schemaResult.success) {
      return NextResponse.json({ error: "INVALID_PUBLISHED_SCHEMA" }, { status: 500 });
    }

    if (format === "schema") {
      return NextResponse.json(schemaResult.data);
    }

    const records = await listSubmissionsForSurvey(surveyId);
    const submissions = records.map((record) => ({
      id: record.id,
      surveyVersionId: record.respondentSession.surveyVersion.id,
      submittedAt: record.createdAt.toISOString(),
      answers: record.answers as Record<string, unknown>,
    }));

    if (format === "csv") {
      return new NextResponse(exportResponsesToCsv({ schema: schemaResult.data, submissions }), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="survey-${surveyId}.csv"`,
        },
      });
    }

    if (format === "zip") {
      return new NextResponse(exportSurveyPackage({ schema: schemaResult.data, submissions }), {
        headers: {
          "content-type": "application/zip",
          "content-disposition": `attachment; filename="survey-${surveyId}-package.zip"`,
        },
      });
    }

    if (format === "json") {
      return NextResponse.json(exportResponsesToJson({ schema: schemaResult.data, submissions }));
    }

    return NextResponse.json({ error: "UNSUPPORTED_EXPORT_FORMAT" }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "EXPORT_FAILED" }, { status: 500 });
  }
}
