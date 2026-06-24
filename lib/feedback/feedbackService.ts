import { prisma } from "@/lib/persistence/repositories";

export type SubmitFeedbackInput = {
  token: string;
  sourceApp: string;
  channel?: string;
  device?: string;
  version?: string;
  installId?: string;
  appVersion?: string;
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

export type AdminFeedbackReplyInput = {
  feedbackId: string;
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

  return prisma.$transaction(async (tx) => {
    const thread = await tx.feedbackThread.create({
      data: {
        feedbackAppId: app.id,
        sourceApp: app.sourceApp,
        channel: input.channel ?? "unknown",
        installId: input.installId ?? "legacy",
        device: input.device,
        appVersion: input.appVersion ?? input.version,
        message: input.message,
      },
      select: {
        id: true,
      },
    });

    await tx.feedbackMessage.create({
      data: {
        feedbackId: thread.id,
        senderType: "user",
        body: input.message,
      },
    });

    return thread;
  });
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
