import type { Prisma } from "@prisma/client";
import { after } from "next/server";

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

  // Register with Next's request lifetime so serverless hosts keep delivery alive.
  after(async () => {
    try {
      const { drainPushOutbox } = await import("@/lib/push/pushDispatcher");
      await drainPushOutbox({ limit: 5 });
    } catch {
      console.error("Web Push dispatch failed; event remains in outbox for retry");
    }
  });
}
