import { NextResponse } from "next/server";
import { z } from "zod";

import { isFeedbackAdminAuthorized } from "@/lib/feedback/adminAuth";
import { checkRateLimit } from "@/lib/rate-limit/memoryRateLimiter";
import { classifyPushError, sendTestPush } from "@/lib/push/pushDispatcher";
import { getPushConfig } from "@/lib/push/pushConfig";
import { isSameOriginRequest, readLimitedJson } from "@/lib/push/pushHttp";
import {
  findCurrentAdminPushSubscription,
  hashPushEndpoint,
  invalidateAdminPushSubscription,
} from "@/lib/push/pushSubscriptions";

const TestRequestZ = z.object({
  endpoint: z.string().url().max(4096).refine((value) => new URL(value).protocol === "https:"),
});

export async function POST(request: Request) {
  if (!isFeedbackAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  const config = getPushConfig();
  if (!config.configured) {
    return NextResponse.json(
      { error: "PUSH_NOT_CONFIGURED", reason: config.reason },
      { status: 503 },
    );
  }

  const json = await readLimitedJson(request);
  if (!json.ok) {
    return NextResponse.json(
      { error: json.error },
      { status: json.error === "BODY_TOO_LARGE" ? 413 : 400 },
    );
  }

  const parsed = TestRequestZ.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PUSH_TEST_REQUEST" }, { status: 400 });
  }

  const limit = checkRateLimit(
    `admin-push-test:${hashPushEndpoint(parsed.data.endpoint)}`,
    3,
    60 * 60 * 1000,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const subscription = await findCurrentAdminPushSubscription(parsed.data.endpoint);
  if (!subscription) {
    return NextResponse.json({ error: "PUSH_SUBSCRIPTION_NOT_FOUND" }, { status: 404 });
  }

  try {
    await sendTestPush(subscription);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const classified = classifyPushError(error);
    if (classified.kind === "gone") {
      await invalidateAdminPushSubscription(parsed.data.endpoint);
    }
    return NextResponse.json(
      { error: "PUSH_TEST_FAILED", code: classified.code },
      { status: classified.kind === "gone" ? 410 : 502 },
    );
  }
}
