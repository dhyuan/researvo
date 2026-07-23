import { NextResponse } from "next/server";
import { z } from "zod";

import { scheduleFeedbackIpLocation } from "@/lib/feedback/ipLocationScheduler";
import { sendUserFeedbackMessage } from "@/lib/feedback/feedbackService";
import { getClientIp } from "@/lib/http/clientIp";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const FeedbackThreadMessageRequestZ = z.object({
  token: z.string().min(1),
  sourceApp: z.string().min(1).max(80),
  channel: z.string().min(1).max(80),
  device: z.string().min(1).max(120).optional(),
  installId: z.string().min(1).max(200),
  appVersion: z.string().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(4000),
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

  const parsed = FeedbackThreadMessageRequestZ.safeParse(body);

  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  const ipAddress = getClientIp(request.headers);
  const message = await sendUserFeedbackMessage({
    ...parsed.data,
    ...(ipAddress ? { ipAddress } : {}),
  });

  if (!message) {
    return json({ error: "INVALID_FEEDBACK_TOKEN" }, { status: 401 });
  }

  scheduleFeedbackIpLocation(message.id, ipAddress);

  return json({ id: message.id });
}
