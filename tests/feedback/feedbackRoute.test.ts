import { beforeEach, describe, expect, it, vi } from "vitest";

const getFeedbackDetail = vi.fn();
const getCurrentFeedbackThread = vi.fn();
const listFeedbackForInstall = vi.fn();
const listFeedbackThreadsForAdmin = vi.fn();
const markFeedbackRepliesRead = vi.fn();
const markCurrentFeedbackThreadRead = vi.fn();
const replyToFeedbackAsAdmin = vi.fn();
const sendUserFeedbackMessage = vi.fn();
const updateFeedbackStatusAsAdmin = vi.fn();
const submitFeedback = vi.fn();

vi.mock("@/lib/feedback/feedbackService", () => ({
  getFeedbackDetail,
  getCurrentFeedbackThread,
  listFeedbackForInstall,
  listFeedbackThreadsForAdmin,
  markFeedbackRepliesRead,
  markCurrentFeedbackThreadRead,
  replyToFeedbackAsAdmin,
  sendUserFeedbackMessage,
  submitFeedback,
  updateFeedbackStatusAsAdmin,
}));

const makeRequest = (body: unknown, headers?: HeadersInit) =>
  new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("feedback route", () => {
  beforeEach(() => {
    getFeedbackDetail.mockReset();
    getCurrentFeedbackThread.mockReset();
    listFeedbackForInstall.mockReset();
    listFeedbackThreadsForAdmin.mockReset();
    markFeedbackRepliesRead.mockReset();
    markCurrentFeedbackThreadRead.mockReset();
    replyToFeedbackAsAdmin.mockReset();
    sendUserFeedbackMessage.mockReset();
    updateFeedbackStatusAsAdmin.mockReset();
    submitFeedback.mockReset();
  });

  it("stores feedback when the app token matches", async () => {
    submitFeedback.mockResolvedValueOnce({ id: "feedback_1" });
    const { POST } = await import("@/app/api/feedback/route");

    const response = await POST(
      makeRequest({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
        message: "The copy practice screen needs a larger text area.",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "feedback_1",
      feedbackId: "feedback_1",
    });
    expect(response.status).toBe(200);
    expect(submitFeedback).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      message: "The copy practice screen needs a larger text area.",
    });
  });

  it("accepts optional channel, device, and version fields", async () => {
    submitFeedback.mockResolvedValueOnce({ id: "feedback_2" });
    const { POST } = await import("@/app/api/feedback/route");

    const response = await POST(
      makeRequest(
        {
          token: "valid-token",
          sourceApp: "ChineseHandCopy",
          channel: "web",
          device: "iPhone 15 Pro",
          version: "1.4.2",
          message: "The writing panel is hard to use on mobile.",
        },
        {
          "x-forwarded-for": "203.0.113.42, 10.0.0.1",
        },
      ),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "feedback_2",
      feedbackId: "feedback_2",
    });
    expect(response.status).toBe(200);
    expect(submitFeedback).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      channel: "web",
      device: "iPhone 15 Pro",
      version: "1.4.2",
      ipAddress: "203.0.113.42",
      message: "The writing panel is hard to use on mobile.",
    });
  });

  it("accepts parentId when replying to existing feedback", async () => {
    submitFeedback.mockResolvedValueOnce({ id: "feedback_reply_1" });
    const { POST } = await import("@/app/api/feedback/route");

    const response = await POST(
      makeRequest({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
        parentId: "feedback_parent_1",
        message: "Adding more detail about the mobile writing panel issue.",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "feedback_reply_1",
      feedbackId: "feedback_reply_1",
    });
    expect(response.status).toBe(200);
    expect(submitFeedback).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      parentId: "feedback_parent_1",
      message: "Adding more detail about the mobile writing panel issue.",
    });
  });

  it("returns 401 when the token does not match the source app", async () => {
    submitFeedback.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/feedback/route");

    const response = await POST(
      makeRequest({
        token: "wrong-token",
        sourceApp: "ChineseHandCopy",
        message: "I found a bug.",
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "INVALID_FEEDBACK_TOKEN" });
    expect(response.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/feedback/route");

    const response = await POST(
      makeRequest({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "INVALID_FEEDBACK_REQUEST" });
    expect(response.status).toBe(400);
    expect(submitFeedback).not.toHaveBeenCalled();
  });

  it("stores client install metadata when creating feedback", async () => {
    submitFeedback.mockResolvedValueOnce({ id: "fb_123" });
    const { POST } = await import("@/app/api/feedback/route");

    const response = await POST(
      makeRequest({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
        channel: "google_play",
        device: "iPhone 15 Pro",
        installId: "install_19a",
        appVersion: "硬笔临帖 v2.1.4",
        message: " 希望能支持横版纸张 ",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "fb_123",
      feedbackId: "fb_123",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(submitFeedback).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      channel: "google_play",
      device: "iPhone 15 Pro",
      installId: "install_19a",
      appVersion: "硬笔临帖 v2.1.4",
      message: "希望能支持横版纸张",
    });
  });

  it("lists feedback for the current install", async () => {
    listFeedbackForInstall.mockResolvedValueOnce([
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
    const { GET } = await import("@/app/api/feedback/route");

    const response = await GET(
      new Request(
        "http://localhost/api/feedback?token=valid-token&sourceApp=ChineseHandCopy&installId=install_19a",
      ),
    );

    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "fb_123",
          message: "希望能支持横版纸张",
          status: "replied",
          createdAt: "2026-06-24T10:00:00.000Z",
          updatedAt: "2026-06-24T11:00:00.000Z",
          lastAdminReplyAt: "2026-06-24T11:00:00.000Z",
          unreadAdminReplyCount: 1,
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(listFeedbackForInstall).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      installId: "install_19a",
    });
  });

  it("returns 400 when list query fields are missing", async () => {
    const { GET } = await import("@/app/api/feedback/route");

    const response = await GET(
      new Request("http://localhost/api/feedback?token=valid-token&sourceApp=ChineseHandCopy"),
    );

    await expect(response.json()).resolves.toEqual({ error: "INVALID_FEEDBACK_REQUEST" });
    expect(response.status).toBe(400);
    expect(listFeedbackForInstall).not.toHaveBeenCalled();
  });

  it("returns feedback detail for the current install", async () => {
    getFeedbackDetail.mockResolvedValueOnce({
      id: "fb_123",
      message: "希望能支持横版纸张",
      status: "replied",
      createdAt: "2026-06-24T10:00:00.000Z",
      updatedAt: "2026-06-24T11:00:00.000Z",
      lastAdminReplyAt: "2026-06-24T11:00:00.000Z",
      unreadAdminReplyCount: 1,
      messages: [
        {
          id: "msg_1",
          feedbackId: "fb_123",
          senderType: "user",
          body: "希望能支持横版纸张",
          createdAt: "2026-06-24T10:00:00.000Z",
        },
      ],
    });
    const { GET } = await import("@/app/api/feedback/[feedbackId]/route");

    const response = await GET(
      new Request(
        "http://localhost/api/feedback/fb_123?token=valid-token&sourceApp=ChineseHandCopy&installId=install_19a",
      ),
      { params: Promise.resolve({ feedbackId: "fb_123" }) },
    );

    await expect(response.json()).resolves.toEqual({
      id: "fb_123",
      message: "希望能支持横版纸张",
      status: "replied",
      createdAt: "2026-06-24T10:00:00.000Z",
      updatedAt: "2026-06-24T11:00:00.000Z",
      lastAdminReplyAt: "2026-06-24T11:00:00.000Z",
      unreadAdminReplyCount: 1,
      messages: [
        {
          id: "msg_1",
          feedbackId: "fb_123",
          senderType: "user",
          body: "希望能支持横版纸张",
          createdAt: "2026-06-24T10:00:00.000Z",
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(getFeedbackDetail).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      installId: "install_19a",
      feedbackId: "fb_123",
    });
  });

  it("returns 404 when feedback detail does not belong to the current install", async () => {
    getFeedbackDetail.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/feedback/[feedbackId]/route");

    const response = await GET(
      new Request(
        "http://localhost/api/feedback/fb_other?token=valid-token&sourceApp=ChineseHandCopy&installId=install_19a",
      ),
      { params: Promise.resolve({ feedbackId: "fb_other" }) },
    );

    await expect(response.json()).resolves.toEqual({ error: "FEEDBACK_NOT_FOUND" });
    expect(response.status).toBe(404);
  });

  it("marks feedback replies as read for the current install", async () => {
    markFeedbackRepliesRead.mockResolvedValueOnce(true);
    const { PATCH } = await import("@/app/api/feedback/[feedbackId]/read/route");

    const response = await PATCH(
      new Request(
        "http://localhost/api/feedback/fb_123/read?token=valid-token&sourceApp=ChineseHandCopy&installId=install_19a",
      ),
      { params: Promise.resolve({ feedbackId: "fb_123" }) },
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(markFeedbackRepliesRead).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      installId: "install_19a",
      feedbackId: "fb_123",
    });
  });

  it("creates an admin reply for feedback", async () => {
    replyToFeedbackAsAdmin.mockResolvedValueOnce({ id: "msg_admin_1" });
    const { POST } = await import("@/app/api/admin/feedback/[feedbackId]/replies/route");

    const response = await POST(
      new Request("http://localhost/api/admin/feedback/fb_123/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ body: " 已记录，会放入后续版本评估。 " }),
      }),
      { params: Promise.resolve({ feedbackId: "fb_123" }) },
    );

    await expect(response.json()).resolves.toEqual({ id: "msg_admin_1" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(replyToFeedbackAsAdmin).toHaveBeenCalledWith({
      feedbackId: "fb_123",
      body: "已记录，会放入后续版本评估。",
    });
  });

  it("returns the current feedback conversation for an install", async () => {
    getCurrentFeedbackThread.mockResolvedValueOnce({
      id: "fb_123",
      message: "希望能支持横版纸张",
      status: "replied",
      createdAt: "2026-06-24T10:00:00.000Z",
      updatedAt: "2026-06-24T11:00:00.000Z",
      lastAdminReplyAt: "2026-06-24T11:00:00.000Z",
      unreadAdminReplyCount: 1,
      messages: [
        {
          id: "msg_1",
          feedbackId: "fb_123",
          senderType: "user",
          body: "希望能支持横版纸张",
          createdAt: "2026-06-24T10:00:00.000Z",
        },
      ],
    });
    const { GET } = await import("@/app/api/feedback/thread/route");

    const response = await GET(
      new Request(
        "http://localhost/api/feedback/thread?token=valid-token&sourceApp=ChineseHandCopy&installId=install_19a",
      ),
    );

    await expect(response.json()).resolves.toEqual({
      id: "fb_123",
      message: "希望能支持横版纸张",
      status: "replied",
      createdAt: "2026-06-24T10:00:00.000Z",
      updatedAt: "2026-06-24T11:00:00.000Z",
      lastAdminReplyAt: "2026-06-24T11:00:00.000Z",
      unreadAdminReplyCount: 1,
      messages: [
        {
          id: "msg_1",
          feedbackId: "fb_123",
          senderType: "user",
          body: "希望能支持横版纸张",
          createdAt: "2026-06-24T10:00:00.000Z",
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(getCurrentFeedbackThread).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      installId: "install_19a",
    });
  });

  it("returns 404 when the current install has no feedback conversation", async () => {
    getCurrentFeedbackThread.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/feedback/thread/route");

    const response = await GET(
      new Request(
        "http://localhost/api/feedback/thread?token=valid-token&sourceApp=ChineseHandCopy&installId=install_missing",
      ),
    );

    await expect(response.json()).resolves.toEqual({ error: "FEEDBACK_NOT_FOUND" });
    expect(response.status).toBe(404);
  });

  it("sends a user message to the current feedback conversation", async () => {
    sendUserFeedbackMessage.mockResolvedValueOnce({ id: "msg_123" });
    const { POST } = await import("@/app/api/feedback/thread/messages/route");

    const response = await POST(
      new Request("http://localhost/api/feedback/thread/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-real-ip": "2001:db8::42",
        },
        body: JSON.stringify({
          token: "valid-token",
          sourceApp: "ChineseHandCopy",
          channel: "google_play",
          device: "iPhone 15 Pro",
          installId: "install_19a",
          appVersion: "硬笔临帖 v2.1.4",
          message: " 希望能支持横版纸张 ",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ id: "msg_123" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(sendUserFeedbackMessage).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      channel: "google_play",
      device: "iPhone 15 Pro",
      installId: "install_19a",
      appVersion: "硬笔临帖 v2.1.4",
      ipAddress: "2001:db8::42",
      message: "希望能支持横版纸张",
    });
  });

  it("marks the current feedback conversation as read", async () => {
    markCurrentFeedbackThreadRead.mockResolvedValueOnce(true);
    const { PATCH } = await import("@/app/api/feedback/thread/read/route");

    const response = await PATCH(
      new Request(
        "http://localhost/api/feedback/thread/read?token=valid-token&sourceApp=ChineseHandCopy&installId=install_19a",
      ),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(markCurrentFeedbackThreadRead).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      installId: "install_19a",
    });
  });

  it("lists feedback threads for admin", async () => {
    listFeedbackThreadsForAdmin.mockResolvedValueOnce({
      items: [
        {
          id: "fb_123",
          sourceApp: "ChineseHandCopy",
          installId: "install_19a",
          channel: "google_play",
          device: "iPhone 15 Pro",
          appVersion: "硬笔临帖 v2.1.4",
          message: "希望能支持横版纸张",
          status: "open",
          createdAt: "2026-06-24T10:00:00.000Z",
          updatedAt: "2026-06-24T11:00:00.000Z",
          lastAdminReplyAt: null,
          unreadAdminReplyCount: 0,
        },
      ],
    });
    const { GET } = await import("@/app/api/admin/feedback/route");

    const response = await GET(
      new Request(
        "http://localhost/api/admin/feedback?sourceApp=ChineseHandCopy&status=open&channel=google_play&page=1&pageSize=50",
      ),
    );

    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "fb_123",
          sourceApp: "ChineseHandCopy",
          installId: "install_19a",
          channel: "google_play",
          device: "iPhone 15 Pro",
          appVersion: "硬笔临帖 v2.1.4",
          message: "希望能支持横版纸张",
          status: "open",
          createdAt: "2026-06-24T10:00:00.000Z",
          updatedAt: "2026-06-24T11:00:00.000Z",
          lastAdminReplyAt: null,
          unreadAdminReplyCount: 0,
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(listFeedbackThreadsForAdmin).toHaveBeenCalledWith({
      sourceApp: "ChineseHandCopy",
      status: "open",
      channel: "google_play",
      page: 1,
      pageSize: 50,
    });
  });

  it("updates feedback status for admin", async () => {
    updateFeedbackStatusAsAdmin.mockResolvedValueOnce({ id: "fb_123" });
    const { PATCH } = await import("@/app/api/admin/feedback/[feedbackId]/route");

    const response = await PATCH(
      new Request("http://localhost/api/admin/feedback/fb_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ status: "resolved" }),
      }),
      { params: Promise.resolve({ feedbackId: "fb_123" }) },
    );

    await expect(response.json()).resolves.toEqual({ id: "fb_123" });
    expect(response.status).toBe(200);
    expect(updateFeedbackStatusAsAdmin).toHaveBeenCalledWith({
      feedbackId: "fb_123",
      status: "resolved",
    });
  });
});
