import { prisma } from "@/lib/persistence/repositories";

export const CLIENT_THREAD_CACHE_QUERY_METRIC_KEY =
  "client_thread_cache_queries";

const CLIENT_QUERY_FLUSH_SIZE = 100;
const GLOBAL_STATE_KEY = "__researvoFeedbackCacheState";

export type FeedbackCacheApp = {
  id: string;
  sourceApp: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
};

export type FeedbackCacheMessage = {
  id: string;
  feedbackId: string;
  senderType: string;
  body: string;
  appVersion: string | null;
  ipAddress: string | null;
  ipLocation: unknown;
  createdAt: Date;
};

export type FeedbackCacheThread = {
  id: string;
  feedbackAppId: string;
  sourceApp: string;
  channel: string;
  installId: string;
  device: string | null;
  appVersion: string | null;
  message: string;
  status: string;
  userLastReadAt: Date | null;
  lastAdminReplyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages: FeedbackCacheMessage[];
};

export type FeedbackCacheSnapshot = {
  appsBySourceApp: ReadonlyMap<string, FeedbackCacheApp>;
  threadsById: ReadonlyMap<string, FeedbackCacheThread>;
  threadIdBySourceAppAndInstallId: ReadonlyMap<string, string>;
  messageToThreadId: ReadonlyMap<string, string>;
  loadedAt: Date;
  appCount: number;
  threadCount: number;
  messageCount: number;
};

type FeedbackCacheState = {
  snapshot: FeedbackCacheSnapshot | null;
  status: "empty" | "loading" | "ready";
  loadPromise: Promise<FeedbackCacheSnapshot> | null;
  rebuildPromise: Promise<FeedbackCacheRebuildResult> | null;
  persistedTotal: bigint;
  pendingCount: number;
  lastPersistedAt: Date | null;
  flushPromise: Promise<void> | null;
  flushingCount: number;
  revision: number;
};

export type FeedbackCacheRebuildResult = {
  ok: true;
  appCount: number;
  threadCount: number;
  messageCount: number;
  durationMs: number;
  rebuiltAt: string;
};

type LoadedFeedbackApp = {
  id: string;
  sourceApp: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  threads: Array<FeedbackCacheThread>;
};

declare global {
  var __researvoFeedbackCacheState: FeedbackCacheState | undefined;
}

function createState(): FeedbackCacheState {
  return {
    snapshot: null,
    status: "empty",
    loadPromise: null,
    rebuildPromise: null,
    persistedTotal: BigInt(0),
    pendingCount: 0,
    lastPersistedAt: null,
    flushPromise: null,
    flushingCount: 0,
    revision: 0,
  };
}

function state() {
  if (!globalThis[GLOBAL_STATE_KEY]) {
    globalThis[GLOBAL_STATE_KEY] = createState();
  }

  return globalThis[GLOBAL_STATE_KEY];
}

function installKey(sourceApp: string, installId: string) {
  return `${sourceApp}\u0000${installId}`;
}

function cloneMessage(message: FeedbackCacheMessage): FeedbackCacheMessage {
  return { ...message };
}

function cloneThread(thread: FeedbackCacheThread): FeedbackCacheThread {
  return {
    ...thread,
    messages: thread.messages.map(cloneMessage),
  };
}

function buildSnapshot(apps: LoadedFeedbackApp[]): FeedbackCacheSnapshot {
  const appsBySourceApp = new Map<string, FeedbackCacheApp>();
  const threadsById = new Map<string, FeedbackCacheThread>();
  const threadIdBySourceAppAndInstallId = new Map<string, string>();
  const messageToThreadId = new Map<string, string>();

  for (const app of apps) {
    appsBySourceApp.set(app.sourceApp, {
      id: app.id,
      sourceApp: app.sourceApp,
      token: app.token,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    });

    for (const sourceThread of app.threads) {
      const thread = cloneThread(sourceThread);
      threadsById.set(thread.id, thread);
      threadIdBySourceAppAndInstallId.set(
        installKey(thread.sourceApp, thread.installId),
        thread.id,
      );

      for (const message of thread.messages) {
        messageToThreadId.set(message.id, thread.id);
      }
    }
  }

  return {
    appsBySourceApp,
    threadsById,
    threadIdBySourceAppAndInstallId,
    messageToThreadId,
    loadedAt: new Date(),
    appCount: appsBySourceApp.size,
    threadCount: threadsById.size,
    messageCount: messageToThreadId.size,
  };
}

