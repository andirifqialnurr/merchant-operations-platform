import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { InventoryItem } from "@merchant/contracts";

import { ReadInventoryItems } from "./read-inventory-items.js";
import type { InventoryItemReader } from "./inventory-item-reader.js";
import type { InventoryMasterReadAccess } from "./inventory-master-read-access.js";

const identity = { tenantId: randomUUID(), userId: randomUUID(), membershipId: randomUUID() };
const unitId = randomUUID();
const categoryId = randomUUID();
const rows: InventoryItem[] = Array.from({ length: 3 }, (_, i) => ({
  id: randomUUID(),
  sku: null,
  name: `Item ${i}`,
  categoryId,
  baseUnitId: unitId,
  minStock: i === 0 ? null : "0",
  status: "ACTIVE" as const,
})).sort((a, b) => a.id.localeCompare(b.id));
function fixture() {
  const calls: unknown[] = [];
  const access: InventoryMasterReadAccess = {
    authorize: async (id) => {
      calls.push(["access", id]);
      return { tenantId: identity.tenantId };
    },
  };
  const reader: InventoryItemReader = {
    listItems: async (...args) => {
      calls.push(["read", ...args]);
      return rows;
    },
  };
  return { calls, access, reader, query: new ReadInventoryItems(access, reader) };
}

test("item query authorizes each page before bounded read with exact filters", async () => {
  const f = fixture();
  const input = {
    limit: "2",
    status: "ACTIVE",
    categoryId: categoryId.toUpperCase(),
    baseUnitId: unitId.toUpperCase(),
  };
  const page = await f.query.execute(input, identity);
  assert.deepEqual(f.calls, [
    ["access", identity],
    ["read", { tenantId: identity.tenantId }, { ...input, limit: 2 }],
  ]);
  assert.deepEqual(page, {
    items: rows.slice(0, 2),
    pageInfo: { hasNextPage: true, nextCursor: rows[1]!.id },
  });
  f.reader.listItems = async () => [rows[2]!];
  assert.deepEqual((await f.query.execute({ cursor: rows[1]!.id.toUpperCase() }, identity)).items, [
    rows[2],
  ]);
  assert.equal(f.calls.filter((call) => Array.isArray(call) && call[0] === "access").length, 2);
});

test("item access refusal precedes invalid input and master IO", async () => {
  const f = fixture();
  const denied = new Error("denied");
  f.access.authorize = async () => {
    throw denied;
  };
  await assert.rejects(
    f.query.execute({ limit: 0, cost: "0" }, identity),
    (error) => error === denied,
  );
  assert.deepEqual(f.calls, []);
});

test("item invalid scope/filter/mutation query fields never reach persistence", async () => {
  const f = fixture();
  const invalid = [
    { tenantId: randomUUID() },
    { outletId: randomUUID() },
    { categoryId: "bad" },
    { baseUnitId: null },
    { limit: 101 },
    { status: "ALL" },
    { minStock: "0" },
    { hpp: "0" },
  ];
  for (const input of invalid) await assert.rejects(f.query.execute(input, identity));
  assert.equal(f.calls.length, invalid.length);
});

test("empty and exact-limit item pages invent neither zero facts nor totals/cursors", async () => {
  const f = fixture();
  f.reader.listItems = async () => [];
  assert.deepEqual(await f.query.execute({}, identity), {
    items: [],
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
  f.reader.listItems = async () => rows.slice(0, 2);
  assert.deepEqual(await f.query.execute({ limit: 2 }, identity), {
    items: rows.slice(0, 2),
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
});

test("unbounded/wrong status/parent filters and unordered/duplicate/pre-cursor ports fail closed", async () => {
  const f = fixture();
  for (const input of [
    { limit: 1 },
    { status: "INACTIVE" },
    { categoryId: randomUUID() },
    { baseUnitId: randomUUID() },
    { cursor: rows[0]!.id },
  ])
    await assert.rejects(f.query.execute(input, identity), /unbounded|incorrectly filtered/);
  for (const bad of [[...rows].reverse(), [rows[0]!, rows[0]!]]) {
    f.reader.listItems = async () => bad;
    await assert.rejects(f.query.execute({}, identity), /ordered/);
  }
});

test("strict item result validates peek too and rejects financial/ORM fields or fabricated amounts", async () => {
  const f = fixture();
  for (const patch of [
    { tenantId: identity.tenantId },
    { cost: "0" },
    { hpp: "0" },
    { balance: "0" },
    { minStock: 0 },
    { minStock: "-1" },
    { sku: undefined },
    { status: "ARCHIVED" },
  ]) {
    f.reader.listItems = async () => [rows[0]!, { ...rows[1]!, ...patch } as InventoryItem];
    await assert.rejects(f.query.execute({ limit: 1 }, identity));
  }
});
