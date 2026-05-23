import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { requireOwnedSurvey } from "@/lib/auth/ownership";
import { getSurveyDraft } from "@/lib/persistence/repositories";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";
import { validateSurveySchema } from "@/lib/validation/schemaValidator";

type RouteContext = {
  params: Promise<{ surveyId: string }>;
};

function isRequestObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { surveyId } = await context.params;

    await requireOwnedSurvey(user.id, surveyId);

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

    const draft = body.schema === undefined ? await getSurveyDraft(surveyId) : null;

    if (body.schema === undefined && !draft) {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }

    const schemaInput = body.schema ?? draft?.schema;
    const schemaResult = SurveySchemaZ.safeParse(schemaInput);

    if (!schemaResult.success) {
      return NextResponse.json({ error: "INVALID_SCHEMA", issues: schemaResult.error.issues }, { status: 400 });
    }

    return NextResponse.json({ validationReport: validateSurveySchema(schemaResult.data) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 500 });
  }
}
