import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const feedbackAppFindMany = vi.fn();
const feedbackMetricFindUnique = vi.fn();
const feedbackMetricUpsert = vi.fn();
const feedbackQueryClientFindMany = vi.fn();
const feedbackQueryClientCreateMany = vi.fn();
const feedbackThreadFindUnique = vi.fn();
const feedbackThreadUpdate = vi.fn();
const feedbackThreadUpdateMany = vi.fn();
const feedbackThreadUpsert = vi.fn();
const feedbackThreadDeleteMany = vi.fn();
const feedbackMessageCreate = vi.fn();
const feedbackMessageUpdateMany = vi.fn();
const feedbackPushEventUpsert = vi.fn();
const transaction = vi.fn();
const enqueueFeedbackPushEvent = vi.fn();
const triggerPushDispatch = vi.fn();

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    $transaction: transaction,
    feedbackApp: { findMany: feedbackAppFindMany },
    feedbackMetric: {
      findUnique: feedbackMetricFindUnique,
      upsert: feedbackMetricUpsert,
    },
    feedbackQueryClient: {
      findMany: feedbackQueryClientFindMany,
      createMany: feedbackQueryClientCreateMany,
    },
    feedbackThread: {
      findUnique: feedbackThreadFindUnique,
      update: feedbackThreadUpdate,
      updateMany: feedbackThreadUpdateMany,
      upsert: feedbackThreadUpsert,
      deleteMany: feedbackThreadDeleteMany,
    },
    feedbackMessage: {
      create: feedbackMessageCreate,
      updateMany: feedbackMessageUpdateMany,
    },
    feedbackPushEvent: { upsert: feedbackPushEventUpsert },
  },
}));

vi.mock("@/lib/push/pushOutbox", () => ({
  enqueueFeedbackPushEvent,
  triggerPushDispatch,
}));

const app = {
  id: "app_1",
  sourceApp: "ChineseHandCopy",
  token: "valid-token",
  createdAt: new Date("2026-06-20T00:00:00.000Z"),
  updatedAt: new Date("2026-06-20T00:00:00.000Z"),
};

const userMessage = {
  id: "msg_user",
  feedbackId: "fb_123",
  senderType: "user",
  body: "希望能支持横版纸张",
  appVersion: "2.1.4",
  ipAddress: "203.0.113.42",
  ipLocation: null,
  createdAt: new Date("2026-06-24T10:00:00.000Z"),
};

const adminMessage = {
  id: "msg_admin",
  feedbackId: "fb_123",
  senderType: "admin",
  body: "已经收到建议",
  appVersion: null,
  ipAddress: null,
  ipLocation: null,
  createdAt: new Date("2026-06-24T11:00:00.000Z"),
};

const thread = {
  id: "fb_123",
  feedbackAppId: "app_1",
  sourceApp: "ChineseHandCopy",
  channel: "google_play",
  installId: "install_19a",
  device: "iPhone 15 Pro",
  appVersion: "2.1.4",
  message: "希望能支持横版纸张",
  status: "replied",
  userLastReadAt: null,
  lastAdminReplyAt: new Date("2026-06-24T11:00:00.000Z"),
  createdAt: new Date("2026-06-24T10:00:00.000Z"),
  updatedAt: new Date("2026-06-24T11:00:00.000Z"),
  messages: [userMessage, adminMessage],
};

function loadWith(threads = [thread]) {
  feedbackAppFindMany.mockResolvedValue([{ ...app, threads }]);
  feedbackMetricFindUnique.mockResolvedValue(null);
}

function transactionClient() {
  return {
    feedbackThread: {
      findUnique: feedbackThreadFindUnique,
      update: feedbackThreadUpdate,
      upsert: feedbackThreadUpsert,
    },
    feedbackMessage: {
      create: feedbackMessageCreate,
    },
  };
}

