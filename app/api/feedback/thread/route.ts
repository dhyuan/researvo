import { NextResponse } from "next/server";
import { z } from "zod";

import { recordFeedbackClientCacheQuery } from "@/lib/feedback/feedbackCache";
import {
  findAuthorizedApp,
  getCurrentFeedbackThread,
} from "@/lib/feedback/feedbackService";

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

  const app = await findAuthorizedApp(parsed.data.sourceApp, parsed.data.token);
  if (!app) {
    return json({ error: "INVALID_FEEDBACK_TOKEN" }, { status: 401 });
  }

  const thread = await getCurrentFeedbackThread(parsed.data);
  await recordFeedbackClientCacheQuery(
    parsed.data.sourceApp,
    parsed.data.installId,
  );
  if (!thread) {
    return json({ error: "FEEDBACK_NOT_FOUND" }, { status: 404 });
  }

  return json(thread);
}
