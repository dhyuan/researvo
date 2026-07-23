import { afterEach, describe, expect, it } from "vitest";

import {
  getAdminAuthVersion,
  getPushConfig,
} from "@/lib/push/pushConfig";

const ENV_KEYS = [
  "ADMIN_WEB_PUSH_ENABLED",
  "WEB_PUSH_VAPID_PUBLIC_KEY",
  "WEB_PUSH_VAPID_PRIVATE_KEY",
  "WEB_PUSH_VAPID_SUBJECT",
  "FEEDBACK_ADMIN_TOKEN",
] as const;
const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = original[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("pushConfig", () => {
  it("requires the feature flag and a valid VAPID key pair", () => {
    process.env.ADMIN_WEB_PUSH_ENABLED = "true";
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = Buffer.alloc(65, 1).toString("base64url");
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = Buffer.alloc(32, 2).toString("base64url");
    process.env.WEB_PUSH_VAPID_SUBJECT = "mailto:admin@example.com";

    expect(getPushConfig()).toEqual({
      configured: true,
      publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY,
      privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
      subject: "mailto:admin@example.com",
    });
  });

  it("derives a stable one-way admin auth version without exposing the token", () => {
    process.env.FEEDBACK_ADMIN_TOKEN = "top-secret-token";

    const version = getAdminAuthVersion();
    expect(version).toBe(getAdminAuthVersion());
    expect(version).not.toContain("top-secret-token");

    process.env.FEEDBACK_ADMIN_TOKEN = "rotated-token";
    expect(getAdminAuthVersion()).not.toBe(version);
  });
});
