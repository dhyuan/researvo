import { beforeEach, describe, expect, it, vi } from "vitest";

const isFeedbackAdminAuthorized = vi.fn();
const ensureFeedbackCacheReady = vi.fn();
const getFeedbackCacheStatus = vi.fn();
const rebuildFeedbackCache = vi.fn();

vi.mock("@/lib/feedback/adminAuth", () => ({
  isFeedbackAdminAuthorized,
}));

vi.mock("@/lib/feedback/feedbackCache", () => ({
  ensureFeedbackCacheReady,
  getFeedbackCacheStatus,
  rebuildFeedbackCache,
}));

describe("feedback cache admin APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFeedbackAdminAuthorized.mockReturnValue(true);
    ensureFeedbackCacheReady.mockResolvedValue(undefined);
  });

  it("ensures the full cache is ready and returns its status", async () => {
    getFeedbackCacheStatus.mockReturnValue({
      status: "ready",
      clientQueryCount: 137,
      persistedClientQueryCount: 100,
      pendingClientQueryCount: 37,
      appCount: 1,
      threadCount: 4,
      messageCount: 9,
      loadedAt: "2026-07-29T01:00:00.000Z",
      lastPersistedAt: "2026-07-29T00:30:00.000Z",
      rebuilding: false,
    });
    const { GET } = await import("@/app/api/admin/feedback/cache/route");

    const response = await GET(
      new Request("http://localhost/api/admin/feedback/cache"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ready",
      clientQueryCount: 137,
      threadCount: 4,
      messageCount: 9,
    });
    expect(ensureFeedbackCacheReady).toHaveBeenCalledTimes(1);
    expect(getFeedbackCacheStatus).toHaveBeenCalledTimes(1);
    expect(rebuildFeedbackCache).not.toHaveBeenCalled();
  });

  it("rejects unauthorized status and rebuild requests", async () => {
    isFeedbackAdminAuthorized.mockReturnValue(false);
    const statusRoute = await import("@/app/api/admin/feedback/cache/route");
    const rebuildRoute = await import(
      "@/app/api/internal/feedback/cache/rebuild/route"
    );

    const [statusResponse, rebuildResponse] = await Promise.all([
      statusRoute.GET(new Request("http://localhost/api/admin/feedback/cache")),
      rebuildRoute.POST(
        new Request("http://localhost/api/internal/feedback/cache/rebuild", {
          method: "POST",
        }),
      ),
    ]);

    expect(statusResponse.status).toBe(401);
    expect(rebuildResponse.status).toBe(401);
    expect(rebuildFeedbackCache).not.toHaveBeenCalled();
  });

  it("returns a bounded error when initial cache loading fails", async () => {
    ensureFeedbackCacheReady.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const { GET } = await import("@/app/api/admin/feedback/cache/route");

    const response = await GET(
      new Request("http://localhost/api/admin/feedback/cache"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "FEEDBACK_CACHE_STATUS_FAILED",
    });
    expect(getFeedbackCacheStatus).not.toHaveBeenCalled();
  });

  it("returns rebuild counts and duration", async () => {
    rebuildFeedbackCache.mockResolvedValue({
      ok: true,
      appCount: 1,
      threadCount: 4,
      messageCount: 9,
      durationMs: 27,
      rebuiltAt: "2026-07-29T02:00:00.000Z",
    });
    const { POST } = await import(
      "@/app/api/internal/feedback/cache/rebuild/route"
    );

    const response = await POST(
      new Request("http://localhost/api/internal/feedback/cache/rebuild", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      threadCount: 4,
      messageCount: 9,
      durationMs: 27,
    });
  });

  it("keeps the API contract bounded on rebuild failure", async () => {
    rebuildFeedbackCache.mockRejectedValue(new Error("database unavailable"));
    const { POST } = await import(
      "@/app/api/internal/feedback/cache/rebuild/route"
    );

    const response = await POST(
      new Request("http://localhost/api/internal/feedback/cache/rebuild", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "FEEDBACK_CACHE_REBUILD_FAILED",
    });
  });
});
