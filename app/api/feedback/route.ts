import { NextResponse } from "next/server";
import { z } from "zod";

import { listFeedbackForInstall, submitFeedback } from "@/lib/feedback/feedbackService";
import { getClientIp } from "@/lib/http/clientIp";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const FeedbackRequestZ = z.object({
  token: z.string().min(1),
  sourceApp: z.string().min(1).max(80),
  channel: z.string().min(1).max(80).optional(),
  device: z.string().min(1).max(120).optional(),
  version: z.string().min(1).max(80).optional(),
  installId: z.string().min(1).max(200).optional(),
  appVersion: z.string().min(1).max(120).optional(),
  parentId: z.string().min(1).optional(),
  message: z.string().trim().min(1).max(4000),
});

const FeedbackListQueryZ = z.object({
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

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  const parsed = FeedbackRequestZ.safeParse(body);

  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  const ipAddress = getClientIp(request.headers);
  const feedback = await submitFeedback({
    ...parsed.data,
    ...(ipAddress ? { ipAddress } : {}),
  });

  if (!feedback) {
    return json({ error: "INVALID_FEEDBACK_TOKEN" }, { status: 401 });
  }

  return json({ ok: true, id: feedback.id, feedbackId: feedback.id });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = FeedbackListQueryZ.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  const items = await listFeedbackForInstall(parsed.data);

  if (!items) {
    return json({ error: "INVALID_FEEDBACK_TOKEN" }, { status: 401 });
  }

  return json({ items });
}
