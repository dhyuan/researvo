import type { Prisma } from "@prisma/client";

export async function enqueueFeedbackPushEvent(
  tx: Prisma.TransactionClient,
  input: { feedbackId: string; messageId: string },
) {
  if (process.env.ADMIN_WEB_PUSH_ENABLED !== "true") {
    return null;
  }

  return tx.feedbackPushEvent.upsert({
    where: { messageId: input.messageId },
    create: {
      feedbackId: input.feedbackId,
      messageId: input.messageId,
    },
    update: {},
    select: { id: true },
  });
}

export function triggerPushDispatch() {
  if (process.env.ADMIN_WEB_PUSH_ENABLED !== "true") {
    return;
  }

  void import("@/lib/push/pushDispatcher")
    .then(({ drainPushOutbox }) => drainPushOutbox({ limit: 1 }))
    .catch(() => {
      console.error("Best-effort Web Push dispatch failed; event remains in outbox");
    });
}
