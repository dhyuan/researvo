import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const updateMany = vi.fn();

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    adminPushSubscription: {
      upsert,
      updateMany,
    },
  },
}));

describe("pushSubscriptions", () => {
  beforeEach(() => {
    upsert.mockReset().mockResolvedValue({ id: "subscription_1" });
    updateMany.mockReset().mockResolvedValue({ count: 1 });
    process.env.FEEDBACK_ADMIN_TOKEN = "admin-token";
  });

  it("idempotently upserts by a fixed-length endpoint hash", async () => {
    const { hashPushEndpoint, upsertAdminPushSubscription } = await import(
      "@/lib/push/pushSubscriptions"
    );
    const endpoint = "https://push.example.test/subscription/very-long-id";

    await upsertAdminPushSubscription(
      {
        endpoint,
        expirationTime: 1_800_000_000_000,
        keys: { p256dh: "public-key", auth: "auth-key" },
      },
      "Test Browser",
    );

    const endpointHash = hashPushEndpoint(endpoint);
    expect(endpointHash).toMatch(/^[a-f0-9]{64}$/);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpointHash },
        create: expect.objectContaining({
          endpoint,
          endpointHash,
          expirationTime: BigInt("1800000000000"),
          status: "active",
        }),
        update: expect.objectContaining({
          endpoint,
          status: "active",
          failureCount: 0,
        }),
      }),
    );
  });

  it("makes repeated unsubscribe operations harmless", async () => {
    const { disableAdminPushSubscription } = await import(
      "@/lib/push/pushSubscriptions"
    );

    await disableAdminPushSubscription("https://push.example.test/subscription/1");
    await disableAdminPushSubscription("https://push.example.test/subscription/1");

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: "unsubscribed" } }),
    );
  });
});
