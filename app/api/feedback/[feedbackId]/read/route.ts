import { NextResponse } from "next/server";
import { z } from "zod";

import { markFeedbackRepliesRead } from "@/lib/feedback/feedbackService";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const FeedbackReadQueryZ = z.object({
  token: z.string().min(1),
  sourceApp: z.string().min(1).max(80),
  installId: z.string().min(1).max(200),
});

const json = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init?.headers,
    },
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const { searchParams } = new URL(request.url);
  const parsed = FeedbackReadQueryZ.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  const { feedbackId } = await context.params;
  const marked = await markFeedbackRepliesRead({
    ...parsed.data,
    feedbackId,
  });

  if (!marked) {
    return json({ error: "FEEDBACK_NOT_FOUND" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
