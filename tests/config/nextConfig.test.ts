import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config.mjs";

describe("Next.js config", () => {
  it("allows local 127.0.0.1 development origins for HMR", () => {
    expect(nextConfig.allowedDevOrigins).toEqual(expect.arrayContaining(["127.0.0.1"]));
  });
});
