import { NextResponse } from "next/server";
import { z } from "zod";

import { isFeedbackAdminAuthorized } from "@/lib/feedback/adminAuth";
import { getPushConfig } from "@/lib/push/pushConfig";
import { isSameOriginRequest, readLimitedJson } from "@/lib/push/pushHttp";
import {
  disableAdminPushSubscription,
  upsertAdminPushSubscription,
} from "@/lib/push/pushSubscriptions";

const EndpointZ = z.string().url().max(4096).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:";
});

const SubscriptionZ = z.object({
  endpoint: EndpointZ,
  expirationTime: z.number().int().nonnegative().safe().nullable().default(null),
  keys: z.object({
    p256dh: z.string().min(16).max(512).regex(/^[A-Za-z0-9_-]+$/),
    auth: z.string().min(8).max(256).regex(/^[A-Za-z0-9_-]+$/),
  }),
});

const UnsubscribeZ = z.object({
  endpoint: EndpointZ,
});

function mutationGuard(request: Request) {
  if (!isFeedbackAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  return null;
}

export async function POST(request: Request) {
  const guarded = mutationGuard(request);
  if (guarded) {
    return guarded;
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

  const parsed = SubscriptionZ.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PUSH_SUBSCRIPTION" }, { status: 400 });
  }

  const subscription = await upsertAdminPushSubscription(
    parsed.data,
    request.headers.get("user-agent"),
  );
  return NextResponse.json({ ok: true, id: subscription.id });
}

export async function DELETE(request: Request) {
  const guarded = mutationGuard(request);
  if (guarded) {
    return guarded;
  }

  const json = await readLimitedJson(request);
  if (!json.ok) {
    return NextResponse.json(
      { error: json.error },
      { status: json.error === "BODY_TOO_LARGE" ? 413 : 400 },
    );
  }

  const parsed = UnsubscribeZ.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PUSH_SUBSCRIPTION" }, { status: 400 });
  }

  await disableAdminPushSubscription(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
