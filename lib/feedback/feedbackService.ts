import {
  deleteFeedbackThreadFromCache,
  ensureFeedbackCacheReady,
  getAllFeedbackThreadsFromCache,
  getFeedbackAppFromCache,
  getFeedbackThreadForInstallFromCache,
  getFeedbackThreadFromCache,
  markFeedbackCacheNotReady,
  updateFeedbackThreadInCache,
  upsertFeedbackThreadInCache,
  type FeedbackCacheThread,
} from "@/lib/feedback/feedbackCache";
import { prisma } from "@/lib/persistence/repositories";
import {
  enqueueFeedbackPushEvent,
  triggerPushDispatch,
} from "@/lib/push/pushOutbox";

export type SubmitFeedbackInput = {
  token: string;
  sourceApp: string;
  channel?: string;
  device?: string;
  version?: string;
  installId?: string;
  appVersion?: string;
  ipAddress?: string;
  parentId?: string;
  message: string;
};

export type FeedbackInstallInput = {
  token: string;
  sourceApp: string;
  installId: string;
};

export type FeedbackDetailInput = FeedbackInstallInput & {
  feedbackId: string;
};

export type SendUserFeedbackMessageInput = {
  token: string;
  sourceApp: string;
  channel: string;
  device?: string;
  installId: string;
  appVersion?: string;
  ipAddress?: string;
  message: string;
};

export type AdminFeedbackListInput = {
  sourceApp?: string;
  status?: string;
  channel?: string;
  q?: string;
  page: number;
  pageSize: number;
};

export type AdminFeedbackReplyInput = {
  feedbackId: string;
  body: string;
};

export type AdminFeedbackStatusInput = {
  feedbackId: string;
  status: string;
};

export type AdminFeedbackMessageUpdateInput = {
  feedbackId: string;
  messageId: string;
  body: string;
};

export async function findAuthorizedApp(sourceApp: string, token: string) {
  const app = await getFeedbackAppFromCache(sourceApp);
  return app?.token === token ? app : null;
}

function countUnreadAdminReplies(thread: FeedbackCacheThread) {
  return thread.messages.filter((message) => {
    if (message.senderType !== "admin") {
      return false;
    }

    return !thread.userLastReadAt || message.createdAt > thread.userLastReadAt;
  }).length;
}

function serializeThreadSummary(thread: FeedbackCacheThread) {
  return {
    id: thread.id,
    message: thread.message,
    status: thread.status,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    lastAdminReplyAt: thread.lastAdminReplyAt?.toISOString() ?? null,
    unreadAdminReplyCount: countUnreadAdminReplies(thread),
  };
}

function serializeClientThread(thread: FeedbackCacheThread) {
  return {
    ...serializeThreadSummary(thread),
    messages: thread.messages.map((message) => ({
      id: message.id,
      feedbackId: message.feedbackId,
      senderType: message.senderType,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

async function refreshFeedbackThreadAfterWrite(feedbackId: string) {
  try {
    const thread = await prisma.feedbackThread.findUnique({
      where: { id: feedbackId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!thread) {
      deleteFeedbackThreadFromCache(feedbackId);
      return;
    }

    if (!upsertFeedbackThreadInCache(thread as FeedbackCacheThread)) {
      markFeedbackCacheNotReady("thread refresh found no ready snapshot");
    }
  } catch (error) {
    markFeedbackCacheNotReady("thread refresh failed after database write", error);
  }
}

export async function submitFeedback(input: SubmitFeedbackInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);
  if (!app) {
    return null;
  }

  const thread = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const installId = input.installId ?? "legacy";
    const thread = await tx.feedbackThread.upsert({
      where: {
        sourceApp_installId: {
          sourceApp: app.sourceApp,
          installId,
        },
      },
      create: {
        feedbackAppId: app.id,
        sourceApp: app.sourceApp,
        channel: input.channel ?? "unknown",
        installId,
        device: input.device,
        appVersion: input.appVersion ?? input.version,
        message: input.message,
        status: "open",
      },
      update: {
        channel: input.channel ?? undefined,
        device: input.device,
        appVersion: input.appVersion ?? input.version,
        status: "open",
        updatedAt: now,
      },
      select: { id: true },
    });

    const message = await tx.feedbackMessage.create({
      data: {
        feedbackId: thread.id,
        senderType: "user",
        body: input.message,
        appVersion: input.appVersion ?? input.version,
        ipAddress: input.ipAddress,
      },
      select: { id: true },
    });

    await enqueueFeedbackPushEvent(tx, {
      feedbackId: thread.id,
      messageId: message.id,
    });
    return { ...thread, userMessageId: message.id };
  });

  await refreshFeedbackThreadAfterWrite(thread.id);
  triggerPushDispatch();
  return thread;
}

export async function sendUserFeedbackMessage(input: SendUserFeedbackMessageInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);
  if (!app) {
    return null;
  }

  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const thread = await tx.feedbackThread.upsert({
      where: {
        sourceApp_installId: {
          sourceApp: app.sourceApp,
          installId: input.installId,
        },
      },
      create: {
        feedbackAppId: app.id,
        sourceApp: app.sourceApp,
        channel: input.channel,
        installId: input.installId,
        device: input.device,
        appVersion: input.appVersion,
        message: input.message,
        status: "open",
      },
      update: {
        channel: input.channel,
        device: input.device,
        appVersion: input.appVersion,
        status: "open",
        updatedAt: now,
      },
      select: { id: true },
    });

    const message = await tx.feedbackMessage.create({
      data: {
        feedbackId: thread.id,
        senderType: "user",
        body: input.message,
        appVersion: input.appVersion,
        ipAddress: input.ipAddress,
      },
      select: { id: true },
    });

    await enqueueFeedbackPushEvent(tx, {
      feedbackId: thread.id,
      messageId: message.id,
    });
    return { message, feedbackId: thread.id };
  });

  await refreshFeedbackThreadAfterWrite(result.feedbackId);
  triggerPushDispatch();
  return result.message;
}

export async function listFeedbackForInstall(input: FeedbackInstallInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);
  if (!app) {
    return null;
  }

  const thread = await getFeedbackThreadForInstallFromCache(
    app.sourceApp,
    input.installId,
  );
  return thread ? [serializeThreadSummary(thread)] : [];
}

