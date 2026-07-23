import { NextResponse } from "next/server";
import { z } from "zod";

import { isFeedbackAdminAuthorized } from "@/lib/feedback/adminAuth";
import { listFeedbackThreadsForAdmin } from "@/lib/feedback/feedbackService";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const AdminFeedbackListQueryZ = z.object({
  sourceApp: z.string().min(1).max(80).optional(),
  status: z.enum(["open", "replied", "resolved", "ignored"]).optional(),
  channel: z.string().min(1).max(80).optional(),
  q: z.string().trim().min(1).max(200).optional(),
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
  if (isFeedbackAdminAuthorized(request)) {
    return null;
  }

  return json({ error: "UNAUTHORIZED" }, { status: 401 });
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
