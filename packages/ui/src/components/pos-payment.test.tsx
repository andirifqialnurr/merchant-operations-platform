import { describe, expect, it } from "vitest";

import { buildCashPresets } from "./pos-payment";

describe("buildCashPresets", () => {
  it("builds transaction-aware presets without duplicate values", () => {
    expect(buildCashPresets("75900")).toEqual(["75900", "80000", "100000"]);
    expect(buildCashPresets(100_000)).toEqual(["100000"]);
  });
});
