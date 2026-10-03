import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { NotFoundException } from "@nestjs/common";

import type {
  HeldCartContents,
  HeldCartRecord,
  HeldCartRepository,
} from "./held-cart.repository.js";
import { HeldCartService } from "./held-cart.service.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f976100";
const OUTLET = "019f738d-e61f-7d46-92de-17b35f976101";
const OTHER_OUTLET = "019f738d-e61f-7d46-92de-17b35f976102";
const CASHIER = "019f738d-e61f-7d46-92de-17b35f976103";
const PRODUCT = "019f738d-e61f-7d46-92de-17b35f976201";

type Stored = HeldCartRecord & HeldCartContents & { key: string; outletId: string };

class InMemoryHeldCartRepository implements HeldCartRepository {
  readonly carts: Stored[] = [];

  async hold(input: Parameters<HeldCartRepository["hold"]>[0]) {
    const existing = this.carts.find(
      (cart) => cart.key === input.idempotencyKey && cart.outletId === input.outletId,
    );
    if (existing) return existing;
    const cart: Stored = {
      createdAt: new Date(),
      createdByName: "Kasir Uji",
      id: randomUUID(),
      itemCount: input.itemCount,
      items: input.items,
      key: input.idempotencyKey,
      label: input.label,
      outletId: input.outletId,
    };
    this.carts.push(cart);
    return cart;
  }

  async list(_tenantId: string, outletId: string) {
    return this.carts.filter((cart) => cart.outletId === outletId);
  }

  async take(_tenantId: string, outletId: string, id: string) {
    const index = this.carts.findIndex((cart) => cart.id === id && cart.outletId === outletId);
    if (index < 0) return null;
    const [cart] = this.carts.splice(index, 1);
    return { items: cart!.items, label: cart!.label };
  }
}

function setup() {
  const repository = new InMemoryHeldCartRepository();
  return { repository, service: new HeldCartService(repository) };
}

const items = [
  { modifierOptionIds: [], note: "Tanpa es", productId: PRODUCT, quantity: 2 },
  { modifierOptionIds: [], productId: PRODUCT, quantity: 1 },
];

test("holds a cart once per key and counts its items", async () => {
  const { repository, service } = setup();
  const held = await service.hold(TENANT, OUTLET, { items, label: "Meja depan" }, "key-1", CASHIER);
  assert.equal(held.itemCount, 3);
  assert.equal(held.label, "Meja depan");
  await service.hold(TENANT, OUTLET, { items, label: "Meja depan" }, "key-1", CASHIER);
  assert.equal(repository.carts.length, 1);
  assert.equal((await service.list(TENANT, OUTLET)).heldCarts.length, 1);
  assert.equal((await service.list(TENANT, OTHER_OUTLET)).heldCarts.length, 0);
});

test("resumes a cart only once and returns what was chosen", async () => {
  const { service } = setup();
  const held = await service.hold(TENANT, OUTLET, { items, label: "Budi" }, "key-1", CASHIER);

  const resumed = await service.resume(TENANT, OUTLET, held.id);
  assert.equal(resumed.label, "Budi");
  assert.deepEqual(resumed.items, items);
  await assert.rejects(service.resume(TENANT, OUTLET, held.id), NotFoundException);
});

test("discards a cart and hides carts of other outlets", async () => {
  const { service } = setup();
  const held = await service.hold(TENANT, OUTLET, { items, label: "Budi" }, "key-1", CASHIER);

  await assert.rejects(service.resume(TENANT, OTHER_OUTLET, held.id), NotFoundException);
  await service.discard(TENANT, OUTLET, held.id);
  await assert.rejects(service.discard(TENANT, OUTLET, held.id), NotFoundException);
  assert.equal((await service.list(TENANT, OUTLET)).heldCarts.length, 0);
});
