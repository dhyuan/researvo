import { NextResponse } from "next/server";
import { z } from "zod";

import { submitFeedback } from "@/lib/feedback/feedbackService";

const FeedbackRequestZ = z.object({
  token: z.string().min(1),
  sourceApp: z.string().min(1).max(80),
  channel: z.string().min(1).max(80).optional(),
  device: z.string().min(1).max(120).optional(),
  version: z.string().min(1).max(80).optional(),
  message: z.string().min(1).max(5000),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  const parsed = FeedbackRequestZ.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  const feedback = await submitFeedback(parsed.data);

  if (!feedback) {
    return NextResponse.json({ error: "INVALID_FEEDBACK_TOKEN" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, feedbackId: feedback.id });
}
