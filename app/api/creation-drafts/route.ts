import { NextResponse } from "next/server";

import { requirePublisher } from "@/lib/auth/currentUser";
import { authErrorResponse } from "@/lib/auth/http";
import { checkRateLimit } from "@/lib/rate-limit/memoryRateLimiter";
import { getOrCreateActiveCreationDraft } from "@/lib/wizard/creationDraftService";

const CREATION_DRAFT_WINDOW_MS = 60 * 60 * 1000;

export async function GET() {
  try {
    const user = await requirePublisher();
    const draft = await getOrCreateActiveCreationDraft(user.id);

    return NextResponse.json({ draft });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "DRAFT_LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await requirePublisher();
    const limit = checkRateLimit(`creation-draft:${user.id}`, 10, CREATION_DRAFT_WINDOW_MS);

    if (!limit.ok) {
      return NextResponse.json(
        { error: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429 },
      );
    }

    const draft = await getOrCreateActiveCreationDraft(user.id);

    return NextResponse.json({ draft });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "DRAFT_CREATE_FAILED" }, { status: 500 });
  }
}
