import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/app/AppShell.tsx", "utf8");

describe("AppShell brand header", () => {
  it("positions Researvo as an agent-ready survey system", () => {
    expect(source).toContain("Agent-native survey operations");
    expect(source).toContain("Available not only for humans, but also for AI agents.");
    expect(source).not.toContain("MCP");
    expect(source).toContain("Human workspace");
    expect(source).toContain("Agent operable");
    expect(source).toContain("Research output");
    expect(source).toContain("rounded-full");
  });
});
