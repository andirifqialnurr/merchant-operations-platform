import { defineConfig } from "@playwright/test";

process.env.PLAYWRIGHT_FLOOR_DISPOSABLE = "1";
process.env.E2E_BASE_URL = "http://localhost:4100";
process.env.E2E_FLOOR_API_PORT = "4101";

/** Guest read-only mocks plus the staff workflow on an owned disposable API/database. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["guest-moderation.spec.ts", "floor-moderation.spec.ts"],
  outputDir: "./test-results/moderation",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  use: { baseURL: "http://localhost:4100", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm exec next dev --port 4100",
    url: "http://localhost:4100/login",
    env: { API_URL: "http://127.0.0.1:4101", NEXT_DIST_DIR: ".next/moderation-e2e" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
