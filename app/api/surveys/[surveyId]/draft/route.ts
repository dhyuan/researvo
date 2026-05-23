import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { requireOwnedSurvey } from "@/lib/auth/ownership";
import { getLatestSurveyVersion, getSurveyDraft, saveSurveyDraft } from "@/lib/persistence/repositories";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";

type RouteContext = {
  params: Promise<{ surveyId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { surveyId } = await context.params;

    await requireOwnedSurvey(user.id, surveyId);

    const draft = await getSurveyDraft(surveyId);

    if (!draft) {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }

    const latestVersion = await getLatestSurveyVersion(surveyId);

    return NextResponse.json({ draft, latestVersion });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "DRAFT_LOAD_FAILED" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { surveyId } = await context.params;

    await requireOwnedSurvey(user.id, surveyId);

    const body = (await request.json().catch(() => ({}))) as { schema?: unknown };
    const schemaResult = SurveySchemaZ.safeParse(body.schema);

    if (!schemaResult.success) {
      return NextResponse.json({ error: "INVALID_SCHEMA", issues: schemaResult.error.issues }, { status: 400 });
    }

    const draft = await saveSurveyDraft(surveyId, schemaResult.data);

    return NextResponse.json({ draft });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "DRAFT_SAVE_FAILED" }, { status: 500 });
  }
}
