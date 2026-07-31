import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const selectorPath = join(testDir, "device-mode-selector.tsx");

test("device mode selector supports the four Version 1 merchant device modes", async () => {
  const source = await readFile(selectorPath, "utf8");

  assert.match(source, /merchant-device-mode-v1/);
  assert.match(source, /"POS"/);
  assert.match(source, /"KDS"/);
  assert.match(source, /"BACKOFFICE"/);
  assert.match(source, /"INVENTORY"/);
  assert.match(source, /localStorage/);
  assert.match(source, /merchant-device-mode-change/);
});

test("device mode selector does not render registry or operational payload fields", async () => {
  const source = await readFile(selectorPath, "utf8");

  assert.doesNotMatch(source, /deviceId|tenantId|outletId|sessionId|token|audit|actor|timestamp/i);
  assert.doesNotMatch(source, /paymentId|orderId|stockMovementId|rawPayload/i);
});
