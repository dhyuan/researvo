import { describe, expect, it } from "vitest";

import {
  base64UrlToUint8Array,
  getAdminPushCapability,
  isIosDevice,
} from "@/lib/pwa/adminPush";

describe("admin push browser helpers", () => {
  it("decodes an unpadded URL-safe VAPID public key", () => {
    expect(Array.from(base64UrlToUint8Array("AQID-v8"))).toEqual([1, 2, 3, 250, 255]);
  });

  it("recognizes iPhone, iPad and touch-capable iPad desktop mode", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone)", "iPhone", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh)", "MacIntel", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh)", "MacIntel", 0)).toBe(false);
  });

  it("shows the install guide before checking unavailable iOS tab Push APIs", () => {
    expect(
      getAdminPushCapability({
        secureContext: true,
        ios: true,
        standalone: false,
        serviceWorker: true,
        pushManager: false,
        notifications: true,
      }),
    ).toBe("ios-install-required");
  });

  it("checks Push APIs after an iOS web app is opened from the home screen", () => {
    expect(
      getAdminPushCapability({
        secureContext: true,
        ios: true,
        standalone: true,
        serviceWorker: true,
        pushManager: true,
        notifications: true,
      }),
    ).toBe("supported");
  });
});
