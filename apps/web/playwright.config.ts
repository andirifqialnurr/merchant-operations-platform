import { defineConfig } from "@playwright/test";

/**
 * Browser tests against a running local stack: the web app, the API, and a
 * development database with the cafe menu seed and the local accounts
 * (`pnpm db:seed:menu`, `pnpm --filter @merchant/api local:users:provision`).
 * Nothing is started here; run `pnpm dev` first.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  expect: { timeout: 30_000 },
  timeout: 180_000,
  // The tests share one cashier and one cash drawer, so they run in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4000",
    locale: "id-ID",
    trace: "retain-on-failure",
    viewport: { height: 900, width: 1440 },
  },
});
