import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import type { InventoryCategory } from "@merchant/contracts";

import { UpdateInventoryCategory } from "./update-inventory-category.js";
import type {
  InventoryCategoryUpdateContext,
  InventoryCategoryUpdater,
} from "./inventory-category-updater.js";
import type { InventoryMasterWriteAccess } from "./inventory-master-write-access.js";
import {
  InventoryCategoryWriteError,
  type InventoryCategoryWriteCode,
} from "../domain/category-write-error.js";

function fixture() {
  const scope = { tenantId: randomUUID(), actorId: randomUUID() };
  const context: InventoryCategoryUpdateContext = {
    identity: { tenantId: scope.tenantId, userId: scope.actorId, membershipId: randomUUID() },
    origin: { actorId: scope.actorId, requestId: " req-category-update " },
    idempotencyKey: " category-update-request-001 ",
  };
  const result: InventoryCategory = {
    id: "01990000-aaaa-7000-8000-000000000001",
    name: "Renamed",
    status: "INACTIVE",
  };
  const calls: unknown[] = [];
  const access: InventoryMasterWriteAccess = {
    authorize: async (identity) => {
      calls.push(["access", identity]);
      return scope;
    },
  };
  const updater: InventoryCategoryUpdater = {
    update: async (...args) => {
      calls.push(["update", ...args]);
      return result;
    },
  };
  return {
    scope,
    context,
    result,
    calls,
    access,
    updater,
    command: new UpdateInventoryCategory(access, updater),
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

test("category rename authorizes first and normalizes target/name/key/origin without choosing status", async () => {
  const f = fixture();
  assert.deepEqual(
    await f.command.execute(f.result.id.toUpperCase(), { name: " Renamed " }, f.context),
    f.result,
  );
  assert.deepEqual(f.calls, [
    ["access", f.context.identity],
    [
      "update",
      f.scope,
      f.result.id,
      { name: "Renamed" },
      {
        idempotencyKey: "category-update-request-001",
        origin: { actorId: f.scope.actorId, channel: "API", requestId: "req-category-update" },
      },
    ],
  ]);
});

test("category rename denial precedes target/body validation and never invokes updater", async () => {
  const f = fixture();
  const failure = new Error("denied");
  f.access.authorize = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute("bad", {}, { ...f.context, idempotencyKey: "bad" }),
    (error) => error === failure,
  );
  assert.deepEqual(f.calls, []);
});

test("category rename rejects invalid target/name and immutable or lifecycle fields before IO", async () => {
  const f = fixture();
  await denied(f.command.execute("invalid", { name: "Renamed" }, f.context), "VALIDATION_ERROR");
  for (const input of [
    {},
    { name: undefined },
    { name: " " },
    { name: "x".repeat(161) },
    { name: "Renamed", status: "ACTIVE" },
    { name: "Renamed", id: f.result.id },
    { name: "Renamed", parentId: randomUUID() },
    { name: "Renamed", itemCount: 0 },
  ])
    await denied(f.command.execute(f.result.id, input, f.context), "VALIDATION_ERROR");
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("category rename requires a key and bound actor/channel/request with no device origin", async () => {
  const f = fixture();
  await denied(
    f.command.execute(f.result.id, { name: "Renamed" }, { ...f.context, idempotencyKey: "short" }),
    "IDEMPOTENCY_KEY_REQUIRED",
  );
  for (const origin of [
    { actorId: randomUUID() },
    { actorId: f.scope.actorId, deviceId: randomUUID() },
    { actorId: f.scope.actorId, requestId: "x".repeat(101) },
    { actorId: f.scope.actorId, channel: "INVALID" as "API" },
  ])
    await denied(
      f.command.execute(f.result.id, { name: "Renamed" }, { ...f.context, origin }),
      "INVENTORY_COMMAND_CONTEXT_INVALID",
    );
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("category rename privately maps missing target and stable conflicts without relabeling infrastructure", async () => {
  const codes: InventoryCategoryWriteCode[] = [
    "INVENTORY_CATEGORY_NOT_FOUND",
    "INVENTORY_CATEGORY_NAME_TAKEN",
    "IDEMPOTENCY_KEY_REUSED",
    "IDEMPOTENCY_IN_PROGRESS",
    "IDEMPOTENCY_FAILED",
    "IDEMPOTENCY_EXPIRED",
    "IDEMPOTENCY_RESULT_UNAVAILABLE",
  ];
  for (const code of codes) {
    const f = fixture();
    f.updater.update = async () => {
      throw new InventoryCategoryWriteError(code);
    };
    await denied(
      f.command.execute(f.result.id, { name: "Renamed" }, f.context),
      code,
      code === "INVENTORY_CATEGORY_NOT_FOUND" ? 404 : 409,
    );
  }
  const f = fixture();
  const failure = new Error("infrastructure");
  f.updater.update = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute(f.result.id, { name: "Renamed" }, f.context),
    (error) => error === failure,
  );
});

test("category rename returns strict authoritative ACTIVE/INACTIVE DTO without ORM or financial extras", async () => {
  const f = fixture();
  for (const status of ["ACTIVE", "INACTIVE"] as const) {
    f.updater.update = async () => ({ ...f.result, status });
    assert.equal(
      (await f.command.execute(f.result.id, { name: "Renamed" }, f.context)).status,
      status,
    );
  }
  f.updater.update = async () => ({ ...f.result, tenantId: f.scope.tenantId });
  await assert.rejects(f.command.execute(f.result.id, { name: "Renamed" }, f.context));
});
