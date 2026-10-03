import {
  createOrderItemSchema,
  heldCartListSchema,
  heldCartSchema,
  resumedCartSchema,
  type HoldCart,
} from "@merchant/contracts";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  HELD_CART_REPOSITORY,
  type HeldCartRecord,
  type HeldCartRepository,
} from "./held-cart.repository.js";

/** Stored lines are read back through the same contract they were written with. */
export const heldLinesSchema = createOrderItemSchema.array();

function toHeldCart(record: HeldCartRecord) {
  return heldCartSchema.parse({ ...record, createdAt: record.createdAt.toISOString() });
}

const notFound = () =>
  new NotFoundException({
    code: "HELD_CART_NOT_FOUND",
    message: "This held cart was already resumed or discarded.",
  });

/**
 * Carts set aside at an outlet. Any cashier of the outlet can pick one up;
 * resuming or discarding removes it, so it is never taken twice.
 */
@Injectable()
export class HeldCartService {
  constructor(@Inject(HELD_CART_REPOSITORY) private readonly carts: HeldCartRepository) {}

  async hold(
    tenantId: string,
    outletId: string,
    input: HoldCart,
    idempotencyKey: string,
    actorId: string,
  ) {
    return toHeldCart(
      await this.carts.hold({
        createdBy: actorId,
        idempotencyKey,
        itemCount: input.items.reduce((sum, item) => sum + item.quantity, 0),
        items: input.items,
        label: input.label,
        outletId,
        tenantId,
      }),
    );
  }

  async list(tenantId: string, outletId: string) {
    return heldCartListSchema.parse({
      heldCarts: (await this.carts.list(tenantId, outletId)).map(toHeldCart),
    });
  }

  async resume(tenantId: string, outletId: string, id: string) {
    const taken = await this.carts.take(tenantId, outletId, id);
    if (!taken) throw notFound();
    return resumedCartSchema.parse(taken);
  }

  async discard(tenantId: string, outletId: string, id: string) {
    if (!(await this.carts.take(tenantId, outletId, id))) throw notFound();
  }
}
