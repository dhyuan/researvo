import { NextResponse } from "next/server";
import { z } from "zod";

import { isFeedbackAdminAuthorized } from "@/lib/feedback/adminAuth";
import { updateAdminFeedbackMessage } from "@/lib/feedback/feedbackService";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const AdminMessageUpdateRequestZ = z.object({
  body: z.string().trim().min(1).max(4000),
});

const json = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init?.headers,
    },
  });

async function authorizeAdmin(request: Request) {
  if (isFeedbackAdminAuthorized(request)) {
    return null;
  }

  return json({ error: "UNAUTHORIZED" }, { status: 401 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ feedbackId: string; messageId: string }> },
) {
  const authResponse = await authorizeAdmin(request);
  if (authResponse) {
    return authResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_FEEDBACK_MESSAGE_REQUEST" }, { status: 400 });
  }

  const parsed = AdminMessageUpdateRequestZ.safeParse(body);
  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_MESSAGE_REQUEST" }, { status: 400 });
  }

  const { feedbackId, messageId } = await context.params;
  const message = await updateAdminFeedbackMessage({
    feedbackId,
    messageId,
    body: parsed.data.body,
  });

  if (!message) {
    return json({ error: "FEEDBACK_MESSAGE_NOT_FOUND" }, { status: 404 });
  }

  return json({ id: messageId });
}
