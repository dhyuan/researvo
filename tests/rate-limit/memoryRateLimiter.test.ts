import { describe, expect, it, afterEach } from "vitest";

import {
  checkRateLimit,
  clearRateLimitBuckets,
  getRateLimitBucketCountForTest,
} from "@/lib/rate-limit/memoryRateLimiter";

describe("checkRateLimit", () => {
  afterEach(() => {
    clearRateLimitBuckets();
  });

  it("allows requests until the limit is reached", () => {
    const first = checkRateLimit("user:1", 2, 1_000, 10_000);
    const second = checkRateLimit("user:1", 2, 1_000, 10_100);
    const third = checkRateLimit("user:1", 2, 1_000, 10_200);

    expect(first).toEqual({
      ok: true,
      remaining: 1,
      resetAt: new Date(11_000),
    });
    expect(second).toEqual({
      ok: true,
      remaining: 0,
      resetAt: new Date(11_000),
    });
    expect(third).toEqual({
      ok: false,
      retryAfterSeconds: 1,
      resetAt: new Date(11_000),
    });
  });

  it("resets the bucket after the window expires", () => {
    checkRateLimit("user:1", 1, 1_000, 10_000);

    expect(checkRateLimit("user:1", 1, 1_000, 10_500)).toEqual({
      ok: false,
      retryAfterSeconds: 1,
      resetAt: new Date(11_000),
    });
    expect(checkRateLimit("user:1", 1, 1_000, 11_000)).toEqual({
      ok: true,
      remaining: 0,
      resetAt: new Date(12_000),
    });
  });

  it("throws when rate limit configuration is invalid", () => {
    const invalidConfigs = [
      { limit: 0, windowMs: 1_000 },
      { limit: Number.NaN, windowMs: 1_000 },
      { limit: Number.POSITIVE_INFINITY, windowMs: 1_000 },
      { limit: Number.NEGATIVE_INFINITY, windowMs: 1_000 },
      { limit: 1.5, windowMs: 1_000 },
      { limit: 1, windowMs: 0 },
      { limit: 1, windowMs: Number.NaN },
      { limit: 1, windowMs: Number.POSITIVE_INFINITY },
      { limit: 1, windowMs: Number.NEGATIVE_INFINITY },
      { limit: 1, windowMs: 1.5 },
    ];

    for (const { limit, windowMs } of invalidConfigs) {
      expect(() => checkRateLimit("user:1", limit, windowMs, 10_000)).toThrow(
        RangeError,
      );
    }
  });

  it("prunes expired buckets for unrelated keys on access", () => {
    checkRateLimit("expired:key", 1, 1_000, 10_000);
    expect(getRateLimitBucketCountForTest()).toBe(1);

    checkRateLimit("active:key", 1, 1_000, 11_000);

    expect(getRateLimitBucketCountForTest()).toBe(1);
  });
});
