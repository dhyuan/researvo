import { prisma } from "@/lib/persistence/repositories";
import { getAdminAuthVersion, getPushConfig } from "@/lib/push/pushConfig";
import {
  createFeedbackPushPayload,
  sendWebPush,
  type StoredPushSubscription,
} from "@/lib/push/webPushClient";

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;
const STALE_LOCK_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const SEND_CONCURRENCY = 10;

type ClaimedPushEvent = {
  id: string;
  feedbackId: string;
  messageId: string;
  attemptCount: number;
};

type ActiveSubscription = StoredPushSubscription & {
  id: string;
};

type PushErrorKind = "gone" | "transient" | "permanent";

export function classifyPushError(error: unknown): {
  kind: PushErrorKind;
  code: string;
} {
  const candidate = error as {
    statusCode?: unknown;
    code?: unknown;
  };
  const statusCode =
    typeof candidate?.statusCode === "number" ? candidate.statusCode : null;

  if (statusCode === 404 || statusCode === 410) {
    return { kind: "gone", code: `http_${statusCode}` };
  }
  if (statusCode === 429 || (statusCode !== null && statusCode >= 500)) {
    return { kind: "transient", code: `http_${statusCode}` };
  }
  if (statusCode !== null) {
    return { kind: "permanent", code: `http_${statusCode}` };
  }

  const code =
    typeof candidate?.code === "string" &&
    /^[A-Za-z0-9_.-]{1,64}$/.test(candidate.code)
      ? candidate.code
      : "network_error";
  return { kind: "transient", code };
}

export function retryDelayMs(attemptCount: number, random = Math.random) {
  const base = Math.min(6 * 60 * 60 * 1000, 60_000 * 2 ** Math.max(0, attemptCount - 1));
  return Math.round(base * (0.8 + random() * 0.4));
}

async function claimPushEvents(limit: number, now: Date): Promise<ClaimedPushEvent[]> {
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  return prisma.$queryRaw<ClaimedPushEvent[]>`
    WITH candidates AS (
      SELECT "id"
      FROM "feedback_push_events"
      WHERE (
        ("status" IN ('pending', 'retry') AND "nextAttemptAt" <= ${now})
        OR ("status" = 'processing' AND "lockedAt" < ${staleBefore})
      )
      ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE "feedback_push_events" AS event
    SET
      "status" = 'processing',
      "lockedAt" = ${now},
      "attemptCount" = event."attemptCount" + 1,
      "updatedAt" = ${now}
    FROM candidates
    WHERE event."id" = candidates."id"
    RETURNING event."id", event."feedbackId", event."messageId", event."attemptCount"
  `;
}

