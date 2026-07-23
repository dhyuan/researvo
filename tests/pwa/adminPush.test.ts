import { describe, expect, it } from "vitest";

import { base64UrlToUint8Array, isIosDevice } from "@/lib/pwa/adminPush";

describe("admin push browser helpers", () => {
  it("decodes an unpadded URL-safe VAPID public key", () => {
    expect(Array.from(base64UrlToUint8Array("AQID-v8"))).toEqual([1, 2, 3, 250, 255]);
  });

  it("recognizes iPhone, iPad and touch-capable iPad desktop mode", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone)", "iPhone", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh)", "MacIntel", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh)", "MacIntel", 0)).toBe(false);
  });
});
