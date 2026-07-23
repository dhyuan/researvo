import { createHmac, timingSafeEqual } from "node:crypto";

export const FEEDBACK_ADMIN_COOKIE = "researvo_feedback_admin";

const SESSION_CONTEXT = "researvo-feedback-admin-session-v1";

function configuredAdminToken() {
  return process.env.FEEDBACK_ADMIN_TOKEN ?? process.env.ADMIN_AUTH ?? null;
}

function sessionValue(token: string) {
  return createHmac("sha256", token).update(SESSION_CONTEXT).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

export function isFeedbackAdminConfigured() {
  return Boolean(configuredAdminToken());
}

export function verifyFeedbackAdminToken(candidate: string) {
  const configured = configuredAdminToken();
  return Boolean(configured && safeEqual(candidate, configured));
}

export function createFeedbackAdminSession() {
  const configured = configuredAdminToken();
  return configured ? sessionValue(configured) : null;
}

export function isFeedbackAdminAuthorized(request: Request) {
  const configured = configuredAdminToken();

  if (!configured) {
    return process.env.NODE_ENV === "test";
  }

  const authorization = request.headers.get("authorization");
  if (
    authorization?.startsWith("Bearer ") &&
    safeEqual(authorization.slice("Bearer ".length), configured)
  ) {
    return true;
  }

  const session = cookieValue(request, FEEDBACK_ADMIN_COOKIE);
  return Boolean(session && safeEqual(session, sessionValue(configured)));
}
