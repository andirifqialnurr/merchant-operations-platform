import { defineConfig } from "@playwright/test";

process.env.PLAYWRIGHT_KDS_DISPOSABLE = "1";

/**
 * KDS acceptance runs its own disposable PostgreSQL/API fixture (port 4001
 * must be free). It reuses/starts only the web app, never the developer API
 * or worker. Requires DATABASE_URL or TEST_DATABASE_ADMIN_URL in root .env.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "kds.spec.ts",
  outputDir: "./test-results/kds",
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4000",
    locale: "id-ID",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  webServer: {
    command: "pnpm dev",
    url: `${process.env.E2E_BASE_URL ?? "http://localhost:4000"}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
