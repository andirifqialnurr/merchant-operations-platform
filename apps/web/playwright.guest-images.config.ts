import { defineConfig } from "@playwright/test";

process.env.PLAYWRIGHT_GUEST_IMAGES_DISPOSABLE = "1";
process.env.E2E_BASE_URL = "http://localhost:4100";
process.env.E2E_GUEST_IMAGES_API_PORT = "4101";

/** Own web/API/PostgreSQL and a loopback storage fixture; never touches a real bucket. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "guest-images.spec.ts",
  outputDir: "./test-results/guest-images",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  use: { baseURL: "http://localhost:4100", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm exec next dev --port 4100",
    url: "http://localhost:4100/login",
    env: { API_URL: "http://127.0.0.1:4101", NEXT_DIST_DIR: ".next/guest-images-e2e" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
