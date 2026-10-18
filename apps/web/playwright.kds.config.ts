import { defineConfig } from "@playwright/test";

process.env.PLAYWRIGHT_KDS_DISPOSABLE = "1";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:4100";
const apiPort = process.env.E2E_KDS_API_PORT ?? "4101";
process.env.E2E_BASE_URL = baseURL;
process.env.E2E_KDS_API_PORT = apiPort;

/**
 * A separate web/API pair on 4100/4101 and a disposable PostgreSQL database.
 * Never takes over the developer's 4000/4001 or shares Next's output lock.
 * Requires DATABASE_URL or TEST_DATABASE_ADMIN_URL in root .env.
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
    baseURL,
    locale: "id-ID",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  webServer: {
    command: `pnpm exec next dev --port ${new URL(baseURL).port || "4100"}`,
    url: `${baseURL}/login`,
    env: {
      API_URL: `http://127.0.0.1:${apiPort}`,
      NEXT_DIST_DIR: ".next/kds-e2e",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
