import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { SellableMenu } from "@merchant/contracts";
import { ConflictException, NotFoundException } from "@nestjs/common";

import type { CatalogService } from "../../../catalog/catalog.service.js";
import { priceOrderLines } from "../domain/price-order.js";
import { OrderIntakeService } from "./order-intake.service.js";
import type { NewSubmittedOrder, OrderRecord, OrderRepository } from "./order.repository.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f974100";
const OUTLET = "019f738d-e61f-7d46-92de-17b35f974101";
const OTHER_OUTLET = "019f738d-e61f-7d46-92de-17b35f974102";
const ACTOR = "019f738d-e61f-7d46-92de-17b35f974103";
const LATTE = "019f738d-e61f-7d46-92de-17b35f974201";
const TOAST = "019f738d-e61f-7d46-92de-17b35f974202";
const HOT = "019f738d-e61f-7d46-92de-17b35f974301";
const ICED = "019f738d-e61f-7d46-92de-17b35f974302";
const LARGE = "019f738d-e61f-7d46-92de-17b35f974401";
const SMALL = "019f738d-e61f-7d46-92de-17b35f974402";
const PALM_SUGAR = "019f738d-e61f-7d46-92de-17b35f974403";
const EXTRA_SHOT = "019f738d-e61f-7d46-92de-17b35f974404";
const UNKNOWN = "019f738d-e61f-7d46-92de-17b35f974999";

const menu: SellableMenu = {
  categories: [{ id: "019f738d-e61f-7d46-92de-17b35f974501", name: "Kopi" }],
  outletId: OUTLET,
  products: [
    {
      categoryId: "019f738d-e61f-7d46-92de-17b35f974501",
      currency: "IDR",
      id: LATTE,
      modifierGroups: [
        {
          id: "019f738d-e61f-7d46-92de-17b35f974601",
          maxSelections: 1,
          minSelections: 1,
          name: "Ukuran",
          options: [
            { id: LARGE, name: "Besar", priceDeltaMinor: "5000" },
            { id: SMALL, name: "Kecil", priceDeltaMinor: "0" },
          ],
          selectionType: "SINGLE",
        },
        {
          id: "019f738d-e61f-7d46-92de-17b35f974602",
          maxSelections: 2,
          minSelections: 0,
          name: "Tambahan",
          options: [
            { id: PALM_SUGAR, name: "Gula aren", priceDeltaMinor: "3000" },
            { id: EXTRA_SHOT, name: "Extra shot", priceDeltaMinor: "6000" },
          ],
          selectionType: "MULTIPLE",
        },
      ],
      name: "Latte",
      priceMinor: "25000",
      variants: [
        { id: HOT, name: "Panas", priceDeltaMinor: "0" },
        { id: ICED, name: "Dingin", priceDeltaMinor: "2000" },
      ],
    },
    {
      categoryId: "019f738d-e61f-7d46-92de-17b35f974501",
      currency: "IDR",
      id: TOAST,
      modifierGroups: [],
      name: "Roti Bakar",
      priceMinor: "18000",
      variants: [],
    },
  ],
};

class InMemoryOrderRepository implements OrderRepository {
  readonly orders: (OrderRecord & { idempotencyKey: string })[] = [];

  async findById(tenantId: string, outletId: string, orderId: string) {
    return (
      this.orders.find(
        (order) =>
          order.id === orderId && order.tenantId === tenantId && order.outletId === outletId,
      ) ?? null
    );
  }

  async findByIdempotencyKey(tenantId: string, outletId: string, idempotencyKey: string) {
    return (
      this.orders.find(
        (order) =>
          order.idempotencyKey === idempotencyKey &&
          order.tenantId === tenantId &&
          order.outletId === outletId,
      ) ?? null
    );
  }

  async createSubmitted(order: NewSubmittedOrder) {
    const orderNumber = this.orders.filter((item) => item.outletId === order.outletId).length + 1;
    const record = {
      createdAt: new Date(),
      currency: order.currency,
      id: randomUUID(),
      idempotencyKey: order.idempotencyKey,
      items: order.lines.map((line) => ({
        id: randomUUID(),
        lineTotalMinor: line.lineTotalMinor,
        modifiers: line.modifiers.map((modifier) => ({
          groupNameSnapshot: modifier.groupName,
          optionNameSnapshot: modifier.optionName,
          priceDeltaMinor: modifier.priceDeltaMinor,
        })),
        nameSnapshot: line.name,
        note: line.note,
        productId: line.productId,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        variantNameSnapshot: line.variantName,
      })),
      note: order.note,
      orderNumber,
      orderType: order.orderType,
      outletId: order.outletId,
      source: order.source,
      status: "SUBMITTED" as const,
      submittedAt: new Date(),
      tenantId: order.tenantId,
    };
    this.orders.push(record);
    return record;
  }
}

function setup(currentMenu: SellableMenu = menu) {
  const repository = new InMemoryOrderRepository();
  let served = currentMenu;
  const catalog = {
    getSellableMenu: async (_tenantId: string, outletId: string) => ({ ...served, outletId }),
  } as unknown as CatalogService;
  return {
    repository,
    service: new OrderIntakeService(repository, catalog),
    setMenu: (next: SellableMenu) => {
      served = next;
    },
  };
}

const context = { actorId: ACTOR };
const latteLine = { modifierOptionIds: [LARGE], productId: LATTE, quantity: 2, variantId: ICED };

