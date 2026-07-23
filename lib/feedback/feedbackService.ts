import { prisma } from "@/lib/persistence/repositories";
import { enrichMessageIpLocation } from "@/lib/feedback/ipLocation";
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

type FeedbackThreadWithMessages = Awaited<
  ReturnType<typeof prisma.feedbackThread.findFirst>
> & {
  messages?: Array<{
    id: string;
    feedbackId: string;
    senderType: string;
    body: string;
    createdAt: Date;
  }>;
};

async function findAuthorizedApp(sourceApp: string, token: string) {
  const app = await prisma.feedbackApp.findUnique({
    where: { sourceApp },
  });

  if (!app || app.token !== token) {
    return null;
  }

  return app;
}

function countUnreadAdminReplies(thread: {
  userLastReadAt: Date | null;
  messages: Array<{ senderType: string; createdAt: Date }>;
}) {
  return thread.messages.filter((message) => {
    if (message.senderType !== "admin") {
      return false;
    }

    return !thread.userLastReadAt || message.createdAt > thread.userLastReadAt;
  }).length;
}

function serializeThreadSummary(thread: NonNullable<FeedbackThreadWithMessages>) {
  return {
    id: thread.id,
    message: thread.message,
    status: thread.status,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    lastAdminReplyAt: thread.lastAdminReplyAt?.toISOString() ?? null,
    unreadAdminReplyCount: countUnreadAdminReplies({
      userLastReadAt: thread.userLastReadAt,
      messages: thread.messages ?? [],
    }),
  };
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
      select: {
        id: true,
      },
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
    return { thread, messageId: message.id };
  });

  void enrichMessageIpLocation(thread.messageId, input.ipAddress);
  triggerPushDispatch();
  return thread.thread;
}

export async function sendUserFeedbackMessage(input: SendUserFeedbackMessageInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);

  if (!app) {
    return null;
  }

  const message = await prisma.$transaction(async (tx) => {
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
      select: {
        id: true,
      },
    });

    const message = await tx.feedbackMessage.create({
      data: {
        feedbackId: thread.id,
        senderType: "user",
        body: input.message,
        appVersion: input.appVersion,
        ipAddress: input.ipAddress,
      },
      select: {
        id: true,
      },
    });

    await enqueueFeedbackPushEvent(tx, {
      feedbackId: thread.id,
      messageId: message.id,
    });
    return message;
  });

  void enrichMessageIpLocation(message.id, input.ipAddress);
  triggerPushDispatch();
  return message;
}

export async function listFeedbackForInstall(input: FeedbackInstallInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);

  if (!app) {
    return null;
  }

  const threads = await prisma.feedbackThread.findMany({
    where: {
      sourceApp: app.sourceApp,
      installId: input.installId,
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

  return threads.map(serializeThreadSummary);
}

export async function getFeedbackDetail(input: FeedbackDetailInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);

  if (!app) {
    return null;
  }

  const thread = await prisma.feedbackThread.findFirst({
    where: {
      id: input.feedbackId,
      sourceApp: app.sourceApp,
      installId: input.installId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          feedbackId: true,
          senderType: true,
          body: true,
          createdAt: true,
        },
      },
    },
  });

  if (!thread) {
    return null;
  }

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

export async function getCurrentFeedbackThread(input: FeedbackInstallInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);

  if (!app) {
    return null;
  }

  const thread = await prisma.feedbackThread.findFirst({
    where: {
      sourceApp: app.sourceApp,
      installId: input.installId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          feedbackId: true,
          senderType: true,
          body: true,
          createdAt: true,
        },
      },
    },
  });

  if (!thread) {
    return null;
  }

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

export async function markFeedbackRepliesRead(input: FeedbackDetailInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);

  if (!app) {
    return null;
  }

  const result = await prisma.feedbackThread.updateMany({
    where: {
      id: input.feedbackId,
      sourceApp: app.sourceApp,
      installId: input.installId,
    },
    data: {
      userLastReadAt: new Date(),
    },
  });

  return result.count > 0;
}

export async function markCurrentFeedbackThreadRead(input: FeedbackInstallInput) {
  const app = await findAuthorizedApp(input.sourceApp, input.token);

  if (!app) {
    return null;
  }

  const result = await prisma.feedbackThread.updateMany({
    where: {
      sourceApp: app.sourceApp,
      installId: input.installId,
    },
    data: {
      userLastReadAt: new Date(),
    },
  });

  return result.count > 0;
}

export async function replyToFeedbackAsAdmin(input: AdminFeedbackReplyInput) {
  return prisma.$transaction(async (tx) => {
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
      select: {
        id: true,
      },
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
}

export async function listFeedbackThreadsForAdmin(input: AdminFeedbackListInput) {
  const where = {
    sourceApp: input.sourceApp,
    status: input.status,
    channel: input.channel,
    OR: input.q
      ? [
          { message: { contains: input.q, mode: "insensitive" as const } },
          { sourceApp: { contains: input.q, mode: "insensitive" as const } },
          { installId: { contains: input.q, mode: "insensitive" as const } },
          {
            messages: {
              some: { body: { contains: input.q, mode: "insensitive" as const } },
            },
          },
        ]
      : undefined,
  };

  const [threads, total] = await Promise.all([
    prisma.feedbackThread.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: "desc" as const },
          take: 1,
          select: {
            id: true,
            feedbackId: true,
            senderType: true,
            body: true,
            createdAt: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.feedbackThread.count({ where }),
  ]);

  return {
    items: threads.map((thread) => {
      const latestMessage = thread.messages[0] ?? null;
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
        messageCount: thread._count.messages,
        latestMessage: latestMessage
          ? {
              body: latestMessage.body,
              senderType: latestMessage.senderType,
              createdAt: latestMessage.createdAt.toISOString(),
            }
          : null,
        needsAdminReply: latestMessage?.senderType === "user",
      };
    }),
    page: input.page,
    pageSize: input.pageSize,
    total,
    hasMore: input.page * input.pageSize < total,
  };
}

export async function getFeedbackThreadForAdmin(feedbackId: string) {
  const thread = await prisma.feedbackThread.findUnique({
    where: { id: feedbackId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          feedbackId: true,
          senderType: true,
          body: true,
          appVersion: true,
          ipAddress: true,
          ipLocation: true,
          createdAt: true,
        },
      },
    },
  });

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
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function deleteFeedbackThreadAsAdmin(feedbackId: string) {
  const result = await prisma.feedbackThread.deleteMany({
    where: { id: feedbackId },
  });

  return result.count > 0;
}

export async function updateAdminFeedbackMessage(input: AdminFeedbackMessageUpdateInput) {
  const message = await prisma.feedbackMessage.updateMany({
    where: {
      id: input.messageId,
      feedbackId: input.feedbackId,
      senderType: "admin",
    },
    data: {
      body: input.body,
    },
  });

  if (message.count === 0) {
    return null;
  }

  const thread = await prisma.feedbackThread.update({
    where: { id: input.feedbackId },
    data: {
      updatedAt: new Date(),
    },
    select: { id: true },
  });

  return thread;
}

export async function updateFeedbackStatusAsAdmin(input: AdminFeedbackStatusInput) {
  return prisma.feedbackThread.update({
    where: { id: input.feedbackId },
    data: {
      status: input.status,
    },
    select: {
      id: true,
    },
  });
}
