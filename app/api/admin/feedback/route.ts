import { NextResponse } from "next/server";
import { z } from "zod";

import { listFeedbackThreadsForAdmin } from "@/lib/feedback/feedbackService";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const AdminFeedbackListQueryZ = z.object({
  sourceApp: z.string().min(1).max(80).optional(),
  status: z.enum(["open", "replied", "resolved", "ignored"]).optional(),
  channel: z.string().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
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

export async function GET(request: Request) {
  const authResponse = await authorizeAdmin(request);
  if (authResponse) {
    return authResponse;
  }

  const { searchParams } = new URL(request.url);
  const parsed = AdminFeedbackListQueryZ.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
  }

  return json(await listFeedbackThreadsForAdmin(parsed.data));
}