async function rejectsWithCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ConflictException);
    assert.equal((error.getResponse() as { code: string }).code, code);
    return true;
  });
}

test("prices a line from the menu: outlet price, variant, and modifiers", () => {
  const result = priceOrderLines(menu.products, [
    { ...latteLine, modifierOptionIds: [EXTRA_SHOT, LARGE, PALM_SUGAR], note: "Sedikit es" },
    { modifierOptionIds: [], productId: TOAST, quantity: 1 },
  ]);

  assert.ok(result.ok);
  assert.equal(result.currency, "IDR");
  const latte = result.lines[0]!;
  // 25000 + 2000 (iced) + 5000 (large) + 3000 + 6000
  assert.equal(latte.unitPriceMinor, 41_000n);
  assert.equal(latte.lineTotalMinor, 82_000n);
  assert.equal(latte.variantName, "Dingin");
  // Modifiers follow the menu's order, not the order the client sent.
  assert.deepEqual(
    latte.modifiers.map((modifier) => `${modifier.groupName}: ${modifier.optionName}`),
    ["Ukuran: Besar", "Tambahan: Gula aren", "Tambahan: Extra shot"],
  );
  assert.equal(latte.note, "Sedikit es");
  assert.equal(result.subtotalMinor, 100_000n);
});

test("rejects lines the menu does not allow", () => {
  const code = (line: Parameters<typeof priceOrderLines>[1][number]) => {
    const result = priceOrderLines(menu.products, [
      { modifierOptionIds: [], productId: TOAST, quantity: 1 },
      line,
    ]);
    assert.equal(result.ok, false);
    return result.ok ? "" : `${result.code}@${result.lineIndex}`;
  };

  assert.equal(
    code({ modifierOptionIds: [], productId: UNKNOWN, quantity: 1 }),
    "ORDER_PRODUCT_UNAVAILABLE@1",
  );
  assert.equal(code({ ...latteLine, variantId: undefined }), "ORDER_VARIANT_INVALID@1");
  assert.equal(code({ ...latteLine, variantId: UNKNOWN }), "ORDER_VARIANT_INVALID@1");
  assert.equal(
    code({ modifierOptionIds: [], productId: TOAST, quantity: 1, variantId: HOT }),
    "ORDER_VARIANT_INVALID@1",
  );
  // The required size is missing.
  assert.equal(code({ ...latteLine, modifierOptionIds: [] }), "ORDER_MODIFIER_SELECTION_INVALID@1");
  assert.equal(
    code({ ...latteLine, modifierOptionIds: [LARGE, SMALL] }),
    "ORDER_MODIFIER_SELECTION_INVALID@1",
  );
  assert.equal(
    code({ ...latteLine, modifierOptionIds: [LARGE, UNKNOWN] }),
    "ORDER_MODIFIER_INVALID@1",
  );
  assert.equal(
    code({ ...latteLine, modifierOptionIds: [LARGE, LARGE] }),
    "ORDER_MODIFIER_INVALID@1",
  );
  assert.equal(
    code({ modifierOptionIds: [LARGE], productId: TOAST, quantity: 1 }),
    "ORDER_MODIFIER_INVALID@1",
  );
});

test("submits an order with snapshots, a derived subtotal, and outlet numbering", async () => {
  const { service } = setup();
  const input = { items: [latteLine], orderType: "TAKEAWAY" as const };

  const first = await service.submitPosOrder(TENANT, OUTLET, input, "key-1", context);
  assert.equal(first.status, "SUBMITTED");
  assert.equal(first.source, "POS");
  assert.equal(first.orderNumber, 1);
  assert.equal(first.subtotalMinor, "64000");
  assert.equal(first.items[0]!.name, "Latte");
  assert.equal(first.items[0]!.unitPriceMinor, "32000");
  assert.ok(first.submittedAt);

  const second = await service.submitPosOrder(TENANT, OUTLET, input, "key-2", context);
  assert.equal(second.orderNumber, 2);
  const elsewhere = await service.submitPosOrder(TENANT, OTHER_OUTLET, input, "key-1", context);
  assert.equal(elsewhere.orderNumber, 1);
});

test("returns the original order on a retry even after the menu changed", async () => {
  const { repository, service, setMenu } = setup();
  const input = { items: [latteLine], orderType: "TAKEAWAY" as const };
  const first = await service.submitPosOrder(TENANT, OUTLET, input, "key-1", context);

  setMenu({ ...menu, products: [] });
  const retry = await service.submitPosOrder(TENANT, OUTLET, input, "key-1", context);
  assert.equal(retry.id, first.id);
  assert.equal(retry.subtotalMinor, "64000");
  assert.equal(repository.orders.length, 1);

  await rejectsWithCode(
    service.submitPosOrder(TENANT, OUTLET, input, "key-2", context),
    "ORDER_PRODUCT_UNAVAILABLE",
  );
  assert.equal(repository.orders.length, 1);
});

test("reads an order only inside its tenant and outlet", async () => {
  const { service } = setup();
  const order = await service.submitPosOrder(
    TENANT,
    OUTLET,
    { items: [latteLine], orderType: "TAKEAWAY" },
    "key-1",
    context,
  );

  assert.equal((await service.getOrder(TENANT, OUTLET, order.id)).id, order.id);
  await assert.rejects(service.getOrder(TENANT, OTHER_OUTLET, order.id), NotFoundException);
  await assert.rejects(service.getOrder(OTHER_OUTLET, OUTLET, order.id), NotFoundException);
});
