import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { updateCreationDraft, type CreationDraftInput } from "@/lib/wizard/creationDraftService";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function draftInputFromBody(body: Record<string, unknown>): CreationDraftInput {
  const input: CreationDraftInput = {
    title: typeof body.title === "string" ? body.title : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    researchGoal: typeof body.researchGoal === "string" ? body.researchGoal : undefined,
    questionDescription: typeof body.questionDescription === "string" ? body.questionDescription : undefined,
    constraints: typeof body.constraints === "string" ? body.constraints : undefined,
  };

  if ("schema" in body) {
    input.schema = body.schema;
  }

  return input;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { draftId } = await context.params;
    let bodyInput: unknown;

    try {
      bodyInput = await request.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    if (!isJsonRecord(bodyInput)) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const draft = await updateCreationDraft(user.id, draftId, draftInputFromBody(bodyInput));

    if (!draft) {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "DRAFT_UPDATE_FAILED" }, { status: 500 });
  }
}
