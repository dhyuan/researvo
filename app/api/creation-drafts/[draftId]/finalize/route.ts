import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { checkRateLimit } from "@/lib/rate-limit/memoryRateLimiter";
import { finalizeCreationDraft } from "@/lib/wizard/creationDraftService";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const FINALIZE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const limit = checkRateLimit(`finalize:${user.id}`, 20, FINALIZE_WINDOW_MS);

    if (!limit.ok) {
      return NextResponse.json(
        { error: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429 },
      );
    }

    const { draftId } = await context.params;
    const result = await finalizeCreationDraft(user.id, draftId);

    if (!result.ok) {
      return NextResponse.json(result, { status: result.error === "DRAFT_NOT_FOUND" ? 404 : 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "FINALIZE_FAILED" }, { status: 500 });
  }
}