describe("feedbackService with full cache", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const { resetFeedbackCacheForTests } = await import(
      "@/lib/feedback/feedbackCache"
    );
    resetFeedbackCacheForTests();
    loadWith();
    feedbackQueryClientFindMany.mockResolvedValue([]);
    feedbackQueryClientCreateMany.mockResolvedValue({ count: 0 });
    transaction.mockImplementation(async (callback) =>
      callback(transactionClient()),
    );
  });

  afterEach(async () => {
    const { resetFeedbackCacheForTests } = await import(
      "@/lib/feedback/feedbackCache"
    );
    resetFeedbackCacheForTests();
  });

  it("serves client and admin reads from one snapshot without per-key Prisma reads", async () => {
    const service = await import("@/lib/feedback/feedbackService");

    await expect(
      service.getCurrentFeedbackThread({
        sourceApp: app.sourceApp,
        token: app.token,
        installId: thread.installId,
      }),
    ).resolves.toMatchObject({
      id: thread.id,
      unreadAdminReplyCount: 1,
    });
    await expect(
      service.getCurrentFeedbackThread({
        sourceApp: app.sourceApp,
        token: app.token,
        installId: "install_missing",
      }),
    ).resolves.toBeNull();
    await expect(service.getFeedbackThreadForAdmin(thread.id)).resolves.toMatchObject({
      id: thread.id,
      messages: [{ id: userMessage.id }, { id: adminMessage.id }],
    });

    expect(feedbackAppFindMany).toHaveBeenCalledTimes(1);
    expect(feedbackThreadFindUnique).not.toHaveBeenCalled();
  });

  it("filters, searches, sorts, and paginates the admin list in memory", async () => {
    const newer = {
      ...thread,
      id: "fb_456",
      installId: "install_20b",
      status: "open",
      updatedAt: new Date("2026-06-25T11:00:00.000Z"),
      messages: [
        {
          ...userMessage,
          id: "msg_other",
          feedbackId: "fb_456",
          body: "需要导出楷书字帖",
          createdAt: new Date("2026-06-25T11:00:00.000Z"),
        },
      ],
    };
    loadWith([thread, newer]);
    const { listFeedbackThreadsForAdmin } = await import(
      "@/lib/feedback/feedbackService"
    );

    const result = await listFeedbackThreadsForAdmin({
      status: "open",
      q: "楷书",
      page: 1,
      pageSize: 1,
    });

    expect(result).toMatchObject({
      total: 1,
      hasMore: false,
      items: [{ id: "fb_456", needsAdminReply: true, messageCount: 1 }],
    });
    expect(feedbackAppFindMany).toHaveBeenCalledTimes(1);
  });

  it("updates read state in the database and immediately in cache", async () => {
    feedbackThreadUpdateMany.mockResolvedValue({ count: 1 });
    const service = await import("@/lib/feedback/feedbackService");

    await expect(
      service.markCurrentFeedbackThreadRead({
        sourceApp: app.sourceApp,
        token: app.token,
        installId: thread.installId,
      }),
    ).resolves.toBe(true);
    await expect(
      service.getCurrentFeedbackThread({
        sourceApp: app.sourceApp,
        token: app.token,
        installId: thread.installId,
      }),
    ).resolves.toMatchObject({ unreadAdminReplyCount: 0 });
    expect(feedbackAppFindMany).toHaveBeenCalledTimes(1);
  });

  it("refreshes the affected thread after a user write", async () => {
    feedbackThreadUpsert.mockResolvedValue({ id: thread.id });
    feedbackMessageCreate.mockResolvedValue({ id: "msg_new" });
    enqueueFeedbackPushEvent.mockResolvedValue(undefined);
    const refreshed = {
      ...thread,
      status: "open",
      updatedAt: new Date("2026-06-26T00:00:00.000Z"),
      messages: [
        ...thread.messages,
        {
          ...userMessage,
          id: "msg_new",
          body: "补充消息",
          createdAt: new Date("2026-06-26T00:00:00.000Z"),
        },
      ],
    };
    feedbackThreadFindUnique.mockResolvedValue(refreshed);
    const service = await import("@/lib/feedback/feedbackService");

    await expect(
      service.sendUserFeedbackMessage({
        sourceApp: app.sourceApp,
        token: app.token,
        channel: thread.channel,
        installId: thread.installId,
        message: "补充消息",
      }),
    ).resolves.toEqual({ id: "msg_new" });
    await expect(service.getFeedbackThreadForAdmin(thread.id)).resolves.toMatchObject({
      status: "open",
      messages: [{}, {}, { id: "msg_new", body: "补充消息" }],
    });
    expect(feedbackThreadFindUnique).toHaveBeenCalledTimes(1);
  });

  it("syncs admin reply, edit, status, and deletion paths", async () => {
    feedbackThreadFindUnique
      .mockResolvedValueOnce({ id: thread.id })
      .mockResolvedValueOnce({
        ...thread,
        status: "replied",
        messages: [
          ...thread.messages,
          {
            ...adminMessage,
            id: "msg_admin_2",
            body: "第二次回复",
          },
        ],
      });
    feedbackMessageCreate.mockResolvedValue({ id: "msg_admin_2" });
    feedbackThreadUpdate.mockResolvedValue({ id: thread.id });
    feedbackMessageUpdateMany.mockResolvedValue({ count: 1 });
    feedbackThreadDeleteMany.mockResolvedValue({ count: 1 });
    const service = await import("@/lib/feedback/feedbackService");

    await expect(
      service.replyToFeedbackAsAdmin({
        feedbackId: thread.id,
        body: "第二次回复",
      }),
    ).resolves.toEqual({ id: "msg_admin_2" });
    await service.updateAdminFeedbackMessage({
      feedbackId: thread.id,
      messageId: "msg_admin_2",
      body: "修订回复",
    });
    await service.updateFeedbackStatusAsAdmin({
      feedbackId: thread.id,
      status: "resolved",
    });
    await expect(service.getFeedbackThreadForAdmin(thread.id)).resolves.toMatchObject({
      status: "resolved",
      messages: [{}, {}, { id: "msg_admin_2", body: "修订回复" }],
    });

    await expect(service.deleteFeedbackThreadAsAdmin(thread.id)).resolves.toBe(true);
    await expect(service.getFeedbackThreadForAdmin(thread.id)).resolves.toBeNull();
    expect(feedbackAppFindMany).toHaveBeenCalledTimes(1);
  });
});
