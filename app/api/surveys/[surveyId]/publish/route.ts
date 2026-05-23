import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { requireOwnedSurvey } from "@/lib/auth/ownership";
import { createSurveyVersion, getSurveyDraft, prisma } from "@/lib/persistence/repositories";
import { publishSurveyDraft } from "@/lib/publishing/publishingService";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";
import { completeCreationDraftForSurvey } from "@/lib/wizard/creationDraftService";

type RouteContext = {
  params: Promise<{ surveyId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { surveyId } = await context.params;

    await requireOwnedSurvey(user.id, surveyId);

    const draft = await getSurveyDraft(surveyId);

    if (!draft) {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }

    const schemaResult = SurveySchemaZ.safeParse(draft.schema);

    if (!schemaResult.success) {
      return NextResponse.json({ error: "INVALID_SCHEMA", issues: schemaResult.error.issues }, { status: 400 });
    }

    const versionCount = await prisma.surveyVersion.count({ where: { surveyId } });
    const result = await publishSurveyDraft({
      surveyId,
      draftSchema: schemaResult.data,
      nextVersion: versionCount + 1,
    });

    if (!result.ok) {
      return NextResponse.json({ validationReport: result.validationReport }, { status: 409 });
    }

    const version = await createSurveyVersion({
      surveyId,
      version: result.version.version,
      publicId: result.version.publicId,
      schema: result.version.schema,
    });
    await completeCreationDraftForSurvey(user.id, surveyId);

    return NextResponse.json({ version, publicUrl: `/public/s/${version.publicId}` });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "PUBLISH_FAILED" }, { status: 500 });
  }
}
