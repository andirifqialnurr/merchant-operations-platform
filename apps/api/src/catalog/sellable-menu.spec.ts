import assert from "node:assert/strict";
import test from "node:test";

import { sellableMenuSchema } from "@merchant/contracts";

import type { CatalogSnapshotRecord } from "./catalog.repository.js";
import { buildSellableMenu } from "./sellable-menu.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f973100";
const OUTLET = "019f738d-e61f-7d46-92de-17b35f973101";
const OTHER_OUTLET = "019f738d-e61f-7d46-92de-17b35f973102";
const id = (suffix: number) => `019f738d-e61f-7d46-92de-17b35f97${suffix}`;
const stamps = { createdAt: new Date(0), tenantId: TENANT, updatedAt: new Date(0) };

const COFFEE = id(3201);
const FOOD = id(3202);
const HIDDEN = id(3203);
const LATTE = id(3301);
const TOAST = id(3302);
const SIZE = id(3401);
const SUGAR = id(3402);

function snapshot(overrides: Partial<CatalogSnapshotRecord> = {}): CatalogSnapshotRecord {
  const product = (productId: string, name: string, categoryId: string, price: string) => ({
    ...stamps,
    availability: "AVAILABLE" as const,
    basePriceMinor: price,
    categoryId,
    currency: "IDR",
    description: null,
    id: productId,
    name,
    slug: name.toLowerCase(),
    status: "ACTIVE" as const,
  });
  const category = (categoryId: string, name: string, displayOrder: number) => ({
    ...stamps,
    displayOrder,
    id: categoryId,
    name,
    slug: name.toLowerCase(),
    status: "ACTIVE" as const,
  });
  const assignment = (assignmentId: string, productId: string, displayOrder: number) => ({
    ...stamps,
    availabilityOverride: null,
    displayOrder,
    id: assignmentId,
    outletId: OUTLET,
    priceOverrideMinor: null,
    productId,
    status: "ACTIVE" as const,
  });
  const option = (optionId: string, groupId: string, name: string, delta: string) => ({
    ...stamps,
    availability: "AVAILABLE" as const,
    displayOrder: 0,
    groupId,
    id: optionId,
    name,
    priceDeltaMinor: delta,
    status: "ACTIVE" as const,
  });
  return {
    categories: [
      category(FOOD, "Makanan", 2),
      category(COFFEE, "Kopi", 1),
      category(HIDDEN, "Kosong", 0),
    ],
    modifierGroups: [
      {
        ...stamps,
        displayOrder: 0,
        id: SIZE,
        maxSelections: 1,
        minSelections: 1,
        name: "Ukuran",
        selectionType: "SINGLE",
        status: "ACTIVE",
      },
      {
        ...stamps,
        displayOrder: 1,
        id: SUGAR,
        maxSelections: 3,
        minSelections: 0,
        name: "Tambahan",
        selectionType: "MULTIPLE",
        status: "ACTIVE",
      },
    ],
    modifierOptions: [
      option(id(3501), SIZE, "Besar", "5000"),
      option(id(3502), SIZE, "Kecil", "0"),
      option(id(3503), SUGAR, "Gula aren", "3000"),
    ],
    outletProducts: [assignment(id(3601), TOAST, 1), assignment(id(3602), LATTE, 0)],
    productImages: [],
    productModifierGroups: [
      {
        ...stamps,
        displayOrder: 1,
        id: id(3701),
        modifierGroupId: SUGAR,
        productId: LATTE,
        status: "ACTIVE",
      },
      {
        ...stamps,
        displayOrder: 0,
        id: id(3702),
        modifierGroupId: SIZE,
        productId: LATTE,
        status: "ACTIVE",
      },
    ],
    productVariants: [],
    products: [
      product(LATTE, "Latte", COFFEE, "25000"),
      product(TOAST, "Roti Bakar", FOOD, "18000"),
    ],
    ...overrides,
  };
}

test("lists sellable products in display order with their modifier groups", () => {
  const menu = sellableMenuSchema.parse(buildSellableMenu(snapshot(), OUTLET));

  assert.deepEqual(
    menu.categories.map((category) => category.name),
    ["Kopi", "Makanan"],
  );
  assert.deepEqual(
    menu.products.map((product) => product.name),
    ["Latte", "Roti Bakar"],
  );
  const latte = menu.products[0]!;
  assert.equal(latte.priceMinor, "25000");
  assert.deepEqual(
    latte.modifierGroups.map((group) => group.name),
    ["Ukuran", "Tambahan"],
  );
  assert.deepEqual(
    latte.modifierGroups[0]!.options.map((option) => option.name),
    ["Besar", "Kecil"],
  );
  // A group never asks for more selections than it has options on offer.
  assert.equal(latte.modifierGroups[1]!.maxSelections, 1);
});

