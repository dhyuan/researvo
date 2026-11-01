import { afterEach, describe, expect, it, vi } from "vitest";

import { enqueueFeedbackPushEvent, triggerPushDispatch } from "@/lib/push/pushOutbox";

const { after, drain } = vi.hoisted(() => ({ after: vi.fn(), drain: vi.fn() }));
vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/push/pushDispatcher", () => ({ drainPushOutbox: drain }));

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_WEB_PUSH_ENABLED;
});

describe("pushOutbox", () => {
  it("keeps queued delivery alive after the response and drains a backlog", async () => {
    process.env.ADMIN_WEB_PUSH_ENABLED = "true";
    triggerPushDispatch();
    expect(after).toHaveBeenCalledOnce();
    expect(drain).not.toHaveBeenCalled();
    await after.mock.calls[0][0]();
    expect(drain).toHaveBeenCalledWith({ limit: 5 });
  });

  it("does not schedule delivery when disabled", () => {
    triggerPushDispatch();
    expect(after).not.toHaveBeenCalled();
  });

  it("leaves failed delivery in the outbox without rejecting the response callback", async () => {
    process.env.ADMIN_WEB_PUSH_ENABLED = "true";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    drain.mockRejectedValueOnce(new Error("database unavailable"));
    try {
      triggerPushDispatch();
      expect(after).toHaveBeenCalledOnce();
      await expect(after.mock.calls[0][0]()).resolves.toBeUndefined();
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("does not create events while Admin Web Push is disabled", async () => {
    const upsert = vi.fn();

    await expect(
      enqueueFeedbackPushEvent(
        { feedbackPushEvent: { upsert } } as never,
        { feedbackId: "feedback_1", messageId: "message_1" },
      ),
    ).resolves.toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("uses the message id as the event idempotency key when enabled", async () => {
    process.env.ADMIN_WEB_PUSH_ENABLED = "true";
    const upsert = vi.fn().mockResolvedValue({ id: "event_1" });

    await enqueueFeedbackPushEvent(
      { feedbackPushEvent: { upsert } } as never,
      { feedbackId: "feedback_1", messageId: "message_1" },
    );

    expect(upsert).toHaveBeenCalledWith({
      where: { messageId: "message_1" },
      create: {
        feedbackId: "feedback_1",
        messageId: "message_1",
      },
      update: {},
      select: { id: true },
    });
  });
});
