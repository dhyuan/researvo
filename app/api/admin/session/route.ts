import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createFeedbackAdminSession,
  FEEDBACK_ADMIN_COOKIE,
  isFeedbackAdminAuthorized,
  isFeedbackAdminConfigured,
  verifyFeedbackAdminToken,
} from "@/lib/feedback/adminAuth";

const LoginRequestZ = z.object({
  token: z.string().min(1).max(512),
});

export async function GET(request: Request) {
  return NextResponse.json({
    authenticated: isFeedbackAdminAuthorized(request),
    configured: isFeedbackAdminConfigured(),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_ADMIN_LOGIN" }, { status: 400 });
  }

  const parsed = LoginRequestZ.safeParse(body);
  if (!parsed.success || !verifyFeedbackAdminToken(parsed.data.token)) {
    return NextResponse.json({ error: "INVALID_ADMIN_TOKEN" }, { status: 401 });
  }

  const session = createFeedbackAdminSession();
  if (!session) {
    return NextResponse.json({ error: "ADMIN_ACCESS_NOT_CONFIGURED" }, { status: 503 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(FEEDBACK_ADMIN_COOKIE, session, {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(FEEDBACK_ADMIN_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
