type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: Date }
  | { ok: false; retryAfterSeconds: number; resetAt: Date };

function validateRateLimitConfig(limit: number, windowMs: number) {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new RangeError("Rate limit must be a finite positive integer");
  }

  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new RangeError("Rate limit window must be a finite positive integer");
  }
}

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  validateRateLimitConfig(limit, windowMs);
  pruneExpiredBuckets(now);

  const existingBucket = buckets.get(key);
  const bucket =
    !existingBucket || existingBucket.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existingBucket;

  buckets.set(key, bucket);

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1_000),
      resetAt: new Date(bucket.resetAt),
    };
  }

  bucket.count += 1;

  return {
    ok: true,
    remaining: limit - bucket.count,
    resetAt: new Date(bucket.resetAt),
  };
}

export function clearRateLimitBuckets() {
  buckets.clear();
}

export function getRateLimitBucketCountForTest() {
  return buckets.size;
}
