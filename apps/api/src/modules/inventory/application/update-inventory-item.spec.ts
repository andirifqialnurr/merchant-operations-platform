import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { inventoryItemSchema, type InventoryItem } from "@merchant/contracts";

import { UpdateInventoryItem } from "./update-inventory-item.js";
import type { InventoryItemUpdater } from "./inventory-item-updater.js";
import type { InventoryMasterWriteAccess } from "./inventory-master-write-access.js";
import {
  InventoryItemWriteError,
  type InventoryItemWriteCode,
} from "../domain/item-write-error.js";

const identity = { tenantId: randomUUID(), userId: randomUUID(), membershipId: randomUUID() };
const context = {
  identity,
  idempotencyKey: " item-update-key-123456 ",
  origin: { actorId: identity.userId, channel: "WEB" as const, requestId: randomUUID() },
};
const original: InventoryItem = {
  id: randomUUID(),
  name: "Original",
  sku: "SKU",
  categoryId: null,
  baseUnitId: randomUUID(),
  minStock: null,
  status: "INACTIVE",
};
function fixture() {
  const calls: unknown[] = [];
  const access: InventoryMasterWriteAccess = {
    authorize: async (value) => {
      calls.push(["access", value]);
      return { tenantId: identity.tenantId, actorId: identity.userId };
    },
  };
  const updater: InventoryItemUpdater = {
    update: async (...args) => {
      calls.push(["update", ...args]);
      return inventoryItemSchema.parse({ ...original, ...args[2] });
    },
  };
  return { calls, access, updater, command: new UpdateInventoryItem(access, updater) };
}
async function denied(promise: Promise<unknown>, code: string, status: number) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof HttpException);
    assert.equal((error.getResponse() as { code: string }).code, code);
    assert.equal(error.getStatus(), status);
    return true;
  });
}
test("item edit authorizes first, canonicalizes target/defined patch/key and preserves NULL vs absence", async () => {
  const f = fixture();
  const group = randomUUID();
  const result = await f.command.execute(
    original.id.toUpperCase(),
    { name: " New ", sku: null, categoryId: group.toUpperCase(), minStock: "1.000000" },
    context,
  );
  assert.equal(result.status, "INACTIVE");
  assert.deepEqual(f.calls, [
    ["access", identity],
    [
      "update",
      { tenantId: identity.tenantId, actorId: identity.userId },
      original.id,
      { name: "New", sku: null, categoryId: group, minStock: "1" },
      { idempotencyKey: "item-update-key-123456", origin: context.origin },
    ],
  ]);
});
test("item edit denied access wins over malformed target/body/key and reaches no updater", async () => {
  const f = fixture();
  const failure = new Error("denied");
  f.access.authorize = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute("bad", { status: "ACTIVE" }, { ...context, idempotencyKey: "" }),
    (error) => error === failure,
  );
  assert.deepEqual(f.calls, []);
});
test("invalid patch/base-unit/status/target/key never reaches item persistence", async () => {
  const f = fixture();
  for (const patch of [
    {},
    { sku: undefined },
    { status: "ACTIVE" },
    { baseUnitId: original.baseUnitId },
    { minStock: 0 },
    { sku: "" },
    { balance: "0" },
  ])
    await denied(f.command.execute(original.id, patch, context), "VALIDATION_ERROR", 400);
  await denied(f.command.execute("bad", { name: "New" }, context), "VALIDATION_ERROR", 400);
  await denied(
    f.command.execute(original.id, { name: "New" }, { ...context, idempotencyKey: "" }),
    "IDEMPOTENCY_KEY_REQUIRED",
    400,
  );
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});
test("item update rejects actor/device/channel/request mismatch before writer IO", async () => {
  const f = fixture();
  for (const origin of [
    { ...context.origin, actorId: randomUUID() },
    { ...context.origin, deviceId: randomUUID() },
    { ...context.origin, channel: "FAKE" },
    { ...context.origin, requestId: "" },
  ])
    await denied(
      f.command.execute(
        original.id,
        { name: "New" },
        { ...context, origin: origin as typeof context.origin },
      ),
      "INVENTORY_COMMAND_CONTEXT_INVALID",
      400,
    );
  assert.equal(f.calls.length, 4);
});
test("item/parent absence is neutral 404, definition/idempotency conflicts stay 409 and infrastructure errors propagate", async () => {
  const f = fixture();
  for (const code of [
    "INVENTORY_ITEM_NOT_FOUND",
    "INVENTORY_UNIT_NOT_FOUND",
    "INVENTORY_CATEGORY_NOT_FOUND",
    "INVENTORY_CATEGORY_INACTIVE",
    "INVENTORY_MINIMUM_PRECISION_EXCEEDED",
    "INVENTORY_ITEM_SKU_TAKEN",
    "IDEMPOTENCY_RESULT_UNAVAILABLE",
  ] as InventoryItemWriteCode[]) {
    f.updater.update = async () => {
      throw new InventoryItemWriteError(code);
    };
    await denied(
      f.command.execute(original.id, { name: "New" }, context),
      code,
      code.endsWith("NOT_FOUND") ? 404 : 409,
    );
  }
  const failure = new Error("database unavailable");
  f.updater.update = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute(original.id, { name: "New" }, context),
    (error) => error === failure,
  );
});
test("strict edited item response rejects financial/ORM fields and invalid nullable/quantity/status facts", async () => {
  const f = fixture();
  for (const patch of [
    { cost: "0" },
    { tenantId: identity.tenantId },
    { minStock: 0 },
    { sku: undefined },
    { status: "ARCHIVED" },
  ]) {
    f.updater.update = async () => ({ ...original, ...patch }) as InventoryItem;
    await assert.rejects(f.command.execute(original.id, { name: "New" }, context));
  }
});
