import { describe, expect, it } from "vitest";

import { sanitizeAdminDestination } from "@/components/feedback-admin/AdminLogin";

const ORIGIN = "https://admin.example.test";

describe("admin login return destination", () => {
  it("allows relative admin routes with their query and hash", () => {
    expect(sanitizeAdminDestination("/admin/feedback?thread=feedback-1#latest", ORIGIN)).toBe(
      "/admin/feedback?thread=feedback-1#latest",
    );
  });

  it("allows absolute same-origin admin routes but returns a relative destination", () => {
    expect(
      sanitizeAdminDestination(
        "https://admin.example.test/admin/feedback?thread=feedback-2",
        ORIGIN,
      ),
    ).toBe("/admin/feedback?thread=feedback-2");
  });

  it.each([
    "https://attacker.example/admin/feedback",
    "//attacker.example/admin/feedback",
    "/workspace",
    "javascript:alert(1)",
  ])("rejects unsafe destination %s", (destination) => {
    expect(sanitizeAdminDestination(destination, ORIGIN)).toBe("/admin/feedback");
  });
});
