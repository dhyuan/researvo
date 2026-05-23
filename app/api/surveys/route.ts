import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { createSurveyDraft } from "@/lib/persistence/repositories";
import { checkRateLimit } from "@/lib/rate-limit/memoryRateLimiter";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";

const SURVEY_CREATE_WINDOW_MS = 60 * 60 * 1000;

function isRequestObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const user = await requirePublisher();
    const limit = checkRateLimit(`survey-create:${user.id}`, 20, SURVEY_CREATE_WINDOW_MS);

    if (!limit.ok) {
      return NextResponse.json(
        { error: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429 },
      );
    }

    const bodyText = await request.text();
    let body: Record<string, unknown> = {};

    if (bodyText.trim().length > 0) {
      try {
        const parsedBody = JSON.parse(bodyText) as unknown;

        if (!isRequestObject(parsedBody)) {
          return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
        }

        body = parsedBody;
      } catch {
        return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
      }
    }

    const schemaResult = SurveySchemaZ.safeParse(body.schema ?? exampleSurveySchema);

    if (!schemaResult.success) {
      return NextResponse.json({ error: "INVALID_SCHEMA", issues: schemaResult.error.issues }, { status: 400 });
    }

    const { survey, draft } = await createSurveyDraft({
      ownerId: user.id,
      title: typeof body.title === "string" ? body.title : schemaResult.data.survey.title,
      schema: schemaResult.data,
    });

    return NextResponse.json({ survey, draft });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "SURVEY_CREATE_FAILED" }, { status: 500 });
  }
}
