import { NextResponse } from "next/server";
import { createRespondentSession, getSurveyVersionByPublicId } from "@/lib/persistence/repositories";
import { startAnonymousAccess } from "@/lib/runtime/accessGate";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";

type RouteContext = {
  params: Promise<{ publicId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { publicId } = await context.params;
  const version = await getSurveyVersionByPublicId(publicId);

  if (!version) {
    return NextResponse.json({ error: "SURVEY_NOT_FOUND" }, { status: 404 });
  }

  const schemaResult = SurveySchemaZ.safeParse(version.schema);

  if (!schemaResult.success) {
    return NextResponse.json({ error: "INVALID_PUBLISHED_SCHEMA" }, { status: 500 });
  }

  const access = startAnonymousAccess(schemaResult.data.policy);

  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const session = await createRespondentSession(version.id);

  return NextResponse.json({ session, surveyVersion: version, schema: schemaResult.data });
}
