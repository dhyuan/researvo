import { NextResponse } from "next/server";
import { z } from "zod";

import { replyToFeedbackAsAdmin } from "@/lib/feedback/feedbackService";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const AdminReplyRequestZ = z.object({
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
  const configuredToken = process.env.FEEDBACK_ADMIN_TOKEN ?? process.env.ADMIN_AUTH;

  if (configuredToken) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${configuredToken}`) {
      return json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const { requirePublisher } = await import("@/lib/auth/currentUser");
  const { authErrorResponse } = await import("@/lib/auth/http");

  try {
    await requirePublisher();
    return null;
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const authResponse = await authorizeAdmin(request);
  if (authResponse) {
    return authResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_FEEDBACK_REPLY_REQUEST" }, { status: 400 });
  }

  const parsed = AdminReplyRequestZ.safeParse(body);
  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_REPLY_REQUEST" }, { status: 400 });
  }

  const { feedbackId } = await context.params;
  const reply = await replyToFeedbackAsAdmin({
    feedbackId,
    body: parsed.data.body,
  });

  if (!reply) {
    return json({ error: "FEEDBACK_NOT_FOUND" }, { status: 404 });
  }

  return json({ id: reply.id });
}
