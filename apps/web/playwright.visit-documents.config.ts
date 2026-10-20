import { defineConfig } from "@playwright/test";

process.env.PLAYWRIGHT_VISIT_DOCUMENT_DISPOSABLE = "1";
process.env.E2E_RECEIPT_API_PORT = "4101";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "visit-document.spec.ts",
  outputDir: "./test-results/visit-documents",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  use: { baseURL: "http://localhost:4100", trace: "retain-on-failure", actionTimeout: 30_000 },
  webServer: {
    command: "pnpm exec next dev --port 4100",
    url: "http://localhost:4100/login",
    env: { API_URL: "http://127.0.0.1:4101", NEXT_DIST_DIR: ".next/visit-documents-e2e" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
