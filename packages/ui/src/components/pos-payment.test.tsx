import { describe, expect, it } from "vitest";

import { buildCashPresets } from "./pos-payment";

describe("buildCashPresets", () => {
  it("builds transaction-aware presets without duplicate values", () => {
    expect(buildCashPresets("75900")).toEqual(["75900", "80000", "100000"]);
    expect(buildCashPresets(100_000)).toEqual(["100000"]);
  });

  it("offers dollar notes for a total in cents, and only the exact amount for an unknown currency", () => {
    expect(buildCashPresets("1025", "USD")).toEqual(["1025", "1500", "2000"]);
    expect(buildCashPresets("2000", "usd")).toEqual(["2000"]);
    expect(buildCashPresets("1025", "EUR")).toEqual(["1025"]);
  });
});
