import { createHash } from "node:crypto";

const AUTH_VERSION_CONTEXT = "researvo-feedback-admin-push-auth-v1";

export type PushConfig =
  | {
      configured: true;
      publicKey: string;
      privateKey: string;
      subject: string;
    }
  | {
      configured: false;
      reason: "disabled" | "missing_vapid_config" | "invalid_vapid_config";
    };

function isBase64Url(value: string, decodedLength: number) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return false;
  }

  try {
    return Buffer.from(value, "base64url").length === decodedLength;
  } catch {
    return false;
  }
}

function isValidSubject(subject: string) {
  if (subject.startsWith("mailto:")) {
    return subject.length > "mailto:".length;
  }

  try {
    const url = new URL(subject);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getPushConfig(): PushConfig {
  if (process.env.ADMIN_WEB_PUSH_ENABLED !== "true") {
    return { configured: false, reason: "disabled" };
  }

  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return { configured: false, reason: "missing_vapid_config" };
  }

  if (
    !isBase64Url(publicKey, 65) ||
    !isBase64Url(privateKey, 32) ||
    !isValidSubject(subject)
  ) {
    return { configured: false, reason: "invalid_vapid_config" };
  }

  return { configured: true, publicKey, privateKey, subject };
}

export function getAdminAuthVersion() {
  const token = process.env.FEEDBACK_ADMIN_TOKEN ?? process.env.ADMIN_AUTH;
  if (!token) {
    return null;
  }

  return createHash("sha256")
    .update(AUTH_VERSION_CONTEXT)
    .update("\0")
    .update(token)
    .digest("base64url");
}

export function getPushDispatchSecret() {
  return process.env.PUSH_DISPATCH_SECRET ?? null;
}
