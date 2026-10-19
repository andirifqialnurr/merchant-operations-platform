import assert from "node:assert/strict";
import test from "node:test";

import type { GuestOrder } from "@merchant/contracts";

import type { MenuItem } from "../../lib/menu-cart.ts";
import { addOrderAgain, newestFirst, reorderLines, stepOf } from "./guest-order.ts";

const LATTE = "019f8801-0000-7000-8000-000000000001";
const TOAST = "019f8801-0000-7000-8000-000000000002";
const TEA = "019f8801-0000-7000-8000-000000000003";

const plain = (id: string, name: string): MenuItem => ({
  id,
  modifierGroups: [],
  name,
  priceMinor: "25000",
  variants: [],
});

const order = (lines: GuestOrder["lines"], orderNumber = 1): GuestOrder => ({
  lines,
  orderNumber,
  status: "RECEIVED",
  submittedAt: null,
  totalMinor: "50000",
});

test("a guest sees canceled orders without steps and others at their step", () => {
  assert.equal(stepOf("RECEIVED"), 0);
  assert.equal(stepOf("PREPARING"), 1);
  assert.equal(stepOf("READY"), 2);
  assert.equal(stepOf("CANCELED"), null);
  assert.equal(stepOf("PENDING"), null);
});

test("the order just sent comes first", () => {
  const visit = {
    claim: null,
    dueMinor: "0",
    orders: [order([], 1), order([], 2)],
    requests: [],
  };
  assert.deepEqual(
    newestFirst(visit).map((item) => item.orderNumber),
    [2, 1],
  );
  assert.deepEqual(newestFirst(undefined), []);
});

test("order again keeps plain lines the menu still sells as they were", () => {
  const menu: MenuItem[] = [
    plain(LATTE, "Latte"),
    {
      ...plain(TEA, "Teh"),
      // Now needs a size, so the old plain line cannot be repeated as it was.
      variants: [
        { id: "019f8801-0000-7000-8000-0000000000aa", name: "Besar", priceDeltaMinor: "0" },
      ],
    },
  ];
  const earlier = order([
    { modifiers: [], name: "Latte", productId: LATTE, quantity: 2 },
    { modifiers: ["Oat"], name: "Latte", productId: null, quantity: 1 },
    { modifiers: [], name: "Roti", productId: TOAST, quantity: 1 },
    { modifiers: [], name: "Teh", productId: TEA, quantity: 1 },
  ]);
  assert.deepEqual(reorderLines(earlier, menu), [
    { modifierOptionIds: [], productId: LATTE, quantity: 2 },
  ]);
});

test("order again joins lines already in the cart", () => {
  const menu = [plain(LATTE, "Latte")];
  const cart = [{ modifierOptionIds: [], productId: LATTE, quantity: 1 }];
  const earlier = order([{ modifiers: [], name: "Latte", productId: LATTE, quantity: 2 }]);
  assert.deepEqual(addOrderAgain(cart, earlier, menu), [
    { modifierOptionIds: [], productId: LATTE, quantity: 3 },
  ]);
});
