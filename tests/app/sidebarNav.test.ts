import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/app/SidebarNav.tsx", "utf8");

describe("SidebarNav", () => {
  it("separates primary navigation from account navigation", () => {
    expect(source).toContain("const primaryNavItems = [");
    expect(source).toContain("const accountNavItems = [");
    expect(source).toContain("border-t border-[var(--hs-border)]");
    expect(source).toContain("pt-4");
  });

  it("provides a logout action in the account area", () => {
    expect(source).toContain('import { signOut } from "next-auth/react";');
    expect(source).toContain("Log out");
    expect(source).toContain("onClick={() => signOut({ callbackUrl: \"/\" })}");
  });
});
