import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const selectorPath = join(testDir, "device-mode-selector.tsx");
const homePath = join(testDir, "..", "app", "device-mode", "page.dev.tsx");
const rootPath = join(testDir, "..", "app", "page.tsx");
const appRoot = join(testDir, "..", "app");

test("device mode choices navigate to dedicated merchant surface routes", async () => {
  const source = await readFile(selectorPath, "utf8");

  assert.match(source, /href: "\/pos"/);
  assert.match(source, /href: "\/kds"/);
  assert.match(source, /href: "\/catalog"/);
  assert.match(source, /href: "\/inventory"/);
  assert.match(source, /useRouter/);
  assert.match(source, /router\.push\(item\.href\)/);
});

test("home shell exposes clickable navigation for every visible device mode", async () => {
  const source = await readFile(homePath, "utf8");

  assert.match(source, /device-home__frame/);
  assert.match(source, /href: "\/device-mode"/);
  assert.match(source, /href: "\/pos"/);
  assert.match(source, /href: "\/kds"/);
  assert.match(source, /href: "\/catalog"/);
  assert.match(source, /href: "\/inventory"/);
  assert.match(source, /href="\/design-system"/);
});

test("the root route only redirects to the backoffice", async () => {
  const source = await readFile(rootPath, "utf8");

  assert.match(source, /redirect\("\/catalog"\)/);
  assert.doesNotMatch(source, /device-home/);
});

test("POS opens the cashier surface instead of a placeholder", async () => {
  const source = await readFile(join(appRoot, "(pos)", "pos", "page.tsx"), "utf8");

  assert.match(source, /<SellPage \/>/);
  await access(join(appRoot, "(pos)", "pos", "shift", "page.tsx"));
});

test("KDS and Inventory landing routes exist without rendering internal payload fields", async () => {
  for (const route of ["kds", "inventory"]) {
    const pagePath = join(appRoot, route, "page.dev.tsx");
    await access(pagePath);
    const source = await readFile(pagePath, "utf8");

    assert.doesNotMatch(
      source,
      /tenantId|outletId|sessionId|token|paymentId|orderId|stockMovementId|audit|actor|timestamp|rawPayload/i,
    );
    assert.match(source, /membutuhkan konfirmasi\s+server/i);
  }
});
