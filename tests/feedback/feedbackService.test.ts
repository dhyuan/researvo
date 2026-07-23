import { afterEach, describe, expect, it, vi } from "vitest";

const mockFeedbackAppFindUnique = vi.fn();
const mockFeedbackThreadCreate = vi.fn();
const mockFeedbackThreadFindFirst = vi.fn();
const mockFeedbackThreadFindMany = vi.fn();
const mockFeedbackThreadFindUnique = vi.fn();
const mockFeedbackThreadUpdate = vi.fn();
const mockFeedbackThreadUpdateMany = vi.fn();
const mockFeedbackThreadUpsert = vi.fn();
const mockFeedbackMessageCreate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    $transaction: mockTransaction,
    feedbackApp: {
      findUnique: mockFeedbackAppFindUnique,
    },
    feedbackThread: {
      create: mockFeedbackThreadCreate,
      findFirst: mockFeedbackThreadFindFirst,
      findMany: mockFeedbackThreadFindMany,
      findUnique: mockFeedbackThreadFindUnique,
      update: mockFeedbackThreadUpdate,
      updateMany: mockFeedbackThreadUpdateMany,
      upsert: mockFeedbackThreadUpsert,
    },
    feedbackMessage: {
      create: mockFeedbackMessageCreate,
    },
  },
}));

const app = {
  id: "app_1",
  sourceApp: "ChineseHandCopy",
  token: "valid-token",
};

