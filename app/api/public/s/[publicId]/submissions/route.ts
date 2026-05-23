import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { completeRespondentSession, getSurveyVersionByPublicId } from "@/lib/persistence/repositories";
import { normalizeSubmission } from "@/lib/runtime/submissionService";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";

type RouteContext = {
  params: Promise<{ publicId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { publicId } = await context.params;
  const body = (await request.json()) as {
    sessionId?: string;
    answers?: Record<string, unknown>;
    shownNodeIds?: string[];
    branchPath?: string[];
  };

  if (!body.sessionId || !body.answers || !body.shownNodeIds || !body.branchPath) {
    return NextResponse.json({ error: "INVALID_SUBMISSION_PAYLOAD" }, { status: 400 });
  }

  const version = await getSurveyVersionByPublicId(publicId);

  if (!version) {
    return NextResponse.json({ error: "SURVEY_NOT_FOUND" }, { status: 404 });
  }

  const schemaResult = SurveySchemaZ.safeParse(version.schema);

  if (!schemaResult.success) {
    return NextResponse.json({ error: "INVALID_PUBLISHED_SCHEMA" }, { status: 500 });
  }

  const normalized = normalizeSubmission({
    schema: schemaResult.data,
    answers: body.answers,
    shownNodeIds: body.shownNodeIds,
    branchPath: body.branchPath,
  });

  const submission = await completeRespondentSession(body.sessionId, {
    answers: normalized.answers as Prisma.InputJsonValue,
    shownNodeIds: normalized.shownNodeIds as Prisma.InputJsonValue,
    branchPath: normalized.branchPath as Prisma.InputJsonValue,
  });

  return NextResponse.json({ submission, normalized });
}
