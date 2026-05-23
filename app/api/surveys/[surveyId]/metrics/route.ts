import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { requireOwnedSurvey } from "@/lib/auth/ownership";
import { calculateSurveyMetrics } from "@/lib/metrics/metricsService";
import { prisma } from "@/lib/persistence/repositories";

type RouteContext = {
  params: Promise<{ surveyId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { surveyId } = await context.params;

    await requireOwnedSurvey(user.id, surveyId);

    const sessions = await prisma.respondentSession.findMany({
      where: {
        surveyVersion: {
          surveyId,
        },
      },
      select: {
        status: true,
        startedAt: true,
        submittedAt: true,
      },
    });

    return NextResponse.json({ metrics: calculateSurveyMetrics(sessions) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "METRICS_LOAD_FAILED" }, { status: 500 });
  }
}
