import { defineConfig } from "@playwright/test";

process.env.PLAYWRIGHT_RECEIPT_DISPOSABLE = "1";
process.env.E2E_BASE_URL = "http://localhost:4100";
process.env.E2E_RECEIPT_API_PORT = "4101";

/** Real paid/refunded orders in an owned PostgreSQL database; no development DB or bucket IO. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "receipt-allocation.spec.ts",
  outputDir: "./test-results/receipts",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  use: { baseURL: "http://localhost:4100", trace: "retain-on-failure", actionTimeout: 30_000 },
  webServer: {
    command: "pnpm exec next dev --port 4100",
    url: "http://localhost:4100/login",
    env: { API_URL: "http://127.0.0.1:4101", NEXT_DIST_DIR: ".next/receipts-e2e" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
