import webPush from "web-push";

import { getPushConfig } from "@/lib/push/pushConfig";

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type FeedbackPushPayload = {
  v: 1;
  eventId: string;
  feedbackId: string;
  url: string;
  title: "Researvo Admin";
  body: "收到 1 条新的用户反馈";
};

export function createFeedbackPushPayload(input: {
  eventId: string;
  feedbackId: string;
}): FeedbackPushPayload {
  return {
    v: 1,
    eventId: input.eventId,
    feedbackId: input.feedbackId,
    url: `/admin/feedback?thread=${encodeURIComponent(input.feedbackId)}`,
    title: "Researvo Admin",
    body: "收到 1 条新的用户反馈",
  };
}

export async function sendWebPush(
  subscription: StoredPushSubscription,
  payload: FeedbackPushPayload,
) {
  const config = getPushConfig();
  if (!config.configured) {
    throw new Error(`Web Push is not configured: ${config.reason}`);
  }

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload),
    {
      TTL: 60 * 60 * 24,
      urgency: "high",
      timeout: 10_000,
    },
  );
}
