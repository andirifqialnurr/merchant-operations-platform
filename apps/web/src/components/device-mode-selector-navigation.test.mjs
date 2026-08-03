import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const selectorPath = join(testDir, "device-mode-selector.tsx");
const homePath = join(testDir, "..", "app", "page.tsx");
const appRoot = join(testDir, "..", "app");

test("device mode choices navigate to dedicated merchant surface routes", async () => {
  const source = await readFile(selectorPath, "utf8");

  assert.match(source, /href: "\/pos"/);
  assert.match(source, /href: "\/kds"/);
  assert.match(source, /href: "\/backoffice\/catalog"/);
  assert.match(source, /href: "\/inventory"/);
  assert.match(source, /useRouter/);
  assert.match(source, /router\.push\(item\.href\)/);
});

test("home shell exposes clickable navigation for every visible device mode", async () => {
  const source = await readFile(homePath, "utf8");

  assert.match(source, /device-home__frame/);
  assert.match(source, /href: "\/"/);
  assert.match(source, /href: "\/pos"/);
  assert.match(source, /href: "\/kds"/);
  assert.match(source, /href: "\/backoffice\/catalog"/);
  assert.match(source, /href: "\/inventory"/);
  assert.match(source, /href="\/design-system"/);
});

test("design system documents the three Tasty Station visual references", async () => {
  const designSystemPath = join(testDir, "..", "..", "..", "..", "design-system.md");
  const source = await readFile(designSystemPath, "utf8");

  assert.match(source, /original-851d24227b2ef442240d3c9220f4e1b4\.jpg/);
  assert.match(source, /244417cc212b87d59e51c5c36cbae7e0\.png/);
  assert.match(source, /original-0182b71e783e237945b82423885a4219\.jpg/);
});

test("POS, KDS, and Inventory landing routes exist without rendering internal payload fields", async () => {
  for (const route of ["pos", "kds", "inventory"]) {
    const pagePath = join(appRoot, route, "page.tsx");
    await access(pagePath);
    const source = await readFile(pagePath, "utf8");

    assert.doesNotMatch(
      source,
      /tenantId|outletId|sessionId|token|paymentId|orderId|stockMovementId|audit|actor|timestamp|rawPayload/i,
    );
    assert.match(source, /membutuhkan konfirmasi\s+server/i);
  }
});