describe("feedbackService", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates a feedback thread and initial user message", async () => {
    mockFeedbackAppFindUnique.mockResolvedValue(app);
    mockFeedbackThreadUpsert.mockResolvedValue({ id: "fb_123" });
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        feedbackThread: {
          upsert: mockFeedbackThreadUpsert,
        },
        feedbackMessage: {
          create: mockFeedbackMessageCreate,
        },
      }),
    );
    const { submitFeedback } = await import("@/lib/feedback/feedbackService");

    await expect(
      submitFeedback({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
        channel: "google_play",
        device: "iPhone 15 Pro",
        installId: "install_19a",
        appVersion: "硬笔临帖 v2.1.4",
        ipAddress: "203.0.113.42",
        message: "希望能支持横版纸张",
      }),
    ).resolves.toEqual({ id: "fb_123" });

    expect(mockFeedbackThreadUpsert).toHaveBeenCalledWith({
      where: {
        sourceApp_installId: {
          sourceApp: "ChineseHandCopy",
          installId: "install_19a",
        },
      },
      create: {
        feedbackAppId: "app_1",
        sourceApp: "ChineseHandCopy",
        channel: "google_play",
        installId: "install_19a",
        device: "iPhone 15 Pro",
        appVersion: "硬笔临帖 v2.1.4",
        message: "希望能支持横版纸张",
        status: "open",
      },
      update: {
        channel: "google_play",
        device: "iPhone 15 Pro",
        appVersion: "硬笔临帖 v2.1.4",
        status: "open",
        updatedAt: expect.any(Date),
      },
      select: { id: true },
    });
    expect(mockFeedbackMessageCreate).toHaveBeenCalledWith({
      data: {
        feedbackId: "fb_123",
        senderType: "user",
        body: "希望能支持横版纸张",
        appVersion: "硬笔临帖 v2.1.4",
        ipAddress: "203.0.113.42",
      },
    });
  });

  it("creates or reuses one thread when sending user messages", async () => {
    mockFeedbackAppFindUnique.mockResolvedValue(app);
    mockFeedbackThreadCreate.mockResolvedValue({ id: "fb_123" });
    mockFeedbackThreadUpdate.mockResolvedValue({ id: "fb_123" });
    mockFeedbackMessageCreate.mockResolvedValue({ id: "msg_123" });
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        feedbackThread: {
          upsert: vi.fn().mockResolvedValue({ id: "fb_123" }),
        },
        feedbackMessage: {
          create: mockFeedbackMessageCreate,
        },
      }),
    );
    const { sendUserFeedbackMessage } = await import("@/lib/feedback/feedbackService");

    await expect(
      sendUserFeedbackMessage({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
        channel: "google_play",
        device: "iPhone 15 Pro",
        installId: "install_19a",
        appVersion: "硬笔临帖 v2.1.4",
        ipAddress: "2001:db8::42",
        message: "补充一下，主要是想横向打印。",
      }),
    ).resolves.toEqual({ id: "msg_123" });

    expect(mockFeedbackMessageCreate).toHaveBeenCalledWith({
      data: {
        feedbackId: "fb_123",
        senderType: "user",
        body: "补充一下，主要是想横向打印。",
        appVersion: "硬笔临帖 v2.1.4",
        ipAddress: "2001:db8::42",
      },
      select: { id: true },
    });
  });

  it("lists feedback summaries with unread admin reply counts", async () => {
    mockFeedbackAppFindUnique.mockResolvedValue(app);
    mockFeedbackThreadFindMany.mockResolvedValue([
      {
        id: "fb_123",
        message: "希望能支持横版纸张",
        status: "replied",
        userLastReadAt: new Date("2026-06-24T10:30:00.000Z"),
        lastAdminReplyAt: new Date("2026-06-24T11:00:00.000Z"),
        createdAt: new Date("2026-06-24T10:00:00.000Z"),
        updatedAt: new Date("2026-06-24T11:00:00.000Z"),
        messages: [
          {
            id: "msg_old",
            feedbackId: "fb_123",
            senderType: "admin",
            body: "old",
            createdAt: new Date("2026-06-24T10:20:00.000Z"),
          },
          {
            id: "msg_new",
            feedbackId: "fb_123",
            senderType: "admin",
            body: "new",
            createdAt: new Date("2026-06-24T11:00:00.000Z"),
          },
        ],
      },
    ]);
    const { listFeedbackForInstall } = await import("@/lib/feedback/feedbackService");

    await expect(
      listFeedbackForInstall({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
        installId: "install_19a",
      }),
    ).resolves.toEqual([
      {
        id: "fb_123",
        message: "希望能支持横版纸张",
        status: "replied",
        createdAt: "2026-06-24T10:00:00.000Z",
        updatedAt: "2026-06-24T11:00:00.000Z",
        lastAdminReplyAt: "2026-06-24T11:00:00.000Z",
        unreadAdminReplyCount: 1,
      },
    ]);
    expect(mockFeedbackThreadFindMany).toHaveBeenCalledWith({
      where: {
        sourceApp: "ChineseHandCopy",
        installId: "install_19a",
      },
      include: {
        messages: {
          where: { senderType: "admin" },
          select: {
            id: true,
            feedbackId: true,
            senderType: true,
            body: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("marks replies as read only for the matching install", async () => {
    mockFeedbackAppFindUnique.mockResolvedValue(app);
    mockFeedbackThreadUpdateMany.mockResolvedValue({ count: 1 });
    const { markFeedbackRepliesRead } = await import("@/lib/feedback/feedbackService");

    await expect(
      markFeedbackRepliesRead({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
        installId: "install_19a",
        feedbackId: "fb_123",
      }),
    ).resolves.toBe(true);

    expect(mockFeedbackThreadUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "fb_123",
        sourceApp: "ChineseHandCopy",
        installId: "install_19a",
      },
      data: {
        userLastReadAt: expect.any(Date),
      },
    });
  });

  it("marks the current install thread as read", async () => {
    mockFeedbackAppFindUnique.mockResolvedValue(app);
    mockFeedbackThreadUpdateMany.mockResolvedValue({ count: 1 });
    const { markCurrentFeedbackThreadRead } = await import("@/lib/feedback/feedbackService");

    await expect(
      markCurrentFeedbackThreadRead({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
        installId: "install_19a",
      }),
    ).resolves.toBe(true);

    expect(mockFeedbackThreadUpdateMany).toHaveBeenCalledWith({
      where: {
        sourceApp: "ChineseHandCopy",
        installId: "install_19a",
      },
      data: {
        userLastReadAt: expect.any(Date),
      },
    });
  });

  it("creates an admin reply and marks the thread replied", async () => {
    mockFeedbackThreadFindUnique.mockResolvedValue({ id: "fb_123" });
    mockFeedbackMessageCreate.mockResolvedValue({ id: "msg_admin_1" });
    mockFeedbackThreadUpdate.mockResolvedValue({ id: "fb_123" });
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        feedbackThread: {
          findUnique: mockFeedbackThreadFindUnique,
          update: mockFeedbackThreadUpdate,
        },
        feedbackMessage: {
          create: mockFeedbackMessageCreate,
        },
      }),
    );
    const { replyToFeedbackAsAdmin } = await import("@/lib/feedback/feedbackService");

    await expect(
      replyToFeedbackAsAdmin({
        feedbackId: "fb_123",
        body: "已记录，会放入后续版本评估。",
      }),
    ).resolves.toEqual({ id: "msg_admin_1" });

    expect(mockFeedbackMessageCreate).toHaveBeenCalledWith({
      data: {
        feedbackId: "fb_123",
        senderType: "admin",
        body: "已记录，会放入后续版本评估。",
      },
      select: { id: true },
    });
    expect(mockFeedbackThreadUpdate).toHaveBeenCalledWith({
      where: { id: "fb_123" },
      data: {
        status: "replied",
        lastAdminReplyAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    });
  });
});