export async function getFeedbackDetail(input: FeedbackDetailInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);
  if (!app) {
    return null;
  }

  const thread = await getFeedbackThreadFromCache(input.feedbackId);
  if (
    !thread ||
    thread.sourceApp !== app.sourceApp ||
    thread.installId !== input.installId
  ) {
    return null;
  }

  return serializeClientThread(thread);
}

export async function getCurrentFeedbackThread(input: FeedbackInstallInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);
  if (!app) {
    return null;
  }

  const thread = await getFeedbackThreadForInstallFromCache(
    app.sourceApp,
    input.installId,
  );
  return thread ? serializeClientThread(thread) : null;
}

export async function markFeedbackRepliesRead(input: FeedbackDetailInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);
  if (!app) {
    return null;
  }

  const cached = await getFeedbackThreadFromCache(input.feedbackId);
  if (
    !cached ||
    cached.sourceApp !== app.sourceApp ||
    cached.installId !== input.installId
  ) {
    return false;
  }

  const readAt = new Date();
  const result = await prisma.feedbackThread.updateMany({
    where: {
      id: input.feedbackId,
      sourceApp: app.sourceApp,
      installId: input.installId,
    },
    data: {
      userLastReadAt: readAt,
      updatedAt: readAt,
    },
  });

  if (result.count > 0) {
    if (
      !updateFeedbackThreadInCache(input.feedbackId, (thread) => ({
        ...thread,
        userLastReadAt: readAt,
        updatedAt: readAt,
      }))
    ) {
      markFeedbackCacheNotReady("failed to update read state");
    }
  }
  return result.count > 0;
}

export async function markCurrentFeedbackThreadRead(input: FeedbackInstallInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);
  if (!app) {
    return null;
  }

  const cached = await getFeedbackThreadForInstallFromCache(
    app.sourceApp,
    input.installId,
  );
  if (!cached) {
    return false;
  }

  const readAt = new Date();
  const result = await prisma.feedbackThread.updateMany({
    where: {
      sourceApp: app.sourceApp,
      installId: input.installId,
    },
    data: {
      userLastReadAt: readAt,
      updatedAt: readAt,
    },
  });

  if (result.count > 0) {
    if (
      !updateFeedbackThreadInCache(cached.id, (thread) => ({
        ...thread,
        userLastReadAt: readAt,
        updatedAt: readAt,
      }))
    ) {
      markFeedbackCacheNotReady("failed to update current thread read state");
    }
  }
  return result.count > 0;
}

export async function replyToFeedbackAsAdmin(input: AdminFeedbackReplyInput) {
  await ensureFeedbackCacheReady();
  const result = await prisma.$transaction(async (tx) => {
    const thread = await tx.feedbackThread.findUnique({
      where: { id: input.feedbackId },
      select: { id: true },
    });
    if (!thread) {
      return null;
    }

    const now = new Date();
    const message = await tx.feedbackMessage.create({
      data: {
        feedbackId: input.feedbackId,
        senderType: "admin",
        body: input.body,
      },
      select: { id: true },
    });
    await tx.feedbackThread.update({
      where: { id: input.feedbackId },
      data: {
        status: "replied",
        lastAdminReplyAt: now,
        updatedAt: now,
      },
    });
    return message;
  });

  if (result) {
    await refreshFeedbackThreadAfterWrite(input.feedbackId);
  }
  return result;
}

