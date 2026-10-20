import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import type { InventoryUnit } from "@merchant/contracts";

import { CreateInventoryUnit } from "./create-inventory-unit.js";
import type { InventoryMasterWriteAccess } from "./inventory-master-write-access.js";
import type { InventoryUnitCreateContext, InventoryUnitWriter } from "./inventory-unit-writer.js";
import {
  InventoryUnitWriteError,
  type InventoryUnitWriteCode,
} from "../domain/unit-write-error.js";

function fixture() {
  const actorId = randomUUID();
  const tenantId = randomUUID();
  const context: InventoryUnitCreateContext = {
    identity: { userId: actorId, tenantId, membershipId: randomUUID() },
    origin: { actorId, requestId: " req-unit " },
    idempotencyKey: " unit-request-00001 ",
  };
  const result: InventoryUnit = { id: randomUUID(), code: "g", name: "Gram", precision: 6 };
  const calls: unknown[] = [];
  const access: InventoryMasterWriteAccess = {
    authorize: async (identity) => {
      calls.push(["access", identity]);
      return { actorId, tenantId };
    },
  };
  const writer: InventoryUnitWriter = {
    create: async (...args) => {
      calls.push(["write", ...args]);
      return result;
    },
  };
  return {
    actorId,
    tenantId,
    context,
    result,
    calls,
    access,
    writer,
    command: new CreateInventoryUnit(access, writer),
  };
}
async function denied(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof HttpException);
    const response = error.getResponse();
    assert.ok(typeof response === "object" && "code" in response);
    assert.equal(response.code, code);
    return true;
  });
}

test("unit create authorizes first, normalizes owned fields and binds origin before calling the atomic writer", async () => {
  const f = fixture();
  assert.deepEqual(
    await f.command.execute({ code: " g ", name: " Gram ", precision: 6 }, f.context),
    f.result,
  );
  assert.deepEqual(f.calls, [
    ["access", f.context.identity],
    [
      "write",
      { actorId: f.actorId, tenantId: f.tenantId },
      { code: "g", name: "Gram", precision: 6 },
      {
        idempotencyKey: "unit-request-00001",
        origin: { actorId: f.actorId, channel: "API", requestId: "req-unit" },
      },
    ],
  ]);
});

test("denied access never invokes a writer or exposes body/key validation", async () => {
  const f = fixture();
  const error = new Error("denied");
  f.access.authorize = async () => {
    throw error;
  };
  await assert.rejects(
    f.command.execute({ precision: 99 }, { ...f.context, idempotencyKey: "bad" }),
    (found) => found === error,
  );
  assert.deepEqual(f.calls, []);
});

test("strict unit action refuses identifiers, scope, audit, stock and derived fields before mutation", async () => {
  const f = fixture();
  for (const field of [
    "id",
    "tenantId",
    "outletId",
    "actorId",
    "createdAt",
    "balance",
    "unitCostMinor",
    "minStock",
    "status",
    "definitionLocked",
    "reason",
  ]) {
    await denied(
      f.command.execute({ code: "g", name: "Gram", precision: 6, [field]: "1" }, f.context),
      "VALIDATION_ERROR",
    );
  }
  for (const precision of [-1, 7, "6", 1.5, NaN])
    await denied(
      f.command.execute({ code: "g", name: "Gram", precision }, f.context),
      "VALIDATION_ERROR",
    );
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("a valid key and consistent server origin are mandatory, not body metadata", async () => {
  const f = fixture();
  const input = { code: "g", name: "Gram", precision: 6 };
  await denied(
    f.command.execute(input, { ...f.context, idempotencyKey: "short" }),
    "IDEMPOTENCY_KEY_REQUIRED",
  );
  for (const origin of [
    { actorId: randomUUID() },
    { actorId: f.actorId, deviceId: randomUUID() },
    { actorId: f.actorId, requestId: "x".repeat(101) },
  ]) {
    await denied(
      f.command.execute(input, { ...f.context, origin }),
      "INVENTORY_COMMAND_CONTEXT_INVALID",
    );
  }
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("repository conflicts have stable neutral error codes; infrastructure failures are not relabeled as duplicates", async () => {
  const codes: InventoryUnitWriteCode[] = [
    "INVENTORY_UNIT_CODE_TAKEN",
    "IDEMPOTENCY_KEY_REUSED",
    "IDEMPOTENCY_IN_PROGRESS",
    "IDEMPOTENCY_FAILED",
    "IDEMPOTENCY_EXPIRED",
    "IDEMPOTENCY_RESULT_UNAVAILABLE",
  ];
  for (const code of codes) {
    const f = fixture();
    f.writer.create = async () => {
      throw new InventoryUnitWriteError(code);
    };
    await denied(f.command.execute({ code: "g", name: "Gram", precision: 6 }, f.context), code);
  }
  const f = fixture();
  const failure = new Error("infrastructure");
  f.writer.create = async () => {
    throw failure;
  };
  await assert.rejects(
    f.command.execute({ code: "g", name: "Gram", precision: 6 }, f.context),
    (error) => error === failure,
  );
});

test("unit command output cannot leak ORM metadata even from a malformed port implementation", async () => {
  const f = fixture();
  const leaked = { ...f.result, definitionLocked: false };
  f.writer.create = async () => leaked;
  await assert.rejects(f.command.execute({ code: "g", name: "Gram", precision: 6 }, f.context));
});
