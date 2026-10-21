import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import type { InventoryCategory } from "@merchant/contracts";

import { SetInventoryCategoryStatus } from "./set-inventory-category-status.js";
import type {
  InventoryCategoryStatusContext,
  InventoryCategoryStatusWriter,
} from "./inventory-category-status-writer.js";
import type { InventoryMasterWriteAccess } from "./inventory-master-write-access.js";
import {
  InventoryCategoryWriteError,
  type InventoryCategoryWriteCode,
} from "../domain/category-write-error.js";

function fixture() {
  const scope = { tenantId: randomUUID(), actorId: randomUUID() };
  const context: InventoryCategoryStatusContext = {
    identity: { tenantId: scope.tenantId, userId: scope.actorId, membershipId: randomUUID() },
    origin: { actorId: scope.actorId, requestId: " req-category-status " },
    idempotencyKey: " category-status-request-001 ",
  };
  const result: InventoryCategory = {
    id: "01990000-aaaa-7000-8000-000000000001",
    name: "Bahan",
    status: "INACTIVE",
  };
  const calls: unknown[] = [];
  const access: InventoryMasterWriteAccess = {
    authorize: async (identity) => {
      calls.push(["access", identity]);
      return scope;
    },
  };
  const writer: InventoryCategoryStatusWriter = {
    setStatus: async (...args) => {
      calls.push(["status", ...args]);
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
    command: new SetInventoryCategoryStatus(access, writer),
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

test("category lifecycle authorizes first and normalizes target/key/origin without taking a name input", async () => {
  const f = fixture();
  assert.deepEqual(
    await f.command.execute(f.result.id.toUpperCase(), { status: "INACTIVE" }, f.context),
    f.result,
  );
  assert.deepEqual(f.calls, [
    ["access", f.context.identity],
    [
      "status",
      f.scope,
      f.result.id,
      { status: "INACTIVE" },
      {
        idempotencyKey: "category-status-request-001",
        origin: { actorId: f.scope.actorId, channel: "API", requestId: "req-category-status" },
      },
    ],
  ]);
});

test("lifecycle access refusal precedes input validation and reaches no status writer", async () => {
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

test("lifecycle refuses invalid target/status and rename/relation/metadata fields before IO", async () => {
  const f = fixture();
  await denied(f.command.execute("bad", { status: "ACTIVE" }, f.context), "VALIDATION_ERROR");
  for (const input of [
    {},
    { status: "active" },
    { status: "ARCHIVED" },
    { status: undefined },
    { status: "INACTIVE", name: "New" },
    { status: "INACTIVE", items: [] },
    { status: "INACTIVE", tenantId: randomUUID() },
    { status: "INACTIVE", balance: "0" },
  ])
    await denied(f.command.execute(f.result.id, input, f.context), "VALIDATION_ERROR");
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("lifecycle requires a valid key and bound actor/channel/request without device origin", async () => {
  const f = fixture();
  await denied(
    f.command.execute(
      f.result.id,
      { status: "INACTIVE" },
      { ...f.context, idempotencyKey: "short" },
    ),
    "IDEMPOTENCY_KEY_REQUIRED",
  );
  for (const origin of [
    { actorId: randomUUID() },
    { actorId: f.scope.actorId, deviceId: randomUUID() },
    { actorId: f.scope.actorId, requestId: "x".repeat(101) },
    { actorId: f.scope.actorId, channel: "INVALID" as "API" },
  ])
    await denied(
      f.command.execute(f.result.id, { status: "INACTIVE" }, { ...f.context, origin }),
      "INVENTORY_COMMAND_CONTEXT_INVALID",
    );
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("lifecycle privately maps missing target and stable idempotency conflicts, not infrastructure failures", async () => {
  const codes: InventoryCategoryWriteCode[] = [
    "INVENTORY_CATEGORY_NOT_FOUND",
    "IDEMPOTENCY_KEY_REUSED",
    "IDEMPOTENCY_IN_PROGRESS",
    "IDEMPOTENCY_FAILED",
    "IDEMPOTENCY_EXPIRED",
    "IDEMPOTENCY_RESULT_UNAVAILABLE",
  ];
  for (const code of codes) {
    const f = fixture();
    f.writer.setStatus = async () => {
      throw new InventoryCategoryWriteError(code);
    };
    await denied(
      f.command.execute(f.result.id, { status: "INACTIVE" }, f.context),
      code,
      code === "INVENTORY_CATEGORY_NOT_FOUND" ? 404 : 409,
    );
  }
  const f = fixture();
  const failure = new Error("infrastructure");
  f.writer.setStatus = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute(f.result.id, { status: "INACTIVE" }, f.context),
    (error) => error === failure,
  );
});

test("lifecycle returns a strict non-financial category DTO, not ORM or cascaded item metadata", async () => {
  const f = fixture();
  f.writer.setStatus = async () => ({ ...f.result, tenantId: f.scope.tenantId });
  await assert.rejects(f.command.execute(f.result.id, { status: "INACTIVE" }, f.context));
  f.writer.setStatus = async () => ({ ...f.result, status: "ARCHIVED" as "ACTIVE" });
  await assert.rejects(f.command.execute(f.result.id, { status: "INACTIVE" }, f.context));
});
