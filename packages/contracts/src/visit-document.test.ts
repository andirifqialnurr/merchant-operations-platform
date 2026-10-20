import assert from "node:assert/strict";
import test from "node:test";

import { visitDocumentSchema, visitFinancialDocumentSchema } from "./visit-document.ts";
import { floorOpenApiSchemas } from "./openapi.ts";

const empty = {
  currency: "IDR",
  kind: "BILL",
  orders: [],
  pendingOrders: [],
  payments: [],
  refunds: [],
  state: "EMPTY",
  totals: {
    discountMinor: "0",
    dueMinor: "0",
    netPaidMinor: "0",
    paidMinor: "0",
    refundedMinor: "0",
    roundingMinor: "0",
    serviceChargeMinor: "0",
    subtotalMinor: "0",
    taxMinor: "0",
    totalMinor: "0",
  },
};

test("visit financial projection accepts exact integer minor units and signed rounding", () => {
  assert.deepEqual(visitFinancialDocumentSchema.parse(empty), empty);
  const totals = { ...empty.totals, totalMinor: "9007199254740993", roundingMinor: "-1" };
  assert.equal(
    visitFinancialDocumentSchema.parse({ ...empty, totals }).totals.totalMinor,
    "9007199254740993",
  );
  assert.equal(visitFinancialDocumentSchema.parse({ ...empty, totals }).totals.roundingMinor, "-1");
});

test("staff visit document adds scoped read-only print context without audit or command fields", () => {
  const response = {
    ...empty,
    visit: { id: "01990000-0000-7000-8000-000000000001", displayNumber: 1, status: "OPEN" },
    tableLabel: null,
    outlet: { name: "Outlet", workspaceName: "Workspace", timezone: "Asia/Jakarta" },
  };
  assert.deepEqual(visitDocumentSchema.parse(response), response);
  assert.equal(visitDocumentSchema.safeParse({ ...response, actorId: "secret" }).success, false);
  assert.equal(
    visitDocumentSchema.safeParse({ ...response, visit: { ...response.visit, openedBy: "secret" } })
      .success,
    false,
  );
  assert.equal(
    visitDocumentSchema.safeParse({
      ...response,
      outlet: { ...response.outlet, guestPaymentNote: "not print metadata" },
    }).success,
    false,
  );
  assert.equal(floorOpenApiSchemas.VisitDocument.type, "object");
});

test("visit financial output has no input, permission, or editable-total escape hatch", () => {
  for (const field of [
    "actorId",
    "workspaceId",
    "expectedTotalMinor",
    "canPrint",
    "tenderedMinor",
  ]) {
    assert.equal(visitFinancialDocumentSchema.safeParse({ ...empty, [field]: "1" }).success, false);
  }
  assert.equal(
    visitFinancialDocumentSchema.safeParse({
      ...empty,
      totals: { ...empty.totals, editableTotal: true },
    }).success,
    false,
  );
  for (const totalMinor of [1, "1.25", "-1", "NaN"]) {
    assert.equal(
      visitFinancialDocumentSchema.safeParse({ ...empty, totals: { ...empty.totals, totalMinor } })
        .success,
      false,
    );
  }
});

test("visit output distinguishes pending and partial bills from receipts without adding a new payment method", () => {
  for (const state of ["EMPTY", "PENDING", "UNPAID", "PARTIALLY_PAID", "PAID"]) {
    assert.equal(visitFinancialDocumentSchema.safeParse({ ...empty, state }).success, true);
  }
  assert.equal(
    visitFinancialDocumentSchema.safeParse({ ...empty, kind: "SPLIT_BILL" }).success,
    false,
  );
});
