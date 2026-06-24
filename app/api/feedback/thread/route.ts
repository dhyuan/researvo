import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentFeedbackThread } from "@/lib/feedback/feedbackService";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const FeedbackThreadQueryZ = z.object({
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = FeedbackThreadQueryZ.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  const thread = await getCurrentFeedbackThread(parsed.data);

  if (!thread) {
    return json({ error: "FEEDBACK_NOT_FOUND" }, { status: 404 });
  }

  return json(thread);
}
