import type { OrderSource, OrderStatus, OrderType } from "@merchant/contracts";

import type { PricedLine } from "../domain/price-order.js";

export type OrderMutationContext = { actorId: string; requestId?: string };

export type OrderItemRecord = {
  id: string;
  lineTotalMinor: bigint;
  modifiers: { groupNameSnapshot: string; optionNameSnapshot: string; priceDeltaMinor: bigint }[];
  nameSnapshot: string;
  note: string | null;
  productId: string | null;
  quantity: number;
  unitPriceMinor: bigint;
  variantNameSnapshot: string | null;
};

export type OrderRecord = {
  createdAt: Date;
  currency: string;
  id: string;
  items: OrderItemRecord[];
  note: string | null;
  orderNumber: number;
  orderType: OrderType;
  outletId: string;
  source: OrderSource;
  status: OrderStatus;
  submittedAt: Date | null;
  tenantId: string;
};

export type NewSubmittedOrder = {
  currency: string;
  idempotencyKey: string;
  lines: readonly PricedLine[];
  note: string | null;
  orderType: OrderType;
  outletId: string;
  source: OrderSource;
  tenantId: string;
};

/** Persistence port for orders. Every read is scoped by tenant and outlet. */
export interface OrderRepository {
  /**
   * Stores a submitted order with the outlet's next order number. When the
   * idempotency key was already used, the order it created is returned.
   */
  createSubmitted(order: NewSubmittedOrder, context: OrderMutationContext): Promise<OrderRecord>;
  findById(tenantId: string, outletId: string, orderId: string): Promise<OrderRecord | null>;
  findByIdempotencyKey(
    tenantId: string,
    outletId: string,
    idempotencyKey: string,
  ): Promise<OrderRecord | null>;
}

export const ORDER_REPOSITORY = Symbol("ORDER_REPOSITORY");
