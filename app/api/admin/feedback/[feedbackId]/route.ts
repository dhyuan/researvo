import { NextResponse } from "next/server";
import { z } from "zod";

import { isFeedbackAdminAuthorized } from "@/lib/feedback/adminAuth";
import {
  deleteFeedbackThreadAsAdmin,
  getFeedbackThreadForAdmin,
  updateFeedbackStatusAsAdmin,
} from "@/lib/feedback/feedbackService";

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
  if (isFeedbackAdminAuthorized(request)) {
    return null;
  }

  return json({ error: "UNAUTHORIZED" }, { status: 401 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const authResponse = await authorizeAdmin(request);
  if (authResponse) {
    return authResponse;
  }

  const { feedbackId } = await context.params;
  const feedback = await getFeedbackThreadForAdmin(feedbackId);

  if (!feedback) {
    return json({ error: "FEEDBACK_NOT_FOUND" }, { status: 404 });
  }

  return json(feedback);
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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const authResponse = await authorizeAdmin(request);
  if (authResponse) {
    return authResponse;
  }

  const { feedbackId } = await context.params;
  const deleted = await deleteFeedbackThreadAsAdmin(feedbackId);

  if (!deleted) {
    return json({ error: "FEEDBACK_NOT_FOUND" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
