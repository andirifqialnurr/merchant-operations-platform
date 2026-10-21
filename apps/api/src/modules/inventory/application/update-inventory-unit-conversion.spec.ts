import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import type { InventoryUnitConversion } from "@merchant/contracts";

import { UpdateInventoryUnitConversion } from "./update-inventory-unit-conversion.js";
import type { InventoryMasterWriteAccess } from "./inventory-master-write-access.js";
import type {
  InventoryConversionUpdateContext,
  InventoryConversionUpdater,
} from "./inventory-conversion-updater.js";
import {
  InventoryConversionWriteError,
  type InventoryConversionWriteCode,
} from "../domain/conversion-write-error.js";

function fixture() {
  const scope = { tenantId: randomUUID(), actorId: randomUUID() };
  const context: InventoryConversionUpdateContext = {
    identity: { tenantId: scope.tenantId, userId: scope.actorId, membershipId: randomUUID() },
    origin: { actorId: scope.actorId, requestId: " req-factor " },
    idempotencyKey: " factor-update-request-001 ",
  };
  const result: InventoryUnitConversion = {
    id: "01990000-aaaa-7000-8000-000000000001",
    fromUnitId: randomUUID(),
    toUnitId: randomUUID(),
    factor: "10",
  };
  const calls: unknown[] = [];
  const access: InventoryMasterWriteAccess = {
    authorize: async (identity) => {
      calls.push(["access", identity]);
      return scope;
    },
  };
  const updater: InventoryConversionUpdater = {
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
    command: new UpdateInventoryUnitConversion(access, updater),
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

test("factor update authorizes before IO and normalizes target/factor/key/origin", async () => {
  const f = fixture();
  assert.deepEqual(
    await f.command.execute(f.result.id.toUpperCase(), { factor: "10.0000" }, f.context),
    f.result,
  );
  assert.deepEqual(f.calls, [
    ["access", f.context.identity],
    [
      "update",
      f.scope,
      f.result.id,
      { factor: "10" },
      {
        idempotencyKey: "factor-update-request-001",
        origin: { actorId: f.scope.actorId, channel: "API", requestId: "req-factor" },
      },
    ],
  ]);
});

test("factor update access refusal precedes target/body validation and persistence", async () => {
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

test("factor update refuses invalid targets/factors and immutable pair or metadata fields before IO", async () => {
  const f = fixture();
  await denied(f.command.execute("g", { factor: "1" }, f.context), "VALIDATION_ERROR");
  for (const input of [
    {},
    { factor: undefined },
    { factor: 1 },
    { factor: "0" },
    { factor: "1e3" },
    { factor: "1", fromUnitId: randomUUID() },
    { factor: "1", toUnitId: randomUUID() },
    { factor: "1", dimension: "MASS" },
    { factor: "1", balance: "0" },
  ])
    await denied(f.command.execute(f.result.id, input, f.context), "VALIDATION_ERROR");
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("factor update requires a valid key, bound actor/channel/request and no device origin", async () => {
  const f = fixture();
  await denied(
    f.command.execute(f.result.id, { factor: "10" }, { ...f.context, idempotencyKey: "short" }),
    "IDEMPOTENCY_KEY_REQUIRED",
  );
  for (const origin of [
    { actorId: randomUUID() },
    { actorId: f.scope.actorId, deviceId: randomUUID() },
    { actorId: f.scope.actorId, requestId: "x".repeat(101) },
    { actorId: f.scope.actorId, channel: "INVALID" as "API" },
  ])
    await denied(
      f.command.execute(f.result.id, { factor: "10" }, { ...f.context, origin }),
      "INVENTORY_COMMAND_CONTEXT_INVALID",
    );
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("factor update maps private absence and conflicts without relabeling infrastructure", async () => {
  const codes: InventoryConversionWriteCode[] = [
    "INVENTORY_CONVERSION_NOT_FOUND",
    "INVENTORY_UNIT_DIMENSIONS_INCOMPATIBLE",
    "IDEMPOTENCY_KEY_REUSED",
    "IDEMPOTENCY_IN_PROGRESS",
    "IDEMPOTENCY_FAILED",
    "IDEMPOTENCY_EXPIRED",
    "IDEMPOTENCY_RESULT_UNAVAILABLE",
  ];
  for (const code of codes) {
    const f = fixture();
    f.updater.update = async () => {
      throw new InventoryConversionWriteError(code);
    };
    await denied(
      f.command.execute(f.result.id, { factor: "10" }, f.context),
      code,
      code === "INVENTORY_CONVERSION_NOT_FOUND" ? 404 : 409,
    );
  }
  const f = fixture();
  const failure = new Error("database unavailable");
  f.updater.update = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute(f.result.id, { factor: "10" }, f.context),
    (error) => error === failure,
  );
});

test("factor update result is strict and cannot expose ORM metadata or numeric factor", async () => {
  const f = fixture();
  f.updater.update = async () => ({ ...f.result, tenantId: f.scope.tenantId });
  await assert.rejects(f.command.execute(f.result.id, { factor: "10" }, f.context));
  f.updater.update = async () => ({ ...f.result, factor: 10 as unknown as string });
  await assert.rejects(f.command.execute(f.result.id, { factor: "10" }, f.context));
});