export async function listFeedbackThreadsForAdmin(input: AdminFeedbackListInput) {
  const query = input.q?.toLocaleLowerCase();
  const matching = (await getAllFeedbackThreadsFromCache())
    .filter((thread) => {
      if (input.sourceApp && thread.sourceApp !== input.sourceApp) return false;
      if (input.status && thread.status !== input.status) return false;
      if (input.channel && thread.channel !== input.channel) return false;
      if (!query) return true;
      return (
        thread.message.toLocaleLowerCase().includes(query) ||
        thread.sourceApp.toLocaleLowerCase().includes(query) ||
        thread.installId.toLocaleLowerCase().includes(query) ||
        thread.messages.some((message) =>
          message.body.toLocaleLowerCase().includes(query),
        )
      );
    })
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

  const total = matching.length;
  const start = (input.page - 1) * input.pageSize;
  const threads = matching.slice(start, start + input.pageSize);

  return {
    items: threads.map((thread) => {
      const latestMessage = thread.messages.at(-1) ?? null;
      return {
        id: thread.id,
        message: latestMessage?.body ?? thread.message,
        status: thread.status,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
        lastAdminReplyAt: thread.lastAdminReplyAt?.toISOString() ?? null,
        sourceApp: thread.sourceApp,
        installId: thread.installId,
        channel: thread.channel,
        device: thread.device,
        appVersion: thread.appVersion,
        messageCount: thread.messages.length,
        latestMessage: latestMessage
          ? {
              body: latestMessage.body,
              senderType: latestMessage.senderType,
              createdAt: latestMessage.createdAt.toISOString(),
            }
          : null,
        needsAdminReply:
          thread.status === "open" && latestMessage?.senderType === "user",
      };
    }),
    page: input.page,
    pageSize: input.pageSize,
    total,
    hasMore: input.page * input.pageSize < total,
  };
}

export async function getFeedbackThreadForAdmin(feedbackId: string) {
  const thread = await getFeedbackThreadFromCache(feedbackId);
  if (!thread) {
    return null;
  }

  return {
    id: thread.id,
    sourceApp: thread.sourceApp,
    installId: thread.installId,
    channel: thread.channel,
    device: thread.device,
    appVersion: thread.appVersion,
    message: thread.message,
    status: thread.status,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    lastAdminReplyAt: thread.lastAdminReplyAt?.toISOString() ?? null,
    messages: thread.messages.map((message) => ({
      id: message.id,
      feedbackId: message.feedbackId,
      senderType: message.senderType,
      body: message.body,
      appVersion: message.appVersion,
      ipAddress: message.ipAddress,
      ipLocation: message.ipLocation,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function deleteFeedbackThreadAsAdmin(feedbackId: string) {
  await ensureFeedbackCacheReady();
  const result = await prisma.feedbackThread.deleteMany({
    where: { id: feedbackId },
  });
  if (result.count > 0 && !deleteFeedbackThreadFromCache(feedbackId)) {
    markFeedbackCacheNotReady("failed to delete thread from cache");
  }
  return result.count > 0;
}

export async function updateAdminFeedbackMessage(
  input: AdminFeedbackMessageUpdateInput,
) {
  await ensureFeedbackCacheReady();
  const message = await prisma.feedbackMessage.updateMany({
    where: {
      id: input.messageId,
      feedbackId: input.feedbackId,
      senderType: "admin",
    },
    data: { body: input.body },
  });
  if (message.count === 0) {
    return null;
  }

  const updatedAt = new Date();
  const thread = await prisma.feedbackThread.update({
    where: { id: input.feedbackId },
    data: { updatedAt },
    select: { id: true },
  });

  if (
    !updateFeedbackThreadInCache(input.feedbackId, (cached) => ({
      ...cached,
      updatedAt,
      messages: cached.messages.map((item) =>
        item.id === input.messageId ? { ...item, body: input.body } : item,
      ),
    }))
  ) {
    markFeedbackCacheNotReady("failed to update admin message in cache");
  }
  return thread;
}

export async function updateFeedbackStatusAsAdmin(
  input: AdminFeedbackStatusInput,
) {
  await ensureFeedbackCacheReady();
  const updatedAt = new Date();
  const thread = await prisma.feedbackThread.update({
    where: { id: input.feedbackId },
    data: {
      status: input.status,
      updatedAt,
    },
    select: { id: true },
  });

  if (
    !updateFeedbackThreadInCache(input.feedbackId, (cached) => ({
      ...cached,
      status: input.status,
      updatedAt,
    }))
  ) {
    markFeedbackCacheNotReady("failed to update feedback status in cache");
  }
  return thread;
}
