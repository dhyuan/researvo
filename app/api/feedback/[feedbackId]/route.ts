import { NextResponse } from "next/server";
import { z } from "zod";

import { getFeedbackDetail } from "@/lib/feedback/feedbackService";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const FeedbackDetailQueryZ = z.object({
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

export async function GET(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const { searchParams } = new URL(request.url);
  const parsed = FeedbackDetailQueryZ.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  const { feedbackId } = await context.params;
  const detail = await getFeedbackDetail({
    ...parsed.data,
    feedbackId,
  });

  if (!detail) {
    return json({ error: "FEEDBACK_NOT_FOUND" }, { status: 404 });
  }

  return json(detail);
}
