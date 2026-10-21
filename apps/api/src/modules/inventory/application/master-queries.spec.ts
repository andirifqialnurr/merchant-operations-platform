import "reflect-metadata";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { InventoryUnit, InventoryUnitConversion } from "@merchant/contracts";

import type {
  InventoryMasterReadAccess,
  InventoryReadIdentity,
} from "./inventory-master-read-access.js";
import type { InventoryMasterReader } from "./inventory-master-reader.js";
import { ReadInventoryUnitConversions } from "./read-inventory-unit-conversions.js";
import { ReadInventoryUnits } from "./read-inventory-units.js";

const identity: InventoryReadIdentity = {
  tenantId: randomUUID(),
  userId: randomUUID(),
  membershipId: randomUUID(),
};
const units: InventoryUnit[] = Array.from({ length: 3 }, (_, i) => ({
  id: randomUUID(),
  code: `u${i}`,
  name: `Unit ${i}`,
  precision: 6,
  dimension: "COUNT",
}));
const definitions: InventoryUnitConversion[] = [
  { id: randomUUID(), fromUnitId: units[0]!.id, toUnitId: units[1]!.id, factor: "0.000000000001" },
];

function fixture() {
  const trace: unknown[] = [];
  const access: InventoryMasterReadAccess = {
    authorize: async (input) => {
      trace.push(["access", input]);
      return { tenantId: identity.tenantId };
    },
  };
  const reader: InventoryMasterReader = {
    listUnits: async (scope, query) => {
      trace.push(["units", scope, query]);
      return units;
    },
    listConversions: async (scope, query) => {
      trace.push(["conversions", scope, query]);
      return definitions;
    },
  };
  return { trace, access, reader };
}

test("unit query authorizes before reading and derives keyset metadata from only the bounded page", async () => {
  const f = fixture();
  const result = await new ReadInventoryUnits(f.access, f.reader).execute({ limit: "2" }, identity);
  assert.deepEqual(f.trace, [
    ["access", identity],
    ["units", { tenantId: identity.tenantId }, { limit: 2 }],
  ]);
  assert.deepEqual(result, {
    items: units.slice(0, 2),
    pageInfo: { hasNextPage: true, nextCursor: units[1]!.id },
  });
});

test("conversion query forwards exact unit/cursor filters without deriving a quantity or inverse", async () => {
  const f = fixture();
  const query = { fromUnitId: units[0]!.id, toUnitId: units[1]!.id, cursor: randomUUID() };
  const result = await new ReadInventoryUnitConversions(f.access, f.reader).execute(
    query,
    identity,
  );
  assert.deepEqual(f.trace[1], [
    "conversions",
    { tenantId: identity.tenantId },
    { ...query, limit: 25 },
  ]);
  assert.deepEqual(result, {
    items: definitions,
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
});

test("denied access reads no master and is not masked by invalid input", async () => {
  const f = fixture();
  const refusal = new Error("denied");
  f.access.authorize = async () => {
    throw refusal;
  };
  await assert.rejects(
    new ReadInventoryUnits(f.access, f.reader).execute({ limit: 0 }, identity),
    (error) => error === refusal,
  );
  await assert.rejects(
    new ReadInventoryUnitConversions(f.access, f.reader).execute({}, identity),
    (error) => error === refusal,
  );
  assert.deepEqual(f.trace, []);
});

test("strict query validation rejects scope/derived input before master IO", async () => {
  const f = fixture();
  for (const input of [
    { tenantId: randomUUID() },
    { outletId: randomUUID() },
    { balance: "0" },
    { limit: 101 },
    { fromUnitId: units[0]!.id },
  ]) {
    await assert.rejects(new ReadInventoryUnits(f.access, f.reader).execute(input, identity));
  }
  await assert.rejects(
    new ReadInventoryUnitConversions(f.access, f.reader).execute({ factor: "1" }, identity),
  );
  assert.equal(f.trace.length, 6);
  assert.ok(f.trace.every((entry) => Array.isArray(entry) && entry[0] === "access"));
});

test("empty pages remain empty without fake totals, zero values or next cursors", async () => {
  const f = fixture();
  f.reader.listUnits = async () => [];
  f.reader.listConversions = async () => [];
  const empty = { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
  assert.deepEqual(await new ReadInventoryUnits(f.access, f.reader).execute({}, identity), empty);
  assert.deepEqual(
    await new ReadInventoryUnitConversions(f.access, f.reader).execute({}, identity),
    empty,
  );
});

test("query response validation fails closed on leaked metadata or non-decimal factor", async () => {
  const f = fixture();
  const leaked = { ...units[0]!, definitionLocked: true };
  f.reader.listUnits = async () => [leaked];
  f.reader.listConversions = async () => [{ ...definitions[0]!, factor: "1e-12" }];
  await assert.rejects(new ReadInventoryUnits(f.access, f.reader).execute({}, identity));
  await assert.rejects(new ReadInventoryUnitConversions(f.access, f.reader).execute({}, identity));
});
