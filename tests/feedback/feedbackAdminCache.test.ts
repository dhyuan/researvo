import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/feedback-admin/FeedbackInboxClient.tsx", "utf8");

describe("feedback admin cache controls", () => {
  it("loads and renders the cache status contract", () => {
    expect(source).toContain('fetch("/api/admin/feedback/cache", { cache: "no-store" })');
    expect(source).toContain('aria-label="反馈缓存状态"');
    expect(source).toContain("已累计客户端查询");
    expect(source).toContain("查询客户端");
    expect(source).toContain("cacheStatus.uniqueClientCount");
    expect(source).toContain("cacheStatus.threadCount");
    expect(source).toContain("cacheStatus.messageCount");
    expect(source).toContain("cacheStatus.loadedAt");
    expect(source).toContain("cacheStatus.lastPersistedAt");
  });

  it("keeps loading and error states separate from inbox data", () => {
    expect(source).toContain("loadingCacheStatus && !cacheStatus");
    expect(source).toContain("缓存状态暂时无法读取。");
    expect(source).toContain("setCacheStatusError");
    expect(source).not.toContain('setItems([]);\n      setCacheStatusError');
    expect(source).not.toContain('setDetail(null);\n      setCacheStatusError');
  });

  it("requires confirmation before requesting a rebuild", () => {
    const confirmPosition = source.indexOf("window.confirm(");
    const rebuildRequestPosition = source.indexOf(
      'fetch("/api/internal/feedback/cache/rebuild"',
    );

    expect(confirmPosition).toBeGreaterThan(-1);
    expect(rebuildRequestPosition).toBeGreaterThan(confirmPosition);
    expect(source).toContain("if (!confirmed) return;");
    expect(source).toContain('method: "POST"');
  });

  it("refreshes cache status, inbox, and selected detail after a rebuild", () => {
    expect(source).toContain(
      "await Promise.all([loadCacheStatus(), loadInbox(), loadDetail()]);",
    );
    expect(source).toContain("缓存重建完成：");
    expect(source).toContain("result.threadCount");
    expect(source).toContain("result.messageCount");
    expect(source).toContain("result.durationMs");
  });

  it("disables duplicate rebuilds and preserves the current UI on failure", () => {
    expect(source).toContain("if (rebuildingCache) return;");
    expect(source).toContain("disabled={rebuildingCache || cacheStatus?.rebuilding}");
    expect(source).toContain("缓存重建失败，当前缓存和页面数据已保留。");
  });

  it("redirects to login when either cache endpoint returns 401", () => {
    expect(source.match(/response\.status === 401/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source).toContain("redirectToLogin();");
  });

  it("refreshes cache status with manual and visibility-triggered refreshes", () => {
    expect(source).toContain(
      "void Promise.all([loadInbox(), loadDetail(), loadCacheStatus()]);",
    );
    expect(source).toContain('document.addEventListener("visibilitychange", handleVisibilityChange)');
  });
});
