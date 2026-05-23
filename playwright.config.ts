import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    env: {
      AUTH_TEST_USER_EMAIL: "e2e-publisher@humansignal.dev",
      AUTH_TRUST_TEST_USER: "true",
    },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
  },
});
