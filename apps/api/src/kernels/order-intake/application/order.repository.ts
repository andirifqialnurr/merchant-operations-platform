import type { OrderSource, OrderStatus, OrderType } from "@merchant/contracts";

import type { PricedLine } from "../domain/price-order.js";
import { type ActorCommandOrigin } from "../../../shared/command/command-origin.js";

export type OrderMutationContext = ActorCommandOrigin;

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
  cancelReason: string | null;
  canceledAt: Date | null;
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
  /**
   * Locks the order, runs `ensureCancellable` (which throws to refuse), then
   * marks it canceled. Returns null when the order is not found; an order
   * that is already canceled is returned as is.
   */
  cancel(
    tenantId: string,
    outletId: string,
    orderId: string,
    reason: string,
    ensureCancellable: () => Promise<void>,
    context: OrderMutationContext,
  ): Promise<OrderRecord | null>;
  findById(tenantId: string, outletId: string, orderId: string): Promise<OrderRecord | null>;
  /** The outlet's orders created since `since`, newest first. */
  listSince(tenantId: string, outletId: string, since: Date, limit: number): Promise<OrderRecord[]>;
  findByIdempotencyKey(
    tenantId: string,
    outletId: string,
    idempotencyKey: string,
  ): Promise<OrderRecord | null>;
}

export const ORDER_REPOSITORY = Symbol("ORDER_REPOSITORY");
