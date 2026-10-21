import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { InventoryCategory } from "@merchant/contracts";

import { ReadInventoryCategories } from "./read-inventory-categories.js";
import type { InventoryCategoryReader } from "./inventory-category-reader.js";
import type {
  InventoryMasterReadAccess,
  InventoryReadIdentity,
} from "./inventory-master-read-access.js";

const identity: InventoryReadIdentity = {
  tenantId: randomUUID(),
  userId: randomUUID(),
  membershipId: randomUUID(),
};
const categories: InventoryCategory[] = Array.from({ length: 3 }, (_, i) => ({
  id: randomUUID(),
  name: `Category ${i}`,
  status: i === 1 ? "INACTIVE" : "ACTIVE",
}));

function fixture() {
  const calls: unknown[] = [];
  const access: InventoryMasterReadAccess = {
    authorize: async (input) => {
      calls.push(["access", input]);
      return { tenantId: identity.tenantId };
    },
  };
  const reader: InventoryCategoryReader = {
    listCategories: async (...args) => {
      calls.push(["read", ...args]);
      return categories;
    },
  };
  return { calls, access, reader, query: new ReadInventoryCategories(access, reader) };
}

test("category query authorizes first and forwards bounded exact filters; missing status means all", async () => {
  const f = fixture();
  const page = await f.query.execute({ limit: "2" }, identity);
  assert.deepEqual(f.calls, [
    ["access", identity],
    ["read", { tenantId: identity.tenantId }, { limit: 2 }],
  ]);
  assert.deepEqual(page, {
    items: categories.slice(0, 2),
    pageInfo: { hasNextPage: true, nextCursor: categories[1]!.id },
  });
  f.reader.listCategories = async (...args) => {
    f.calls.push(["filtered", ...args]);
    return [categories[1]!];
  };
  const input = { status: "INACTIVE", cursor: randomUUID() };
  assert.deepEqual(await f.query.execute(input, identity), {
    items: [categories[1]],
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
  assert.deepEqual(f.calls.at(-1), [
    "filtered",
    { tenantId: identity.tenantId },
    { ...input, limit: 25 },
  ]);
});

test("category access refusal precedes validation and never reaches persistence", async () => {
  const f = fixture();
  const failure = new Error("access denied");
  f.access.authorize = async () => {
    throw failure;
  };
  await assert.rejects(f.query.execute({ limit: 0 }, identity), (error) => error === failure);
  assert.deepEqual(f.calls, []);
});

test("category query refuses invalid status, limits and mutation/scope inputs before reader IO", async () => {
  const f = fixture();
  for (const input of [
    { status: "ALL" },
    { status: "active" },
    { limit: 101 },
    { cursor: "g" },
    { name: "New" },
    { tenantId: randomUUID() },
    { outletId: randomUUID() },
    { balance: "0" },
  ])
    await assert.rejects(f.query.execute(input, identity));
  assert.equal(f.calls.length, 8);
  assert.ok(f.calls.every((call) => Array.isArray(call) && call[0] === "access"));
});

test("empty/exact-limit category pages never invent rows, counts or an unneeded cursor", async () => {
  const f = fixture();
  f.reader.listCategories = async () => [];
  assert.deepEqual(await f.query.execute({}, identity), {
    items: [],
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
  f.reader.listCategories = async () => categories.slice(0, 2);
  assert.deepEqual(await f.query.execute({ limit: 2 }, identity), {
    items: categories.slice(0, 2),
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
});

test("unbounded or incorrectly filtered category ports fail closed, not silently slice/filter at presentation", async () => {
  const f = fixture();
  await assert.rejects(f.query.execute({ limit: 1 }, identity), /unbounded/);
  await assert.rejects(f.query.execute({ status: "ACTIVE" }, identity), /incorrectly filtered/);
});

test("category query response rejects ORM/sensitive metadata and invalid authoritative fields", async () => {
  const f = fixture();
  for (const row of [
    { ...categories[0]!, tenantId: identity.tenantId },
    { ...categories[0]!, itemCount: 0 },
    { ...categories[0]!, name: "" },
    { ...categories[0]!, status: "ARCHIVED" as "ACTIVE" },
  ]) {
    f.reader.listCategories = async () => [row];
    await assert.rejects(f.query.execute({}, identity));
  }
});
