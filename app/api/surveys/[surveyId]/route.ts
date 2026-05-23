import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { requireOwnedSurvey } from "@/lib/auth/ownership";
import { deleteSurvey } from "@/lib/persistence/repositories";

type RouteContext = {
  params: Promise<{ surveyId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { surveyId } = await context.params;

    await requireOwnedSurvey(user.id, surveyId);
    await deleteSurvey(surveyId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "SURVEY_DELETE_FAILED" }, { status: 500 });
  }
}
