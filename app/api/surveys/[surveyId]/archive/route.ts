import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { requireOwnedSurvey } from "@/lib/auth/ownership";
import { archiveSurvey } from "@/lib/persistence/repositories";

type RouteContext = {
  params: Promise<{ surveyId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { surveyId } = await context.params;

    await requireOwnedSurvey(user.id, surveyId);

    const survey = await archiveSurvey(surveyId);

    return NextResponse.json({ survey });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "SURVEY_ARCHIVE_FAILED" }, { status: 500 });
  }
}
