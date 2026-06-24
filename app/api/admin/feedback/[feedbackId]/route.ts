import { NextResponse } from "next/server";
import { z } from "zod";

import { updateFeedbackStatusAsAdmin } from "@/lib/feedback/feedbackService";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const AdminFeedbackStatusRequestZ = z.object({
  status: z.enum(["open", "replied", "resolved", "ignored"]),
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

export async function PATCH(
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
    return json({ error: "INVALID_FEEDBACK_STATUS_REQUEST" }, { status: 400 });
  }

  const parsed = AdminFeedbackStatusRequestZ.safeParse(body);
  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_STATUS_REQUEST" }, { status: 400 });
  }

  const { feedbackId } = await context.params;
  const feedback = await updateFeedbackStatusAsAdmin({
    feedbackId,
    status: parsed.data.status,
  });

  return json({ id: feedback.id });
}
