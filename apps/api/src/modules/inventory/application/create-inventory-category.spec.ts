import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import type { InventoryCategory } from "@merchant/contracts";

import { CreateInventoryCategory } from "./create-inventory-category.js";
import type {
  InventoryCategoryCreateContext,
  InventoryCategoryWriter,
} from "./inventory-category-writer.js";
import type { InventoryMasterWriteAccess } from "./inventory-master-write-access.js";
import {
  InventoryCategoryWriteError,
  type InventoryCategoryWriteCode,
} from "../domain/category-write-error.js";

function fixture() {
  const scope = { tenantId: randomUUID(), actorId: randomUUID() };
  const context: InventoryCategoryCreateContext = {
    identity: { tenantId: scope.tenantId, userId: scope.actorId, membershipId: randomUUID() },
    origin: { actorId: scope.actorId, requestId: " req-category " },
    idempotencyKey: " category-create-request-001 ",
  };
  const result: InventoryCategory = { id: randomUUID(), name: "Bahan", status: "ACTIVE" };
  const calls: unknown[] = [];
  const access: InventoryMasterWriteAccess = {
    authorize: async (identity) => {
      calls.push(["access", identity]);
      return scope;
    },
  };
  const writer: InventoryCategoryWriter = {
    create: async (...args) => {
      calls.push(["write", ...args]);
      return result;
    },
  };
  return {
    scope,
    context,
    result,
    calls,
    access,
    writer,
    command: new CreateInventoryCategory(access, writer),
  };
}
async function denied(promise: Promise<unknown>, code: string, status = 400) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), status);
    const body = error.getResponse();
    assert.ok(typeof body === "object" && "code" in body);
    assert.equal(body.code, code);
    return true;
  });
}

test("category create authorizes first, trims name/key/origin and never supplies a client-selected status", async () => {
  const f = fixture();
  assert.deepEqual(await f.command.execute({ name: " Bahan " }, f.context), f.result);
  assert.deepEqual(f.calls, [
    ["access", f.context.identity],
    [
      "write",
      f.scope,
      { name: "Bahan" },
      {
        idempotencyKey: "category-create-request-001",
        origin: { actorId: f.scope.actorId, channel: "API", requestId: "req-category" },
      },
    ],
  ]);
});

test("category access refusal precedes body validation and writer IO", async () => {
  const f = fixture();
  const failure = new Error("denied");
  f.access.authorize = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute({}, { ...f.context, idempotencyKey: "bad" }),
    (error) => error === failure,
  );
  assert.deepEqual(f.calls, []);
});

test("category create rejects invalid names and all server/derived fields before mutation", async () => {
  const f = fixture();
  for (const name of [undefined, null, "", " ", "x".repeat(161), 0])
    await denied(f.command.execute({ name }, f.context), "VALIDATION_ERROR");
  for (const field of [
    "id",
    "status",
    "tenantId",
    "outletId",
    "actorId",
    "createdAt",
    "code",
    "slug",
    "parentId",
    "itemCount",
    "balance",
    "costMinor",
  ])
    await denied(f.command.execute({ name: "Bahan", [field]: "1" }, f.context), "VALIDATION_ERROR");
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("category create requires a key, consistent actor/channel/request and no device origin", async () => {
  const f = fixture();
  await denied(
    f.command.execute({ name: "Bahan" }, { ...f.context, idempotencyKey: "short" }),
    "IDEMPOTENCY_KEY_REQUIRED",
  );
  for (const origin of [
    { actorId: randomUUID() },
    { actorId: f.scope.actorId, deviceId: randomUUID() },
    { actorId: f.scope.actorId, requestId: "x".repeat(101) },
    { actorId: f.scope.actorId, channel: "INVALID" as "API" },
  ])
    await denied(
      f.command.execute({ name: "Bahan" }, { ...f.context, origin }),
      "INVENTORY_COMMAND_CONTEXT_INVALID",
    );
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("category name/idempotency conflicts are stable 409s, not renamed infrastructure failures", async () => {
  const codes: InventoryCategoryWriteCode[] = [
    "INVENTORY_CATEGORY_NAME_TAKEN",
    "IDEMPOTENCY_KEY_REUSED",
    "IDEMPOTENCY_IN_PROGRESS",
    "IDEMPOTENCY_FAILED",
    "IDEMPOTENCY_EXPIRED",
    "IDEMPOTENCY_RESULT_UNAVAILABLE",
  ];
  for (const code of codes) {
    const f = fixture();
    f.writer.create = async () => {
      throw new InventoryCategoryWriteError(code);
    };
    await denied(f.command.execute({ name: "Bahan" }, f.context), code, 409);
  }
  const f = fixture();
  const failure = new Error("infrastructure");
  f.writer.create = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute({ name: "Bahan" }, f.context),
    (error) => error === failure,
  );
});

test("category create result cannot leak ORM fields or masquerade as an INACTIVE initial result", async () => {
  const f = fixture();
  f.writer.create = async () => ({ ...f.result, tenantId: f.scope.tenantId });
  await assert.rejects(f.command.execute({ name: "Bahan" }, f.context));
  f.writer.create = async () => ({ ...f.result, status: "INACTIVE" });
  await assert.rejects(f.command.execute({ name: "Bahan" }, f.context));
});
