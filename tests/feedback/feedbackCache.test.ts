import { beforeEach, describe, expect, it, vi } from "vitest";

const feedbackAppFindMany = vi.fn();
const feedbackMetricFindUnique = vi.fn();
const feedbackMetricUpsert = vi.fn();

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    feedbackApp: { findMany: feedbackAppFindMany },
    feedbackMetric: {
      findUnique: feedbackMetricFindUnique,
      upsert: feedbackMetricUpsert,
    },
  },
}));

const message = {
  id: "msg_1",
  feedbackId: "thread_1",
  senderType: "user",
  body: "消息",
  appVersion: "1.0.0",
  ipAddress: null,
  ipLocation: null,
  createdAt: new Date("2026-07-29T01:00:00.000Z"),
};

const thread = {
  id: "thread_1",
  feedbackAppId: "app_1",
  sourceApp: "ChineseHandCopy",
  channel: "app_store",
  installId: "install_1",
  device: null,
  appVersion: "1.0.0",
  message: "消息",
  status: "open",
  userLastReadAt: null,
  lastAdminReplyAt: null,
  createdAt: new Date("2026-07-29T01:00:00.000Z"),
  updatedAt: new Date("2026-07-29T01:00:00.000Z"),
  messages: [message],
};

const app = {
  id: "app_1",
  sourceApp: "ChineseHandCopy",
  token: "secret",
  createdAt: new Date("2026-07-29T00:00:00.000Z"),
  updatedAt: new Date("2026-07-29T00:00:00.000Z"),
  threads: [thread],
};

describe("feedbackCache", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const { resetFeedbackCacheForTests } = await import(
      "@/lib/feedback/feedbackCache"
    );
    resetFeedbackCacheForTests();
    feedbackAppFindMany.mockResolvedValue([app]);
    feedbackMetricFindUnique.mockResolvedValue(null);
  });

  it("single-flights initialization and builds all indexes", async () => {
    let release: ((apps: typeof app[]) => void) | undefined;
    feedbackAppFindMany.mockReturnValue(
      new Promise<typeof app[]>((resolve) => {
        release = resolve;
      }),
    );
    const cache = await import("@/lib/feedback/feedbackCache");

    const first = cache.ensureFeedbackCacheReady();
    const second = cache.ensureFeedbackCacheReady();
    release?.([app]);
    const [firstSnapshot, secondSnapshot] = await Promise.all([first, second]);

    expect(firstSnapshot).toBe(secondSnapshot);
    expect(feedbackAppFindMany).toHaveBeenCalledTimes(1);
    expect(firstSnapshot.appsBySourceApp.get(app.sourceApp)?.token).toBe("secret");
    expect(
      firstSnapshot.threadIdBySourceAppAndInstallId.get(
        "ChineseHandCopy\u0000install_1",
      ),
    ).toBe(thread.id);
    expect(firstSnapshot.messageToThreadId.get(message.id)).toBe(thread.id);
  });

  it("treats an unknown install as a definitive cached absence", async () => {
    const cache = await import("@/lib/feedback/feedbackCache");

    await cache.ensureFeedbackCacheReady();
    await expect(
      cache.getFeedbackThreadForInstallFromCache(
        "ChineseHandCopy",
        "install_missing",
      ),
    ).resolves.toBeNull();

    expect(feedbackAppFindMany).toHaveBeenCalledTimes(1);
  });

  it("atomically replaces a snapshot after a successful rebuild", async () => {
    const cache = await import("@/lib/feedback/feedbackCache");
    await cache.ensureFeedbackCacheReady();
    feedbackAppFindMany.mockResolvedValueOnce([
      {
        ...app,
        threads: [{ ...thread, id: "thread_2", installId: "install_2" }],
      },
    ]);

    await expect(cache.rebuildFeedbackCache()).resolves.toMatchObject({
      ok: true,
      appCount: 1,
      threadCount: 1,
      messageCount: 1,
    });
    await expect(cache.getFeedbackThreadFromCache("thread_1")).resolves.toBeNull();
    await expect(cache.getFeedbackThreadFromCache("thread_2")).resolves.toMatchObject({
      installId: "install_2",
    });
  });

  it("does not let a delayed write refresh overwrite newer cached data", async () => {
    const cache = await import("@/lib/feedback/feedbackCache");
    await cache.ensureFeedbackCacheReady();
    const newerThread = {
      ...thread,
      status: "resolved",
      updatedAt: new Date("2026-07-29T03:00:00.000Z"),
      messages: [
        ...thread.messages,
        {
          ...message,
          id: "msg_2",
          createdAt: new Date("2026-07-29T03:00:00.000Z"),
        },
      ],
    };

    expect(cache.upsertFeedbackThreadInCache(newerThread)).toBe(true);
    expect(cache.upsertFeedbackThreadInCache(thread)).toBe(true);

    await expect(
      cache.getFeedbackThreadFromCache(thread.id),
    ).resolves.toMatchObject({
      status: "resolved",
      messages: [{ id: "msg_1" }, { id: "msg_2" }],
    });
  });

  it("keeps the old snapshot when rebuild fails", async () => {
    const cache = await import("@/lib/feedback/feedbackCache");
    await cache.ensureFeedbackCacheReady();
    feedbackAppFindMany.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(cache.rebuildFeedbackCache()).rejects.toThrow(
      "database unavailable",
    );
    await expect(cache.getFeedbackThreadFromCache(thread.id)).resolves.toMatchObject({
      id: thread.id,
    });
    expect(cache.getFeedbackCacheStatus().status).toBe("ready");
  });

  it("persists one atomic increment for every 100 client queries", async () => {
    feedbackMetricUpsert.mockResolvedValue({
      key: "client_thread_cache_queries",
      total: BigInt(100),
      updatedAt: new Date("2026-07-29T02:00:00.000Z"),
    });
    const cache = await import("@/lib/feedback/feedbackCache");
    await cache.ensureFeedbackCacheReady();

    for (let index = 0; index < 100; index += 1) {
      await cache.recordFeedbackClientCacheQuery();
    }

    expect(feedbackMetricUpsert).toHaveBeenCalledTimes(1);
    expect(feedbackMetricUpsert).toHaveBeenCalledWith({
      where: { key: "client_thread_cache_queries" },
      create: {
        key: "client_thread_cache_queries",
        total: BigInt(100),
      },
      update: { total: { increment: BigInt(100) } },
    });
    expect(cache.getFeedbackCacheStatus()).toMatchObject({
      clientQueryCount: 100,
      persistedClientQueryCount: 100,
      pendingClientQueryCount: 0,
    });
  });

  it("restores pending queries after a failed flush", async () => {
    feedbackMetricUpsert.mockRejectedValue(new Error("write failed"));
    const cache = await import("@/lib/feedback/feedbackCache");
    await cache.ensureFeedbackCacheReady();

    for (let index = 0; index < 100; index += 1) {
      await cache.recordFeedbackClientCacheQuery();
    }

    expect(cache.getFeedbackCacheStatus()).toMatchObject({
      clientQueryCount: 100,
      persistedClientQueryCount: 0,
      pendingClientQueryCount: 100,
    });
  });
});
