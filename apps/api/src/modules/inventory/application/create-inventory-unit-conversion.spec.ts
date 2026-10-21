import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import type { InventoryUnitConversion } from "@merchant/contracts";

import { CreateInventoryUnitConversion } from "./create-inventory-unit-conversion.js";
import type { InventoryMasterWriteAccess } from "./inventory-master-write-access.js";
import type {
  InventoryConversionCreateContext,
  InventoryConversionWriter,
} from "./inventory-conversion-writer.js";
import {
  InventoryConversionWriteError,
  type InventoryConversionWriteCode,
} from "../domain/conversion-write-error.js";

function fixture() {
  const scope = { actorId: randomUUID(), tenantId: randomUUID() };
  const context: InventoryConversionCreateContext = {
    identity: { userId: scope.actorId, tenantId: scope.tenantId, membershipId: randomUUID() },
    origin: { actorId: scope.actorId, requestId: " req-conversion " },
    idempotencyKey: " conversion-request-001 ",
  };
  const input = {
    fromUnitId: "01990000-aaaa-7000-8000-000000000001",
    toUnitId: "01990000-bbbb-7000-8000-000000000002",
    factor: "1000",
  };
  const result: InventoryUnitConversion = { id: randomUUID(), ...input };
  const calls: unknown[] = [];
  const access: InventoryMasterWriteAccess = {
    authorize: async (identity) => {
      calls.push(["access", identity]);
      return scope;
    },
  };
  const writer: InventoryConversionWriter = {
    create: async (...args) => {
      calls.push(["write", ...args]);
      return result;
    },
  };
  return {
    scope,
    context,
    input,
    result,
    calls,
    access,
    writer,
    command: new CreateInventoryUnitConversion(access, writer),
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

test("conversion create authorizes first and normalizes exact input/key/origin before atomic writer", async () => {
  const f = fixture();
  assert.deepEqual(
    await f.command.execute(
      {
        fromUnitId: f.input.fromUnitId.toUpperCase(),
        toUnitId: f.input.toUnitId.toUpperCase(),
        factor: "1000.000",
      },
      f.context,
    ),
    f.result,
  );
  assert.deepEqual(f.calls, [
    ["access", f.context.identity],
    [
      "write",
      f.scope,
      f.input,
      {
        idempotencyKey: "conversion-request-001",
        origin: { actorId: f.scope.actorId, channel: "API", requestId: "req-conversion" },
      },
    ],
  ]);
});

test("conversion denial precedes input validation and never calls writer", async () => {
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

test("conversion refuses metadata/derived inputs, invalid factor and self-pairs before IO", async () => {
  const f = fixture();
  for (const field of [
    "id",
    "tenantId",
    "outletId",
    "actorId",
    "dimension",
    "fromPrecision",
    "status",
    "convertedQuantity",
    "balance",
    "unitCostMinor",
    "reason",
    "createdAt",
  ])
    await denied(f.command.execute({ ...f.input, [field]: "1" }, f.context), "VALIDATION_ERROR");
  for (const factor of [0, "0", "-1", "1e3", "0.0000000000001", "1000000000000000000"])
    await denied(f.command.execute({ ...f.input, factor }, f.context), "VALIDATION_ERROR");
  await denied(
    f.command.execute({ ...f.input, toUnitId: f.input.fromUnitId.toUpperCase() }, f.context),
    "VALIDATION_ERROR",
  );
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("conversion requires a valid key, bound actor, valid channel/request and no device", async () => {
  const f = fixture();
  await denied(
    f.command.execute(f.input, { ...f.context, idempotencyKey: "short" }),
    "IDEMPOTENCY_KEY_REQUIRED",
  );
  for (const origin of [
    { actorId: randomUUID() },
    { actorId: f.scope.actorId, deviceId: randomUUID() },
    { actorId: f.scope.actorId, requestId: "x".repeat(101) },
    { actorId: f.scope.actorId, channel: "INVALID" as "API" },
  ])
    await denied(
      f.command.execute(f.input, { ...f.context, origin }),
      "INVENTORY_COMMAND_CONTEXT_INVALID",
    );
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("conversion maps parent absence privately and conflicts stably without relabeling infrastructure", async () => {
  const codes: InventoryConversionWriteCode[] = [
    "INVENTORY_UNIT_NOT_FOUND",
    "INVENTORY_UNIT_DIMENSIONS_INCOMPATIBLE",
    "INVENTORY_CONVERSION_PAIR_TAKEN",
    "IDEMPOTENCY_KEY_REUSED",
    "IDEMPOTENCY_IN_PROGRESS",
    "IDEMPOTENCY_FAILED",
    "IDEMPOTENCY_EXPIRED",
    "IDEMPOTENCY_RESULT_UNAVAILABLE",
  ];
  for (const code of codes) {
    const f = fixture();
    f.writer.create = async () => {
      throw new InventoryConversionWriteError(code);
    };
    await denied(
      f.command.execute(f.input, f.context),
      code,
      code === "INVENTORY_UNIT_NOT_FOUND" ? 404 : 409,
    );
  }
  const f = fixture();
  const failure = new Error("database unavailable");
  f.writer.create = async () => {
    throw failure;
  };
  await assert.rejects(f.command.execute(f.input, f.context), (error) => error === failure);
});

test("conversion output rejects leaked metadata or numeric factors from malformed ports", async () => {
  const f = fixture();
  f.writer.create = async () => ({ ...f.result, tenantId: f.scope.tenantId });
  await assert.rejects(f.command.execute(f.input, f.context));
  f.writer.create = async () => ({ ...f.result, factor: 1000 as unknown as string });
  await assert.rejects(f.command.execute(f.input, f.context));
});
