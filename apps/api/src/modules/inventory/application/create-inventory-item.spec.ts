import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HttpException } from "@nestjs/common";

import { CreateInventoryItem } from "./create-inventory-item.js";
import type { InventoryItemWriter } from "./inventory-item-writer.js";
import type { InventoryMasterWriteAccess } from "./inventory-master-write-access.js";
import {
  InventoryItemWriteError,
  type InventoryItemWriteCode,
} from "../domain/item-write-error.js";

const identity = { tenantId: randomUUID(), userId: randomUUID(), membershipId: randomUUID() };
const context = {
  identity,
  idempotencyKey: " item-create-key-123456 ",
  origin: { actorId: identity.userId, channel: "WEB" as const, requestId: randomUUID() },
};
const body = {
  name: " Flour ",
  baseUnitId: randomUUID().toUpperCase(),
  sku: " FL-1 ",
  minStock: "1.000000",
};
function fixture() {
  const calls: unknown[] = [];
  const access: InventoryMasterWriteAccess = {
    authorize: async (value) => {
      calls.push(["access", value]);
      return { tenantId: identity.tenantId, actorId: identity.userId };
    },
  };
  const writer: InventoryItemWriter = {
    create: async (...args) => {
      calls.push(["write", ...args]);
      return { id: randomUUID(), ...args[1], status: "ACTIVE" };
    },
  };
  return { calls, access, writer, command: new CreateInventoryItem(access, writer) };
}
async function denied(promise: Promise<unknown>, code: string, status: number) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof HttpException);
    assert.equal((error.getResponse() as { code: string }).code, code);
    assert.equal(error.getStatus(), status);
    return true;
  });
}
test("item create authorizes first then canonicalizes trimmed fields, UUID/defaults/decimal/key", async () => {
  const f = fixture();
  const result = await f.command.execute(body, context);
  assert.equal(result.name, "Flour");
  assert.equal(result.minStock, "1");
  assert.deepEqual(f.calls, [
    ["access", identity],
    [
      "write",
      { tenantId: identity.tenantId, actorId: identity.userId },
      {
        name: "Flour",
        sku: "FL-1",
        baseUnitId: body.baseUnitId.toLowerCase(),
        categoryId: null,
        minStock: "1",
      },
      { idempotencyKey: "item-create-key-123456", origin: context.origin },
    ],
  ]);
});
test("item create access refusal wins over invalid input/key without writer IO", async () => {
  const f = fixture();
  const failure = new Error("denied");
  f.access.authorize = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute({ cost: "0" }, { ...context, idempotencyKey: "" }),
    (error) => error === failure,
  );
  assert.deepEqual(f.calls, []);
});
test("invalid item body or key does not reach writer", async () => {
  const f = fixture();
  for (const patch of [
    { status: "ACTIVE" },
    { minStock: 0 },
    { sku: "" },
    { baseUnitId: null },
    { balance: "0" },
  ])
    await denied(f.command.execute({ ...body, ...patch }, context), "VALIDATION_ERROR", 400);
  await denied(
    f.command.execute(body, { ...context, idempotencyKey: "" }),
    "IDEMPOTENCY_KEY_REQUIRED",
    400,
  );
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});
test("item command rejects mismatched actor/device/channel/request origin", async () => {
  const f = fixture();
  for (const origin of [
    { ...context.origin, actorId: randomUUID() },
    { ...context.origin, deviceId: randomUUID() },
    { ...context.origin, channel: "FAKE" },
    { ...context.origin, requestId: "" },
  ])
    await denied(
      f.command.execute(body, { ...context, origin: origin as typeof context.origin }),
      "INVENTORY_COMMAND_CONTEXT_INVALID",
      400,
    );
  assert.equal(f.calls.length, 4);
});
test("item parent errors are safe 404, conflicts remain 409, infrastructure errors are not relabeled", async () => {
  const f = fixture();
  for (const code of [
    "INVENTORY_UNIT_NOT_FOUND",
    "INVENTORY_CATEGORY_NOT_FOUND",
    "INVENTORY_CATEGORY_INACTIVE",
    "INVENTORY_MINIMUM_PRECISION_EXCEEDED",
    "INVENTORY_ITEM_SKU_TAKEN",
    "IDEMPOTENCY_KEY_REUSED",
  ] as InventoryItemWriteCode[]) {
    f.writer.create = async () => {
      throw new InventoryItemWriteError(code);
    };
    await denied(f.command.execute(body, context), code, code.endsWith("NOT_FOUND") ? 404 : 409);
  }
  const failure = new Error("database unavailable");
  f.writer.create = async () => {
    throw failure;
  };
  await assert.rejects(f.command.execute(body, context), (error) => error === failure);
});
test("strict created item result excludes financial/ORM fields and rejects non-ACTIVE outputs", async () => {
  const f = fixture();
  for (const patch of [
    { cost: "0" },
    { tenantId: identity.tenantId },
    { minStock: 0 },
    { status: "INACTIVE" },
  ]) {
    f.writer.create = async (_scope, input) =>
      ({ id: randomUUID(), ...input, status: "ACTIVE", ...patch }) as Awaited<
        ReturnType<InventoryItemWriter["create"]>
      >;
    await assert.rejects(f.command.execute(body, context));
  }
});
