import assert from "node:assert/strict";
import test from "node:test";

import type { SellableMenuProduct } from "@merchant/contracts";

import {
  addLine,
  isLineComplete,
  lineKey,
  removeLine,
  setLineNote,
  setLineQuantity,
  toOrderItems,
  unitPrice,
  viewCart,
  type CartLine,
} from "./cart";

const latte: SellableMenuProduct = {
  categoryId: "c1",
  currency: "IDR",
  id: "latte",
  imageId: null,
  modifierGroups: [
    {
      id: "size",
      maxSelections: 1,
      minSelections: 1,
      name: "Ukuran",
      options: [
        { id: "regular", name: "Regular", priceDeltaMinor: "0" },
        { id: "large", name: "Large", priceDeltaMinor: "6000" },
      ],
      selectionType: "SINGLE",
    },
    {
      id: "extra",
      maxSelections: 2,
      minSelections: 0,
      name: "Tambahan",
      options: [
        { id: "shot", name: "Extra shot", priceDeltaMinor: "6000" },
        { id: "oat", name: "Susu oat", priceDeltaMinor: "8000" },
        { id: "caramel", name: "Sirup karamel", priceDeltaMinor: "4000" },
      ],
      selectionType: "MULTIPLE",
    },
  ],
  name: "Caffe Latte",
  priceMinor: "26000",
  variants: [
    { id: "hot", name: "Panas", priceDeltaMinor: "0" },
    { id: "iced", name: "Dingin", priceDeltaMinor: "3000" },
  ],
};
const toast: SellableMenuProduct = {
  categoryId: "c2",
  currency: "IDR",
  id: "toast",
  imageId: null,
  modifierGroups: [],
  name: "Roti Bakar Cokelat",
  priceMinor: "18000",
  variants: [],
};
const menu = [latte, toast];
const icedLarge: CartLine = {
  modifierOptionIds: ["large", "shot"],
  productId: "latte",
  quantity: 1,
  variantId: "iced",
};

test("prices a line from the menu and lists choices in menu order", () => {
  assert.equal(unitPrice(latte, icedLarge), 41_000n);
  const view = viewCart(
    [
      { ...icedLarge, modifierOptionIds: ["shot", "large"], quantity: 2 },
      { modifierOptionIds: [], productId: "toast", quantity: 1 },
    ],
    menu,
  );
  assert.deepEqual(view.lines[0]!.choices, ["Dingin", "Large", "Extra shot"]);
  assert.equal(view.lines[0]!.lineTotalMinor, 82_000n);
  assert.equal(view.totalMinor, 100_000n);
  assert.equal(view.itemCount, 3);
});

test("knows when a line still misses a required choice", () => {
  assert.equal(isLineComplete(latte, icedLarge), true);
  assert.equal(
    isLineComplete(latte, { modifierOptionIds: ["large"], productId: "latte", quantity: 1 }),
    false,
  );
  assert.equal(isLineComplete(latte, { ...icedLarge, modifierOptionIds: ["shot"] }), false);
  assert.equal(
    isLineComplete(latte, { ...icedLarge, modifierOptionIds: ["large", "shot", "oat", "caramel"] }),
    false,
  );
  assert.equal(
    isLineComplete(toast, { modifierOptionIds: [], productId: "toast", quantity: 1 }),
    true,
  );
});

test("merges identical lines and keeps different choices apart", () => {
  let cart = addLine([], icedLarge);
  cart = addLine(cart, { ...icedLarge, modifierOptionIds: ["shot", "large"], quantity: 2 });
  assert.equal(cart.length, 1);
  assert.equal(cart[0]!.quantity, 3);

  cart = addLine(cart, { ...icedLarge, variantId: "hot" });
  cart = addLine(cart, { ...icedLarge, note: "Es sedikit" });
  assert.equal(cart.length, 3);

  cart = addLine(cart, { ...icedLarge, quantity: 500 });
  assert.equal(cart[0]!.quantity, 99);
});

test("changes and removes lines by key", () => {
  const cart = addLine(addLine([], icedLarge), {
    modifierOptionIds: [],
    productId: "toast",
    quantity: 1,
  });
  const key = lineKey(icedLarge);
  assert.equal(setLineQuantity(cart, key, 4)[0]!.quantity, 4);
  assert.equal(setLineQuantity(cart, key, 0)[0]!.quantity, 1);
  assert.deepEqual(
    removeLine(cart, key).map((line) => line.productId),
    ["toast"],
  );
});

test("drops lines the menu no longer sells and builds the order payload", () => {
  const cart: CartLine[] = [
    icedLarge,
    { modifierOptionIds: [], note: "Tanpa gula", productId: "toast", quantity: 2 },
    { modifierOptionIds: [], productId: "gone", quantity: 1 },
  ];
  const view = viewCart(cart, menu);
  assert.equal(view.lines.length, 2);
  assert.deepEqual(toOrderItems(view.lines), [
    { modifierOptionIds: ["large", "shot"], productId: "latte", quantity: 1, variantId: "iced" },
    { modifierOptionIds: [], note: "Tanpa gula", productId: "toast", quantity: 2 },
  ]);
  // Only what the cashier chose is sent; no name or price leaves the client.
  assert.equal(JSON.stringify(toOrderItems(view.lines)).includes("Minor"), false);
});

test("adds, clears, and merges notes on cart lines", () => {
  const toast = { modifierOptionIds: [], productId: "toast", quantity: 1 };
  let cart = addLine(addLine([], icedLarge), toast);
  const key = lineKey(toast);

  cart = setLineNote(cart, key, "  Tanpa gula  ");
  assert.equal(cart[1]!.note, "Tanpa gula");
  assert.equal(cart.length, 2);

  // The same item with the same note becomes one line.
  cart = addLine(cart, { ...toast, note: "Pedas" });
  cart = setLineNote(cart, lineKey({ ...toast, note: "Pedas" }), "Tanpa gula");
  assert.equal(cart.length, 2);
  assert.equal(cart.find((line) => line.productId === "toast")!.quantity, 2);

  // An empty note removes it; the line keeps its place.
  cart = setLineNote(cart, lineKey({ ...toast, note: "Tanpa gula" }), "   ");
  assert.equal(cart[1]!.note, undefined);
  assert.equal(viewCart(cart, menu).lines[1]!.line.note, undefined);
});
