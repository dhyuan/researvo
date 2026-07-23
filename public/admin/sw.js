/* global self */

const ADMIN_FALLBACK_URL = "/admin/feedback";
const NOTIFICATION_TITLE = "Researvo Admin";
const NOTIFICATION_BODY = "收到 1 条新的用户反馈";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function adminUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length > 2048) {
    return new URL(ADMIN_FALLBACK_URL, self.location.origin).href;
  }

  try {
    const url = new URL(rawUrl, self.location.origin);
    if (url.origin !== self.location.origin || !url.pathname.startsWith("/admin/")) {
      throw new Error("URL is outside the admin scope");
    }
    return url.href;
  } catch {
    return new URL(ADMIN_FALLBACK_URL, self.location.origin).href;
  }
}

function pushPayload(event) {
  if (!event.data) return {};
  try {
    const value = event.data.json();
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

self.addEventListener("push", (event) => {
  const payload = pushPayload(event);
  const feedbackId = typeof payload.feedbackId === "string" ? payload.feedbackId : null;
  const destination = adminUrl(
    typeof payload.url === "string"
      ? payload.url
      : feedbackId
        ? `${ADMIN_FALLBACK_URL}?thread=${encodeURIComponent(feedbackId)}`
        : ADMIN_FALLBACK_URL,
  );
  const payloadCount = payload.count;
  const count = Number.isSafeInteger(payloadCount) && payloadCount > 0 ? payloadCount : 1;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(NOTIFICATION_TITLE, {
        body: count === 1 ? NOTIFICATION_BODY : `收到 ${count} 条新的用户反馈`,
        icon: "/admin/icons/icon-192.png",
        badge: "/admin/icons/notification-badge.png",
        tag: feedbackId ? `feedback-${feedbackId}` : "feedback-new-message",
        renotify: true,
        data: { url: destination, feedbackId },
      }),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "ADMIN_PUSH_RECEIVED",
            feedbackId,
            count,
          });
        });
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = adminUrl(event.notification.data?.url);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const destinationUrl = new URL(destination);
      const adminClient = clients.find((client) => {
        try {
          const clientUrl = new URL(client.url);
          return clientUrl.origin === self.location.origin && clientUrl.pathname.startsWith("/admin/");
        } catch {
          return false;
        }
      });

      if (adminClient) {
        await adminClient.navigate(destinationUrl.href);
        await adminClient.focus();
        adminClient.postMessage({
          type: "ADMIN_NOTIFICATION_OPENED",
          url: `${destinationUrl.pathname}${destinationUrl.search}`,
        });
        return;
      }

      await self.clients.openWindow(destinationUrl.href);
    }),
  );
});
