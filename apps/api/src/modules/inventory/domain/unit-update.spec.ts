import assert from "node:assert/strict";
import test from "node:test";

import { planInventoryUnitUpdate } from "./unit-update.js";

const unit = { code: "g", name: "Gram", precision: 6, definitionLocked: false };

test("unused unit permits partial definition changes and distinguishes actual changes from no-op", () => {
  for (const patch of [{ code: "kg" }, { precision: 0 }, { code: "G", precision: 3 }])
    assert.deepEqual(planInventoryUnitUpdate(unit, patch), {
      ok: true,
      changed: true,
      nameChanged: false,
    });
  assert.deepEqual(planInventoryUnitUpdate(unit, { name: "Grams" }), {
    ok: true,
    changed: true,
    nameChanged: true,
  });
  assert.deepEqual(planInventoryUnitUpdate(unit, { code: "g", name: "Gram", precision: 6 }), {
    ok: true,
    changed: false,
    nameChanged: false,
  });
});

test("referenced unit permits label correction and identical code/precision, not reinterpretation", () => {
  const used = { ...unit, definitionLocked: true };
  assert.deepEqual(planInventoryUnitUpdate(used, { name: "Grams", code: "g", precision: 6 }), {
    ok: true,
    changed: true,
    nameChanged: true,
  });
  assert.deepEqual(planInventoryUnitUpdate(used, { code: "g", precision: 6 }), {
    ok: true,
    changed: false,
    nameChanged: false,
  });
  for (const patch of [
    { code: "kg" },
    { code: "G" },
    { precision: 5 },
    { precision: 0 },
    { name: "Grams", precision: 3 },
  ])
    assert.deepEqual(planInventoryUnitUpdate(used, patch), {
      ok: false,
      code: "INVENTORY_UNIT_DEFINITION_LOCKED",
    });
});

test("update planning is pure and never infers a mutation for omitted fields", () => {
  const before = Object.freeze({ ...unit, definitionLocked: true });
  const patch = Object.freeze({ name: "Grams" });
  planInventoryUnitUpdate(before, patch);
  assert.equal(before.code, "g");
  assert.deepEqual(patch, { name: "Grams" });
  assert.deepEqual(planInventoryUnitUpdate(unit, { name: "Gram", code: undefined }), {
    ok: true,
    changed: false,
    nameChanged: false,
  });
});