test("uses the outlet price and hides other outlets' assignments", () => {
  const base = snapshot();
  const menu = buildSellableMenu(
    {
      ...base,
      outletProducts: [
        { ...base.outletProducts[1]!, priceOverrideMinor: "27000" },
        { ...base.outletProducts[0]!, outletId: OTHER_OUTLET },
      ],
    },
    OUTLET,
  );

  assert.deepEqual(
    menu.products.map((product) => [product.name, product.priceMinor]),
    [["Latte", "27000"]],
  );
  assert.deepEqual(
    menu.categories.map((category) => category.name),
    ["Kopi"],
  );
});

test("leaves out products that cannot be sold", () => {
  const base = snapshot();
  const names = (overrides: Partial<CatalogSnapshotRecord>) =>
    buildSellableMenu({ ...base, ...overrides }, OUTLET).products.map((product) => product.name);

  assert.deepEqual(
    names({ products: [{ ...base.products[0]!, status: "INACTIVE" }, base.products[1]!] }),
    ["Roti Bakar"],
  );
  assert.deepEqual(
    names({ products: [{ ...base.products[0]!, availability: "SOLD_OUT" }, base.products[1]!] }),
    ["Roti Bakar"],
  );
  assert.deepEqual(
    names({
      outletProducts: [
        base.outletProducts[0]!,
        { ...base.outletProducts[1]!, availabilityOverride: "SOLD_OUT" },
      ],
    }),
    ["Roti Bakar"],
  );
  assert.deepEqual(
    names({
      categories: base.categories.map((category) =>
        category.id === COFFEE ? { ...category, status: "INACTIVE" as const } : category,
      ),
    }),
    ["Roti Bakar"],
  );
  // The required size group has no option left to choose.
  assert.deepEqual(
    names({
      modifierOptions: base.modifierOptions.map((option) =>
        option.groupId === SIZE ? { ...option, availability: "SOLD_OUT" as const } : option,
      ),
    }),
    ["Roti Bakar"],
  );
});

test("drops optional groups without options and sold-out variants", () => {
  const base = snapshot();
  const variant = (variantId: string, name: string, availability: "AVAILABLE" | "SOLD_OUT") => ({
    ...stamps,
    availability,
    displayOrder: 0,
    id: variantId,
    name,
    priceDeltaMinor: "2000",
    productId: TOAST,
    status: "ACTIVE" as const,
  });

  const menu = buildSellableMenu(
    {
      ...base,
      modifierOptions: base.modifierOptions.filter((option) => option.groupId !== SUGAR),
      productVariants: [
        variant(id(3801), "Keju", "AVAILABLE"),
        variant(id(3802), "Cokelat", "SOLD_OUT"),
      ],
    },
    OUTLET,
  );
  assert.deepEqual(
    menu.products[0]!.modifierGroups.map((group) => group.name),
    ["Ukuran"],
  );
  assert.deepEqual(
    menu.products[1]!.variants.map((item) => item.name),
    ["Keju"],
  );

  const soldOut = buildSellableMenu(
    { ...base, productVariants: [variant(id(3802), "Cokelat", "SOLD_OUT")] },
    OUTLET,
  );
  assert.deepEqual(
    soldOut.products.map((product) => product.name),
    ["Latte"],
  );
});

test("names each product's main active picture, and none when it has none", () => {
  const image = (
    suffix: number,
    productId: string,
    isPrimary: boolean,
    status: "ACTIVE" | "INACTIVE",
  ) => ({
    ...stamps,
    altText: null,
    contentType: "image/webp" as const,
    displayOrder: 0,
    height: 600,
    id: id(suffix),
    isPrimary,
    objectKey: `tenants/${TENANT}/catalog/product-images/${suffix}.webp`,
    productId,
    status,
    tenantId: TENANT,
    width: 800,
  });
  const menu = sellableMenuSchema.parse(
    buildSellableMenu(
      snapshot({
        productImages: [
          image(3901, LATTE, false, "ACTIVE"),
          image(3902, LATTE, true, "ACTIVE"),
          // A removed picture is never shown, even if it was the main one.
          image(3903, TOAST, true, "INACTIVE"),
        ],
      }),
      OUTLET,
    ),
  );
  assert.equal(menu.products.find((item) => item.name === "Latte")?.imageId, id(3902));
  assert.equal(menu.products.find((item) => item.name === "Roti Bakar")?.imageId, null);
});
