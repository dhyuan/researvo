import { beforeEach, describe, expect, it, vi } from "vitest";

const feedbackAppFindMany = vi.fn();
const feedbackMetricFindUnique = vi.fn();
const feedbackMessageUpdateMany = vi.fn();

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    feedbackApp: { findMany: feedbackAppFindMany },
    feedbackMetric: { findUnique: feedbackMetricFindUnique },
    feedbackMessage: { updateMany: feedbackMessageUpdateMany },
  },
}));

describe("feedback IP location cache synchronization", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const { resetFeedbackCacheForTests } = await import(
      "@/lib/feedback/feedbackCache"
    );
    resetFeedbackCacheForTests();
    feedbackMetricFindUnique.mockResolvedValue(null);
    feedbackMessageUpdateMany.mockResolvedValue({ count: 1 });
    feedbackAppFindMany.mockResolvedValue([
      {
        id: "app_1",
        sourceApp: "ChineseHandCopy",
        token: "token",
        createdAt: new Date("2026-07-29T00:00:00.000Z"),
        updatedAt: new Date("2026-07-29T00:00:00.000Z"),
        threads: [
          {
            id: "thread_1",
            feedbackAppId: "app_1",
            sourceApp: "ChineseHandCopy",
            channel: "app_store",
            installId: "install_1",
            device: null,
            appVersion: "1.0",
            message: "消息",
            status: "open",
            userLastReadAt: null,
            lastAdminReplyAt: null,
            createdAt: new Date("2026-07-29T01:00:00.000Z"),
            updatedAt: new Date("2026-07-29T01:00:00.000Z"),
            messages: [
              {
                id: "message_1",
                feedbackId: "thread_1",
                senderType: "user",
                body: "消息",
                appVersion: "1.0",
                ipAddress: "8.8.8.8",
                ipLocation: null,
                createdAt: new Date("2026-07-29T01:00:00.000Z"),
              },
            ],
          },
        ],
      },
    ]);
  });

  it("updates the cached admin detail after best-effort enrichment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            ip: "8.8.8.8",
            country: "United States",
            country_code: "US",
            city: "Mountain View",
          }),
          { status: 200 },
        ),
      ),
    );
    const cache = await import("@/lib/feedback/feedbackCache");
    const { enrichMessageIpLocation } = await import(
      "@/lib/feedback/ipLocation"
    );
    const { getFeedbackThreadForAdmin } = await import(
      "@/lib/feedback/feedbackService"
    );
    await cache.ensureFeedbackCacheReady();

    await enrichMessageIpLocation("message_1", "8.8.8.8");

    await expect(getFeedbackThreadForAdmin("thread_1")).resolves.toMatchObject({
      messages: [
        {
          id: "message_1",
          ipLocation: {
            provider: "ipwho.is",
            country: "United States",
            countryCode: "US",
            city: "Mountain View",
          },
        },
      ],
    });
    expect(feedbackMessageUpdateMany).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
