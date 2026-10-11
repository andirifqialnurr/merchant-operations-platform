import assert from "node:assert/strict";
import test from "node:test";

import {
  computeCharges,
  formatRatePercent,
  NO_CHARGES,
  outletChargesSchema,
  parseRatePercent,
} from "./charges.ts";

const added = (serviceChargeRateBp: number, taxRateBp: number) => ({
  included: false,
  serviceChargeRateBp,
  taxRateBp,
});
const included = (serviceChargeRateBp: number, taxRateBp: number) => ({
  included: true,
  serviceChargeRateBp,
  taxRateBp,
});

test("without rates the menu price is the final price, in either pattern", () => {
  for (const charges of [NO_CHARGES, added(0, 0)]) {
    assert.deepEqual(computeCharges(25_000n, charges), {
      baseMinor: 25_000n,
      serviceChargeMinor: 0n,
      taxMinor: 0n,
      totalMinor: 25_000n,
    });
  }
});

test("added on the receipt: service on the menu price, tax on price plus service", () => {
  // Rp100.000, service 5%, tax 10%: 5.000 service, 10.500 tax.
  assert.deepEqual(computeCharges(100_000n, added(500, 1000)), {
    baseMinor: 100_000n,
    serviceChargeMinor: 5_000n,
    taxMinor: 10_500n,
    totalMinor: 115_500n,
  });
  // $10.25 with 11% tax: 112.75 cents rounds to 113.
  assert.deepEqual(computeCharges(1_025n, added(0, 1100)), {
    baseMinor: 1_025n,
    serviceChargeMinor: 0n,
    taxMinor: 113n,
    totalMinor: 1_138n,
  });
});

test("already in the price: the customer pays the menu price and the parts are taken out of it", () => {
  // Rp115.500 holding 5% service and 10% tax is exactly the case above, backwards.
  assert.deepEqual(computeCharges(115_500n, included(500, 1000)), {
    baseMinor: 100_000n,
    serviceChargeMinor: 5_000n,
    taxMinor: 10_500n,
    totalMinor: 115_500n,
  });
  // Rp25.000 holding 11% tax: 22.523 before tax, 2.477 tax.
  assert.deepEqual(computeCharges(25_000n, included(0, 1100)), {
    baseMinor: 22_523n,
    serviceChargeMinor: 0n,
    taxMinor: 2_477n,
    totalMinor: 25_000n,
  });
});

test("the parts always add up to the total, and the total never moves when included", () => {
  const rates = [0, 1, 250, 500, 550, 1000, 1100, 1250, 5000];
  for (let subtotal = 0n; subtotal < 3_000n; subtotal += 7n) {
    for (const service of rates) {
      for (const tax of rates) {
        for (const charges of [added(service, tax), included(service, tax)]) {
          const parts = computeCharges(subtotal, charges);
          assert.equal(
            parts.baseMinor + parts.serviceChargeMinor + parts.taxMinor,
            parts.totalMinor,
          );
          assert.ok(
            parts.baseMinor >= 0n && parts.serviceChargeMinor >= 0n && parts.taxMinor >= 0n,
          );
          if (charges.included) assert.equal(parts.totalMinor, subtotal);
          else assert.equal(parts.baseMinor, subtotal);
        }
      }
    }
  }
  assert.throws(() => computeCharges(-1n, NO_CHARGES), RangeError);
});

test("amounts beyond the safe range of a number stay exact", () => {
  const parts = computeCharges(900_719_925_474_099_312n, added(500, 1100));
  assert.equal(parts.serviceChargeMinor, 45_035_996_273_704_966n);
  assert.equal(parts.totalMinor, parts.baseMinor + parts.serviceChargeMinor + parts.taxMinor);
});

test("a rate is typed as a percentage with a comma or a point", () => {
  assert.equal(parseRatePercent("11"), 1100);
  assert.equal(parseRatePercent("5,5"), 550);
  assert.equal(parseRatePercent(" 5.25 "), 525);
  assert.equal(parseRatePercent("0"), 0);
  assert.equal(parseRatePercent("50"), 5000);
  for (const text of ["", "51", "-1", "abc", "5.555", "1e1", "5,"]) {
    assert.equal(parseRatePercent(text), undefined, text);
  }
  assert.equal(formatRatePercent(1100), "11");
  assert.equal(formatRatePercent(550, ","), "5,5");
  assert.equal(formatRatePercent(525), "5.25");
  assert.equal(formatRatePercent(0), "0");
  for (const bp of [0, 1, 10, 99, 100, 550, 1100, 5000]) {
    assert.equal(parseRatePercent(formatRatePercent(bp)), bp);
  }
});

test("rates are whole basis points up to 50%", () => {
  assert.ok(outletChargesSchema.safeParse(included(500, 1100)).success);
  assert.equal(outletChargesSchema.safeParse(included(5001, 0)).success, false);
  assert.equal(outletChargesSchema.safeParse(included(0, 10.5)).success, false);
  assert.equal(outletChargesSchema.safeParse(included(-1, 0)).success, false);
});