async function currentSubscriptions(): Promise<ActiveSubscription[]> {
  const adminAuthVersion = getAdminAuthVersion();
  if (!adminAuthVersion) {
    return [];
  }

  return prisma.adminPushSubscription.findMany({
    where: { status: "active", adminAuthVersion },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await mapper(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return output;
}

async function deliverToSubscription(
  event: ClaimedPushEvent,
  subscription: ActiveSubscription,
) {
  const delivery = await prisma.feedbackPushDelivery.upsert({
    where: {
      eventId_subscriptionId: {
        eventId: event.id,
        subscriptionId: subscription.id,
      },
    },
    create: {
      eventId: event.id,
      subscriptionId: subscription.id,
    },
    update: {},
    select: {
      id: true,
      status: true,
    },
  });

  if (delivery.status === "delivered") {
    return { outcome: "delivered" as const };
  }
  if (delivery.status === "permanent" || delivery.status === "gone") {
    return { outcome: "permanent" as const, code: "previous_permanent_failure" };
  }

  const now = new Date();
  await prisma.feedbackPushDelivery.updateMany({
    where: {
      id: delivery.id,
      status: { in: ["pending", "retry", "processing"] },
    },
    data: {
      status: "processing",
      attemptCount: { increment: 1 },
    },
  });

  try {
    await sendWebPush(
      subscription,
      createFeedbackPushPayload({
        eventId: event.id,
        feedbackId: event.feedbackId,
      }),
    );
    await prisma.adminPushSubscription.updateMany({
      where: { id: subscription.id, status: "active" },
      data: {
        failureCount: 0,
        lastSuccessAt: now,
        lastFailureAt: null,
      },
    });
    await prisma.feedbackPushDelivery.updateMany({
      where: { id: delivery.id },
      data: {
        status: "delivered",
        deliveredAt: now,
        lastErrorCode: null,
      },
    });
    return { outcome: "delivered" as const };
  } catch (error) {
    const classified = classifyPushError(error);
    await prisma.adminPushSubscription.updateMany({
      where: { id: subscription.id },
      data: {
        failureCount: { increment: 1 },
        lastFailureAt: now,
        ...(classified.kind === "gone" ? { status: "invalidated" } : {}),
      },
    });
    await prisma.feedbackPushDelivery.updateMany({
      where: { id: delivery.id },
      data: {
        status:
          classified.kind === "gone"
            ? "gone"
            : classified.kind === "permanent"
              ? "permanent"
              : "retry",
        lastErrorCode: classified.code,
      },
    });
    return {
      outcome: classified.kind,
      code: classified.code,
    };
  }
}

async function finishEvent(
  event: ClaimedPushEvent,
  result: {
    status: "delivered" | "completed" | "retry" | "failed";
    errorCode?: string;
  },
) {
  const now = new Date();
  await prisma.feedbackPushEvent.updateMany({
    where: {
      id: event.id,
      status: "processing",
    },
    data: {
      status: result.status,
      lockedAt: null,
      lastErrorCode: result.errorCode ?? null,
      ...(result.status === "delivered" ? { deliveredAt: now } : {}),
      ...(result.status === "retry"
        ? { nextAttemptAt: new Date(now.getTime() + retryDelayMs(event.attemptCount)) }
        : {}),
    },
  });
}

async function dispatchClaimedEvent(event: ClaimedPushEvent) {
  const subscriptions = await currentSubscriptions();
  if (subscriptions.length === 0) {
    await finishEvent(event, {
      status: "completed",
      errorCode: "no_recipients",
    });
    return "no_recipients" as const;
  }

  const results = await mapWithConcurrency(
    subscriptions,
    SEND_CONCURRENCY,
    (subscription) => deliverToSubscription(event, subscription),
  );
  const delivered = results.filter((result) => result.outcome === "delivered").length;
  const transient = results.find((result) => result.outcome === "transient");

  if (transient && event.attemptCount < MAX_ATTEMPTS) {
    await finishEvent(event, {
      status: "retry",
      errorCode: transient.code,
    });
    return "retry" as const;
  }

  if (transient) {
    await finishEvent(event, {
      status: "failed",
      errorCode: "attempts_exhausted",
    });
    return "failed" as const;
  }

  if (delivered > 0) {
    await finishEvent(event, { status: "delivered" });
    return "delivered" as const;
  }

  const permanent = results.find((result) => result.outcome === "permanent");
  await finishEvent(event, {
    status: "completed",
    errorCode: permanent?.code ?? "no_valid_recipients",
  });
  return "no_recipients" as const;
}

export async function sendTestPush(subscription: ActiveSubscription) {
  const eventId = `test_${Date.now()}`;
  const payload = createFeedbackPushPayload({
    eventId,
    feedbackId: "test",
  });
  payload.url = "/admin/feedback";
  await sendWebPush(
    subscription,
    payload,
  );
}

export async function drainPushOutbox(options: { limit?: number } = {}) {
  const requestedLimit = options.limit ?? DEFAULT_BATCH_SIZE;
  const limit = Math.max(1, Math.min(MAX_BATCH_SIZE, Math.trunc(requestedLimit)));
  const config = getPushConfig();

  if (!config.configured) {
    return {
      configured: false as const,
      reason: config.reason,
      claimed: 0,
      delivered: 0,
      retried: 0,
      failed: 0,
      noRecipients: 0,
    };
  }

  const events = await claimPushEvents(limit, new Date());
  const results = await mapWithConcurrency(events, 3, dispatchClaimedEvent);

  return {
    configured: true as const,
    claimed: events.length,
    delivered: results.filter((result) => result === "delivered").length,
    retried: results.filter((result) => result === "retry").length,
    failed: results.filter((result) => result === "failed").length,
    noRecipients: results.filter((result) => result === "no_recipients").length,
  };
}
