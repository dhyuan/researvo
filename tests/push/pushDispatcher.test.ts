import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
const subscriptionFindMany = vi.fn();
const subscriptionUpdateMany = vi.fn();
const eventUpdateMany = vi.fn();
const deliveryUpsert = vi.fn();
const deliveryUpdateMany = vi.fn();
const sendWebPush = vi.fn();

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    $queryRaw: queryRaw,
    adminPushSubscription: {
      findMany: subscriptionFindMany,
      updateMany: subscriptionUpdateMany,
    },
    feedbackPushEvent: {
      updateMany: eventUpdateMany,
    },
    feedbackPushDelivery: {
      upsert: deliveryUpsert,
      updateMany: deliveryUpdateMany,
    },
  },
}));

vi.mock("@/lib/push/pushConfig", () => ({
  getAdminAuthVersion: () => "auth-version",
  getPushConfig: () => ({
    configured: true,
    publicKey: "public",
    privateKey: "private",
    subject: "mailto:admin@example.com",
  }),
}));

vi.mock("@/lib/push/webPushClient", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/push/webPushClient")>();
  return { ...original, sendWebPush };
});

const event = {
  id: "event_1",
  feedbackId: "feedback_1",
  messageId: "message_1",
  attemptCount: 1,
};
const subscription = {
  id: "subscription_1",
  endpoint: "https://push.example.test/1",
  p256dh: "p256dh",
  auth: "auth",
};

describe("pushDispatcher", () => {
  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue([event]);
    subscriptionFindMany.mockReset().mockResolvedValue([subscription]);
    subscriptionUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    eventUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    deliveryUpsert.mockReset().mockResolvedValue({
      id: "delivery_1",
      status: "pending",
    });
    deliveryUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    sendWebPush.mockReset().mockResolvedValue({});
  });

  it("sends only the generic privacy-preserving payload", async () => {
    const { drainPushOutbox } = await import("@/lib/push/pushDispatcher");

    await expect(drainPushOutbox({ limit: 1 })).resolves.toMatchObject({
      claimed: 1,
      delivered: 1,
    });

    expect(sendWebPush).toHaveBeenCalledWith(
      subscription,
      expect.objectContaining({
        feedbackId: "feedback_1",
        url: "/admin/feedback?thread=feedback_1",
        title: "Researvo Admin",
        body: "收到 1 条新的用户反馈",
      }),
    );
    expect(JSON.stringify(sendWebPush.mock.calls[0][1])).not.toContain("message_1");
    expect(eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "delivered" }),
      }),
    );
  });

  it("invalidates 404/410 subscriptions without retrying the event", async () => {
    sendWebPush.mockRejectedValue({ statusCode: 410 });
    const { drainPushOutbox } = await import("@/lib/push/pushDispatcher");

    await expect(drainPushOutbox({ limit: 1 })).resolves.toMatchObject({
      claimed: 1,
      noRecipients: 1,
      retried: 0,
    });
    expect(subscriptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "invalidated" }),
      }),
    );
  });

  it("does not resend to a subscription already delivered on an earlier attempt", async () => {
    deliveryUpsert.mockResolvedValue({
      id: "delivery_1",
      status: "delivered",
    });
    const { drainPushOutbox } = await import("@/lib/push/pushDispatcher");

    await expect(drainPushOutbox({ limit: 1 })).resolves.toMatchObject({
      delivered: 1,
      retried: 0,
    });
    expect(sendWebPush).not.toHaveBeenCalled();
    expect(deliveryUpdateMany).not.toHaveBeenCalled();
  });

  it("retries only the transiently failed subscription in a mixed delivery", async () => {
    const subscriptions = [
      subscription,
      {
        ...subscription,
        id: "subscription_2",
        endpoint: "https://push.example.test/2",
      },
    ];
    const statuses = new Map([
      ["delivery_subscription_1", "pending"],
      ["delivery_subscription_2", "pending"],
    ]);
    subscriptionFindMany.mockResolvedValue(subscriptions);
    deliveryUpsert.mockImplementation(
      ({ where }: { where: { eventId_subscriptionId: { subscriptionId: string } } }) => {
        const id = `delivery_${where.eventId_subscriptionId.subscriptionId}`;
        return { id, status: statuses.get(id) };
      },
    );
    deliveryUpdateMany.mockImplementation(
      ({ where, data }: { where: { id: string }; data: { status?: string } }) => {
        if (data.status) {
          statuses.set(where.id, data.status);
        }
        return { count: 1 };
      },
    );
    let secondSubscriptionAttempts = 0;
    sendWebPush.mockImplementation(({ endpoint }: { endpoint: string }) => {
      if (endpoint.endsWith("/2") && secondSubscriptionAttempts++ === 0) {
        return Promise.reject({ statusCode: 503 });
      }
      return Promise.resolve({});
    });
    const { drainPushOutbox } = await import("@/lib/push/pushDispatcher");

    await expect(drainPushOutbox({ limit: 1 })).resolves.toMatchObject({
      retried: 1,
    });
    queryRaw.mockResolvedValue([{ ...event, attemptCount: 2 }]);
    await expect(drainPushOutbox({ limit: 1 })).resolves.toMatchObject({
      delivered: 1,
    });

    expect(
      sendWebPush.mock.calls.filter(([value]) => value.id === "subscription_1"),
    ).toHaveLength(1);
    expect(
      sendWebPush.mock.calls.filter(([value]) => value.id === "subscription_2"),
    ).toHaveLength(2);
  });

  it("retries transient failures with a future next-attempt time", async () => {
    sendWebPush.mockRejectedValue({ statusCode: 503 });
    const { drainPushOutbox } = await import("@/lib/push/pushDispatcher");

    await expect(drainPushOutbox({ limit: 1 })).resolves.toMatchObject({
      claimed: 1,
      retried: 1,
    });
    expect(eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "retry",
          lastErrorCode: "http_503",
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
  });

  it("completes events when no current-auth subscriptions exist", async () => {
    subscriptionFindMany.mockResolvedValue([]);
    const { drainPushOutbox } = await import("@/lib/push/pushDispatcher");

    await expect(drainPushOutbox({ limit: 1 })).resolves.toMatchObject({
      noRecipients: 1,
    });
    expect(sendWebPush).not.toHaveBeenCalled();
    expect(eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "completed",
          lastErrorCode: "no_recipients",
        }),
      }),
    );
  });
});
