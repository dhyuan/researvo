import { beforeEach, describe, expect, it, vi } from "vitest";

const isAuthorized = vi.fn();
const upsertSubscription = vi.fn();
const disableSubscription = vi.fn();
const drain = vi.fn();

vi.mock("@/lib/feedback/adminAuth", () => ({
  isFeedbackAdminAuthorized: isAuthorized,
}));

vi.mock("@/lib/push/pushConfig", () => ({
  getPushConfig: () => ({
    configured: true,
    publicKey: "public-key",
    privateKey: "private-key",
    subject: "mailto:admin@example.com",
  }),
  getPushDispatchSecret: () => "dispatch-secret",
}));

vi.mock("@/lib/push/pushSubscriptions", () => ({
  upsertAdminPushSubscription: upsertSubscription,
  disableAdminPushSubscription: disableSubscription,
}));

vi.mock("@/lib/push/pushDispatcher", () => ({
  drainPushOutbox: drain,
}));

const subscription = {
  endpoint: "https://push.example.test/subscriptions/1",
  expirationTime: null,
  keys: {
    p256dh: "A234567890abcdef",
    auth: "B2345678",
  },
};

describe("push API routes", () => {
  beforeEach(() => {
    isAuthorized.mockReset().mockReturnValue(true);
    upsertSubscription.mockReset().mockResolvedValue({ id: "subscription_1" });
    disableSubscription.mockReset().mockResolvedValue({ count: 1 });
    drain.mockReset().mockResolvedValue({
      configured: true,
      claimed: 0,
      delivered: 0,
    });
  });

  it("requires admin authentication for the public VAPID key", async () => {
    isAuthorized.mockReturnValue(false);
    const { GET } = await import("@/app/api/admin/push/public-key/route");
    const response = await GET(
      new Request("https://admin.example.test/api/admin/push/public-key"),
    );

    expect(response.status).toBe(401);
  });

  it("rejects cross-origin subscription mutations", async () => {
    const { POST } = await import("@/app/api/admin/push/subscriptions/route");
    const response = await POST(
      new Request("https://admin.example.test/api/admin/push/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example.test",
        },
        body: JSON.stringify(subscription),
      }),
    );

    expect(response.status).toBe(403);
    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it("stores a valid same-origin subscription", async () => {
    const { POST } = await import("@/app/api/admin/push/subscriptions/route");
    const response = await POST(
      new Request("https://admin.example.test/api/admin/push/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://admin.example.test",
          "User-Agent": "Mobile Browser",
        },
        body: JSON.stringify(subscription),
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertSubscription).toHaveBeenCalledWith(
      subscription,
      "Mobile Browser",
    );
  });

  it("protects the drain endpoint with its dedicated secret", async () => {
    const { POST } = await import("@/app/api/internal/push/drain/route");
    const unauthorized = await POST(
      new Request("https://admin.example.test/api/internal/push/drain", {
        method: "POST",
      }),
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await POST(
      new Request("https://admin.example.test/api/internal/push/drain", {
        method: "POST",
        headers: { Authorization: "Bearer dispatch-secret" },
      }),
    );
    expect(authorized.status).toBe(200);
    expect(drain).toHaveBeenCalledWith({ limit: 50 });
  });
});
