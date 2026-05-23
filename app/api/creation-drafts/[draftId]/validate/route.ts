import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { checkRateLimit } from "@/lib/rate-limit/memoryRateLimiter";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";
import { validateSurveySchema } from "@/lib/validation/schemaValidator";
import { getOwnedCreationDraft } from "@/lib/wizard/creationDraftService";
import { summarizeSchema } from "@/lib/wizard/validationSummary";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const VALIDATE_WINDOW_MS = 60 * 60 * 1000;

function recordFromJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { draftId } = await context.params;
    const limit = checkRateLimit(`creation-draft-validate:${user.id}:${draftId}`, 120, VALIDATE_WINDOW_MS);

    if (!limit.ok) {
      return NextResponse.json(
        { error: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429 },
      );
    }

    const draft = await getOwnedCreationDraft(user.id, draftId);

    if (!draft || draft.status !== "draft") {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }

    const body = recordFromJson(await request.json().catch(() => ({})));
    const schemaResult = SurveySchemaZ.safeParse(body.schema);

    if (!schemaResult.success) {
      return NextResponse.json({ error: "INVALID_SCHEMA", issues: schemaResult.error.issues }, { status: 400 });
    }

    const validationReport = validateSurveySchema(schemaResult.data);

    return NextResponse.json({
      validationReport,
      summary: summarizeSchema(schemaResult.data, validationReport),
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 500 });
  }
}