async function loadApps() {
  return prisma.feedbackApp.findMany({
    include: {
      threads: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  }) as unknown as Promise<LoadedFeedbackApp[]>;
}

async function loadInitialSnapshot() {
  const current = state();
  const revision = current.revision;
  const [apps, metric] = await Promise.all([
    loadApps(),
    prisma.feedbackMetric.findUnique({
      where: { key: CLIENT_THREAD_CACHE_QUERY_METRIC_KEY },
    }),
  ]);
  const snapshot = buildSnapshot(apps);

  if (current.revision !== revision) {
    throw new Error("Feedback cache changed while it was loading");
  }

  current.snapshot = snapshot;
  current.persistedTotal = metric?.total ?? BigInt(0);
  current.lastPersistedAt = metric?.updatedAt ?? null;
  current.status = "ready";
  console.info("Feedback cache initialized", {
    appCount: snapshot.appCount,
    threadCount: snapshot.threadCount,
    messageCount: snapshot.messageCount,
  });
  return snapshot;
}

export async function ensureFeedbackCacheReady() {
  const current = state();
  if (current.snapshot) {
    return current.snapshot;
  }

  if (current.loadPromise) {
    return current.loadPromise;
  }

  current.status = "loading";
  current.loadPromise = loadInitialSnapshot()
    .catch((error) => {
      current.status = "empty";
      throw error;
    })
    .finally(() => {
      current.loadPromise = null;
    });
  return current.loadPromise;
}

export async function rebuildFeedbackCache(): Promise<FeedbackCacheRebuildResult> {
  const current = state();
  if (current.rebuildPromise) {
    return current.rebuildPromise;
  }

  const startedAt = Date.now();
  const revision = current.revision;
  current.rebuildPromise = (async () => {
    const shouldLoadMetric = !current.snapshot;
    const [apps, metric] = await Promise.all([
      loadApps(),
      shouldLoadMetric
        ? prisma.feedbackMetric.findUnique({
            where: { key: CLIENT_THREAD_CACHE_QUERY_METRIC_KEY },
          })
        : Promise.resolve(null),
    ]);
    const snapshot = buildSnapshot(apps);

    if (current.revision !== revision) {
      throw new Error("Feedback cache changed while it was rebuilding");
    }

    current.snapshot = snapshot;
    if (metric) {
      current.persistedTotal = metric.total;
      current.lastPersistedAt = metric.updatedAt;
    }
    current.status = "ready";
    const result: FeedbackCacheRebuildResult = {
      ok: true,
      appCount: snapshot.appCount,
      threadCount: snapshot.threadCount,
      messageCount: snapshot.messageCount,
      durationMs: Date.now() - startedAt,
      rebuiltAt: snapshot.loadedAt.toISOString(),
    };
    console.info("Feedback cache rebuilt", result);
    return result;
  })()
    .catch((error) => {
      current.status = current.snapshot ? "ready" : "empty";
      throw error;
    })
    .finally(() => {
      current.rebuildPromise = null;
    });

  return current.rebuildPromise;
}

export async function getFeedbackAppFromCache(sourceApp: string) {
  return (await ensureFeedbackCacheReady()).appsBySourceApp.get(sourceApp) ?? null;
}

export async function getFeedbackThreadFromCache(feedbackId: string) {
  return (await ensureFeedbackCacheReady()).threadsById.get(feedbackId) ?? null;
}

export async function getFeedbackThreadForInstallFromCache(
  sourceApp: string,
  installId: string,
) {
  const snapshot = await ensureFeedbackCacheReady();
  const id = snapshot.threadIdBySourceAppAndInstallId.get(
    installKey(sourceApp, installId),
  );
  return id ? snapshot.threadsById.get(id) ?? null : null;
}

export async function getAllFeedbackThreadsFromCache() {
  return Array.from((await ensureFeedbackCacheReady()).threadsById.values());
}

function replaceSnapshot(
  current: FeedbackCacheState,
  threadsById: Map<string, FeedbackCacheThread>,
) {
  const previous = current.snapshot;
  if (!previous) {
    return false;
  }

  const threadIdBySourceAppAndInstallId = new Map<string, string>();
  const messageToThreadId = new Map<string, string>();
  for (const thread of threadsById.values()) {
    threadIdBySourceAppAndInstallId.set(
      installKey(thread.sourceApp, thread.installId),
      thread.id,
    );
    for (const message of thread.messages) {
      messageToThreadId.set(message.id, thread.id);
    }
  }

  current.snapshot = {
    ...previous,
    threadsById,
    threadIdBySourceAppAndInstallId,
    messageToThreadId,
    threadCount: threadsById.size,
    messageCount: messageToThreadId.size,
  };
  current.status = "ready";
  current.revision += 1;
  return true;
}

export function upsertFeedbackThreadInCache(thread: FeedbackCacheThread) {
  const current = state();
  if (!current.snapshot) {
    return false;
  }

  const existing = current.snapshot.threadsById.get(thread.id);
  if (
    existing &&
    (existing.updatedAt > thread.updatedAt ||
      (existing.updatedAt.getTime() === thread.updatedAt.getTime() &&
        existing.messages.length > thread.messages.length))
  ) {
    return true;
  }

  const threads = new Map(current.snapshot.threadsById);
  threads.set(thread.id, cloneThread(thread));
  return replaceSnapshot(current, threads);
}

export function deleteFeedbackThreadFromCache(feedbackId: string) {
  const current = state();
  if (!current.snapshot) {
    return false;
  }

  const threads = new Map(current.snapshot.threadsById);
  threads.delete(feedbackId);
  return replaceSnapshot(current, threads);
}

export function updateFeedbackThreadInCache(
  feedbackId: string,
  updater: (thread: FeedbackCacheThread) => FeedbackCacheThread,
) {
  const current = state();
  const thread = current.snapshot?.threadsById.get(feedbackId);
  if (!thread || !current.snapshot) {
    return false;
  }

  const threads = new Map(current.snapshot.threadsById);
  threads.set(feedbackId, cloneThread(updater(cloneThread(thread))));
  return replaceSnapshot(current, threads);
}

export function updateFeedbackMessageInCache(
  messageId: string,
  updater: (message: FeedbackCacheMessage) => FeedbackCacheMessage,
) {
  const current = state();
  const feedbackId = current.snapshot?.messageToThreadId.get(messageId);
  if (!feedbackId) {
    return false;
  }

  return updateFeedbackThreadInCache(feedbackId, (thread) => ({
    ...thread,
    messages: thread.messages.map((message) =>
      message.id === messageId ? updater(cloneMessage(message)) : message,
    ),
  }));
}

export function markFeedbackCacheNotReady(reason: string, error?: unknown) {
  const current = state();
  current.snapshot = null;
  current.status = "empty";
  current.revision += 1;
  console.error("Feedback cache marked not ready", {
    reason,
    error: error instanceof Error ? error.message : undefined,
  });
}

async function flushPendingClientQueries() {
  const current = state();
  if (current.flushPromise || current.pendingCount < CLIENT_QUERY_FLUSH_SIZE) {
    return current.flushPromise;
  }

  const batchSize = current.pendingCount;
  current.pendingCount = 0;
  current.flushingCount = batchSize;
  current.flushPromise = (async () => {
    try {
      const metric = await prisma.feedbackMetric.upsert({
        where: { key: CLIENT_THREAD_CACHE_QUERY_METRIC_KEY },
        create: {
          key: CLIENT_THREAD_CACHE_QUERY_METRIC_KEY,
          total: BigInt(batchSize),
        },
        update: {
          total: { increment: BigInt(batchSize) },
        },
      });
      current.persistedTotal = metric.total;
      current.lastPersistedAt = metric.updatedAt;
    } catch (error) {
      current.pendingCount += batchSize;
      console.error("Failed to persist feedback cache query count", {
        batchSize,
        error: error instanceof Error ? error.message : undefined,
      });
    } finally {
      current.flushingCount = 0;
      current.flushPromise = null;
    }
  })();

  return current.flushPromise;
}

export async function recordFeedbackClientCacheQuery() {
  const current = state();
  current.pendingCount += 1;
  await flushPendingClientQueries();
}

export function getFeedbackCacheStatus() {
  const current = state();
  const snapshot = current.snapshot;
  const persistedClientQueryCount = Number(current.persistedTotal);
  return {
    status: current.status,
    clientQueryCount:
      persistedClientQueryCount + current.pendingCount + current.flushingCount,
    persistedClientQueryCount,
    pendingClientQueryCount: current.pendingCount,
    appCount: snapshot?.appCount ?? 0,
    threadCount: snapshot?.threadCount ?? 0,
    messageCount: snapshot?.messageCount ?? 0,
    loadedAt: snapshot?.loadedAt.toISOString() ?? null,
    lastPersistedAt: current.lastPersistedAt?.toISOString() ?? null,
    rebuilding: Boolean(current.rebuildPromise),
  };
}

export function resetFeedbackCacheForTests() {
  globalThis[GLOBAL_STATE_KEY] = createState();
}
