import { afterEach, describe, expect, it, vi } from "vitest";

import { enqueueFeedbackPushEvent } from "@/lib/push/pushOutbox";

afterEach(() => {
  delete process.env.ADMIN_WEB_PUSH_ENABLED;
});

describe("pushOutbox", () => {
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
