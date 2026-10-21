import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { InventoryItem } from "@merchant/contracts";

import { normalizeInventoryItemPatch, planInventoryItemUpdate } from "./item-update.js";

const before: InventoryItem = {
  id: randomUUID(),
  name: "Original",
  sku: "SKU",
  categoryId: randomUUID(),
  baseUnitId: randomUUID(),
  minStock: "1",
  status: "INACTIVE",
};
test("partial item normalization keeps absence vs NULL and stable hash field order/canonical decimals", () => {
  assert.deepEqual(normalizeInventoryItemPatch({ name: "New", sku: undefined }), { name: "New" });
  assert.deepEqual(normalizeInventoryItemPatch({ sku: null, categoryId: null, minStock: null }), {
    sku: null,
    categoryId: null,
    minStock: null,
  });
  const group = randomUUID();
  assert.deepEqual(
    normalizeInventoryItemPatch({
      minStock: "1.000000",
      categoryId: group.toUpperCase(),
      sku: "SKU",
      name: "New",
    }),
    { name: "New", sku: "SKU", categoryId: group, minStock: "1" },
  );
});
test("item update preserves status/base unit/omitted fields and records only metadata change flags", () => {
  const plan = planInventoryItemUpdate(before, { name: "New" }, 6);
  assert.ok(plan.ok);
  assert.deepEqual(plan.after, { ...before, name: "New" });
  assert.deepEqual(plan.flags, { nameChanged: true, skuChanged: false, minStockChanged: false });
  assert.equal(plan.categoryChanged, false);
  assert.equal(plan.changed, true);
  assert.equal(before.name, "Original");
});
test("item clears nullable fields deliberately while canonical equivalents are no-op", () => {
  const noop = planInventoryItemUpdate(
    before,
    normalizeInventoryItemPatch({
      minStock: "1.000000",
      categoryId: before.categoryId!.toUpperCase(),
    }),
    0,
  );
  assert.ok(noop.ok);
  assert.equal(noop.changed, false);
  const clear = planInventoryItemUpdate(before, { sku: null, categoryId: null, minStock: null }, 0);
  assert.ok(clear.ok);
  assert.equal(clear.categoryChanged, true);
  assert.equal(clear.after.minStock, null);
  assert.deepEqual(clear.flags, { nameChanged: false, skuChanged: true, minStockChanged: true });
  const zero = planInventoryItemUpdate({ ...before, minStock: null }, { minStock: "0" }, 0);
  assert.ok(zero.ok);
  assert.equal(zero.flags.minStockChanged, true);
});
test("minimum edits reject meaningful excess precision without rounding or quantity reinterpretation", () => {
  assert.deepEqual(planInventoryItemUpdate(before, { minStock: "0.1" }, 0), {
    ok: false,
    code: "INVENTORY_MINIMUM_PRECISION_EXCEEDED",
  });
  for (const minStock of ["0", "0.000001", "999999999999999999999999.999999"]) {
    const plan = planInventoryItemUpdate(before, { minStock }, 6);
    assert.ok(plan.ok);
    assert.equal(plan.after.minStock, minStock);
    assert.equal(plan.after.baseUnitId, before.baseUnitId);
  }
});
