import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import type { InventoryUnit } from "@merchant/contracts";

import { UpdateInventoryUnit } from "./update-inventory-unit.js";
import type { InventoryMasterWriteAccess } from "./inventory-master-write-access.js";
import type { InventoryUnitUpdateContext, InventoryUnitUpdater } from "./inventory-unit-updater.js";
import {
  InventoryUnitWriteError,
  type InventoryUnitWriteCode,
} from "../domain/unit-write-error.js";

function fixture() {
  const scope = { tenantId: randomUUID(), actorId: randomUUID() };
  const context: InventoryUnitUpdateContext = {
    identity: { tenantId: scope.tenantId, userId: scope.actorId, membershipId: randomUUID() },
    origin: { actorId: scope.actorId, requestId: " req-update " },
    idempotencyKey: " unit-update-request-001 ",
  };
  const result: InventoryUnit = {
    id: "01990000-aaaa-7000-8000-000000000001",
    code: "g",
    name: "Grams",
    precision: 6,
    dimension: "MASS",
  };
  const calls: unknown[] = [];
  const access: InventoryMasterWriteAccess = {
    authorize: async (identity) => {
      calls.push(["access", identity]);
      return scope;
    },
  };
  const updater: InventoryUnitUpdater = {
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
    command: new UpdateInventoryUnit(access, updater),
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

test("unit update authorizes before IO and normalizes target/partial body/key/origin", async () => {
  const f = fixture();
  assert.deepEqual(
    await f.command.execute(f.result.id.toUpperCase(), { name: " Grams " }, f.context),
    f.result,
  );
  assert.deepEqual(f.calls, [
    ["access", f.context.identity],
    [
      "update",
      f.scope,
      f.result.id,
      { name: "Grams" },
      {
        idempotencyKey: "unit-update-request-001",
        origin: { actorId: f.scope.actorId, channel: "API", requestId: "req-update" },
      },
    ],
  ]);
});

test("unit update denied access does not reveal target/body validation or invoke updater", async () => {
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

test("unit update rejects invalid target/patch and hidden fields before persistence", async () => {
  const f = fixture();
  await denied(f.command.execute("g", { name: "Grams" }, f.context), "VALIDATION_ERROR");
  for (const input of [
    {},
    { code: undefined },
    { precision: 7 },
    { name: " " },
    { name: "Grams", dimension: "MASS" },
    { name: "Grams", definitionLocked: false },
    { id: f.result.id, name: "Grams" },
    { balance: "0" },
  ])
    await denied(f.command.execute(f.result.id, input, f.context), "VALIDATION_ERROR");
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("unit update requires key, bound actor, valid channel/request and no device origin", async () => {
  const f = fixture();
  await denied(
    f.command.execute(f.result.id, { name: "Grams" }, { ...f.context, idempotencyKey: "short" }),
    "IDEMPOTENCY_KEY_REQUIRED",
  );
  for (const origin of [
    { actorId: randomUUID() },
    { actorId: f.scope.actorId, deviceId: randomUUID() },
    { actorId: f.scope.actorId, requestId: "x".repeat(101) },
    { actorId: f.scope.actorId, channel: "INVALID" as "API" },
  ])
    await denied(
      f.command.execute(f.result.id, { name: "Grams" }, { ...f.context, origin }),
      "INVENTORY_COMMAND_CONTEXT_INVALID",
    );
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("unit update privately maps missing targets and conflicts without relabeling infrastructure", async () => {
  const codes: InventoryUnitWriteCode[] = [
    "INVENTORY_UNIT_NOT_FOUND",
    "INVENTORY_UNIT_CODE_TAKEN",
    "INVENTORY_UNIT_DEFINITION_LOCKED",
    "IDEMPOTENCY_KEY_REUSED",
    "IDEMPOTENCY_IN_PROGRESS",
    "IDEMPOTENCY_FAILED",
    "IDEMPOTENCY_EXPIRED",
    "IDEMPOTENCY_RESULT_UNAVAILABLE",
  ];
  for (const code of codes) {
    const f = fixture();
    f.updater.update = async () => {
      throw new InventoryUnitWriteError(code);
    };
    await denied(
      f.command.execute(f.result.id, { name: "Grams" }, f.context),
      code,
      code === "INVENTORY_UNIT_NOT_FOUND" ? 404 : 409,
    );
  }
  const f = fixture();
  const failure = new Error("infrastructure");
  f.updater.update = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute(f.result.id, { name: "Grams" }, f.context),
    (error) => error === failure,
  );
});

test("unit update output is a strict DTO, including unknown legacy dimension but excluding latch", async () => {
  const f = fixture();
  f.updater.update = async () => ({ ...f.result, dimension: null });
  assert.equal(
    (await f.command.execute(f.result.id, { name: "Grams" }, f.context)).dimension,
    null,
  );
  f.updater.update = async () => ({ ...f.result, definitionLocked: true });
  await assert.rejects(f.command.execute(f.result.id, { name: "Grams" }, f.context));
});
