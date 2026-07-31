import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const testDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(testDir, "..", "..", "..");
const serviceWorkerPath = join(webRoot, "public", "sw.js");
const registrationPath = join(testDir, "service-worker-registration.tsx");

test("application shell service worker caches only shell assets", async () => {
  const source = await readFile(serviceWorkerPath, "utf8");

  assert.match(source, /merchant-application-shell-v1/);
  assert.match(source, /"\/"/);
  assert.match(source, /"\/design-system"/);
  assert.match(source, /"\/manifest\.webmanifest"/);
  assert.match(source, /"\/merchant-pwa-icon\.svg"/);
  assert.match(source, /\/api\//);
  assert.doesNotMatch(source, /draft/i);
  assert.doesNotMatch(source, /payment/i);
  assert.doesNotMatch(source, /stock/i);
});

test("service worker registration stays non-visual and progressive", async () => {
  const source = await readFile(registrationPath, "utf8");

  assert.match(source, /return null;/);
  assert.match(source, /serviceWorker/);
  assert.match(source, /readyState/);
  assert.match(source, /https:/);
  assert.match(source, /localhost/);
});
