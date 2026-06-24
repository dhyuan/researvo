import { NextResponse } from "next/server";
import { z } from "zod";

import { markCurrentFeedbackThreadRead } from "@/lib/feedback/feedbackService";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const FeedbackThreadReadQueryZ = z.object({
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

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = FeedbackThreadReadQueryZ.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  const marked = await markCurrentFeedbackThreadRead(parsed.data);

  if (!marked) {
    return json({ error: "FEEDBACK_NOT_FOUND" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
