import { timingSafeEqual } from "node:crypto";

export const PUSH_API_MAX_BODY_BYTES = 16 * 1024;

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readLimitedJson(request: Request): Promise<
  | { ok: true; body: unknown }
  | { ok: false; error: "BODY_TOO_LARGE" | "INVALID_JSON" }
> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > PUSH_API_MAX_BODY_BYTES) {
    return { ok: false, error: "BODY_TOO_LARGE" };
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > PUSH_API_MAX_BODY_BYTES) {
    return { ok: false, error: "BODY_TOO_LARGE" };
  }

  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "INVALID_JSON" };
  }
}

export function safeSecretEqual(candidate: string | null, expected: string) {
  if (!candidate) {
    return false;
  }

  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
