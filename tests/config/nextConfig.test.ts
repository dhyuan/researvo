import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config.mjs";

describe("Next.js config", () => {
  it("allows local 127.0.0.1 development origins for HMR", () => {
    expect(nextConfig.allowedDevOrigins).toEqual(expect.arrayContaining(["127.0.0.1"]));
  });

  it("serves the admin service worker without long-lived caching", async () => {
    const headers = await nextConfig.headers?.();
    const serviceWorker = headers?.find((entry) => entry.source === "/admin/sw.js");

    expect(serviceWorker?.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Cache-Control",
          value: expect.stringContaining("no-cache"),
        }),
        {
          key: "Service-Worker-Allowed",
          value: "/admin/",
        },
      ]),
    );
  });
});
