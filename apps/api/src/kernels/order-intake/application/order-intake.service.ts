import {
  orderSchema,
  type CreatePosOrder,
  type CreateTableOrder,
  type Order,
  type OrderType,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";

import { TABLE_VISIT_SOURCE, type TableVisitSource } from "./table-visit-source.port.js";
import { SELLABLE_MENU_SOURCE, type SellableMenuSource } from "./sellable-menu.port.js";
import { statusesBefore, type KitchenProgress } from "../domain/fulfillment.js";
import { priceOrderLines } from "../domain/price-order.js";
import {
  ORDER_REPOSITORY,
  type OrderMutationContext,
  type OrderSubmitContext,
  type OrderRecord,
  type OrderRepository,
} from "./order.repository.js";

const pricingMessages = {
  ORDER_CURRENCY_MIXED: "An order cannot mix currencies.",
  ORDER_MODIFIER_INVALID: "A chosen modifier does not belong to the product.",
  ORDER_MODIFIER_SELECTION_INVALID: "A modifier group has too few or too many choices.",
  ORDER_PRODUCT_UNAVAILABLE: "A product is not available at this outlet.",
  ORDER_VARIANT_INVALID: "A product variant is missing or not available.",
} as const;

/** Maps a stored order to its DTO; the subtotal is derived from the lines. */
export function toOrder(record: OrderRecord): Order {
  const subtotalMinor = record.items.reduce((sum, item) => sum + item.lineTotalMinor, 0n);
  return orderSchema.parse({
    cancelReason: record.cancelReason,
    canceledAt: record.canceledAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    currency: record.currency,
    id: record.id,
    items: record.items.map((item) => ({
      id: item.id,
      lineTotalMinor: item.lineTotalMinor.toString(),
      modifiers: item.modifiers.map((modifier) => ({
        groupName: modifier.groupNameSnapshot,
        optionName: modifier.optionNameSnapshot,
        priceDeltaMinor: modifier.priceDeltaMinor.toString(),
      })),
      name: item.nameSnapshot,
      note: item.note,
      productId: item.productId,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor.toString(),
      variantName: item.variantNameSnapshot,
    })),
    note: record.note,
    moderationStatus: record.moderationStatus,
    orderNumber: record.orderNumber,
    orderType: record.orderType,
    outletId: record.outletId,
    source: record.source,
    status: record.status,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    tableSessionId: record.tableSessionId,
    subtotalMinor: subtotalMinor.toString(),
  });
}

/**
 * Takes orders for an outlet. Prices and names always come from the outlet's
 * sellable menu at the moment of submission and are stored as snapshots.
 */
@Injectable()
export class OrderIntakeService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(SELLABLE_MENU_SOURCE) private readonly catalog: SellableMenuSource,
    @Optional() @Inject(TABLE_VISIT_SOURCE) private readonly visits?: TableVisitSource,
  ) {}

  async submitPosOrder(
    tenantId: string,
    outletId: string,
    input: CreatePosOrder,
    idempotencyKey: string,
    context: OrderMutationContext,
  ) {
    return this.submit(tenantId, outletId, input, null, "POS", idempotencyKey, context);
  }

  /**
   * Takes an order for guests at a table. The caller vouches that the visit
   * is open; the kernel only keeps its id with the order.
   */
  async submitTableOrder(
    tenantId: string,
    outletId: string,
    tableSessionId: string,
    input: CreateTableOrder,
    idempotencyKey: string,
    context: OrderSubmitContext,
    /** Staff at the POS, or guests from the table's QR. */
    source: "POS" | "SELF_ORDER" = "POS",
  ) {
    return this.submit(
      tenantId,
      outletId,
      { ...input, orderType: "DINE_IN" },
      tableSessionId,
      source,
      idempotencyKey,
      context,
    );
  }

  private async submit(
    tenantId: string,
    outletId: string,
    input: { items: CreatePosOrder["items"]; note?: string | undefined; orderType: OrderType },
    tableSessionId: string | null,
    source: "POS" | "SELF_ORDER",
    idempotencyKey: string,
    context: OrderSubmitContext,
  ) {
    // A retry returns the order already taken, priced as it was then.
    const existing = await this.orders.findByIdempotencyKey(tenantId, outletId, idempotencyKey);
    if (existing) {
      if (existing.tableSessionId !== tableSessionId || existing.source !== source) {
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: "This key belongs to another order context.",
        });
      }
      return toOrder(existing);
    }

    const menu = await this.catalog.getSellableMenu(tenantId, outletId);
    const priced = priceOrderLines(menu.products, input.items);
    if (!priced.ok) {
      throw new ConflictException({
        code: priced.code,
        details: { lineIndex: priced.lineIndex },
        message: pricingMessages[priced.code],
      });
    }

    return toOrder(
      await this.orders.createSubmitted(
        {
          currency: priced.currency,
          idempotencyKey,
          lines: priced.lines,
          note: input.note ?? null,
          orderType: input.orderType,
          outletId,
          source,
          tableSessionId,
          tenantId,
        },
        context,
        tableSessionId ? () => this.ensureVisitOpen(tenantId, outletId, tableSessionId) : undefined,
      ),
    );
  }

  private ensureVisitOpen(tenantId: string, outletId: string, visitId: string) {
    if (!this.visits) throw new Error("The table visit source is not wired.");
    return this.visits.ensureOpen(tenantId, outletId, visitId);
  }

  async decideGuestOrder(
    tenantId: string,
    outletId: string,
    orderId: string,
    decision: "ACCEPTED" | "REJECTED",
    reason: string | null,
    context: OrderMutationContext,
  ) {
    const order = await this.orders.decideGuestOrder(
      tenantId,
      outletId,
      orderId,
      decision,
      reason,
      (visitId) => this.ensureVisitOpen(tenantId, outletId, visitId),
      context,
    );
    if (!order)
      throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Order not found." });
    return toOrder(order);
  }

  pendingBySession(tenantId: string, outletId: string) {
    return this.orders.pendingBySession(tenantId, outletId);
  }

  /** The orders of one table session, oldest first, canceled ones included. */
  async listBySession(tenantId: string, outletId: string, tableSessionId: string) {
    return (await this.orders.listBySession(tenantId, outletId, tableSessionId)).map(toOrder);
  }

  /** Orders of the outlet created in the last `hours` hours, newest first. */
  async listRecent(tenantId: string, outletId: string, hours: number, limit: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return (await this.orders.listSince(tenantId, outletId, since, limit)).map(toOrder);
  }

  /**
   * Cancels an order with a reason. The caller decides whether the order may
   * still be canceled (for example, that it is unpaid); that check runs while
   * the order is locked.
   */
  async cancelOrder(
    tenantId: string,
    outletId: string,
    orderId: string,
    reason: string,
    ensureCancellable: () => Promise<void>,
    context: OrderMutationContext,
  ) {
    const order = await this.orders.cancel(
      tenantId,
      outletId,
      orderId,
      reason,
      ensureCancellable,
      context,
    );
    if (!order) {
      throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Order not found." });
    }
    return toOrder(order);
  }

  /**
   * Follows the kitchen. Progress only goes forward: a late or repeated
   * announcement leaves the order as it is, and so does one about a canceled
   * order. An order that does not exist is not an error for the kitchen.
   */
  recordKitchenProgress(tenantId: string, orderId: string, progress: KitchenProgress) {
    return this.orders.moveStatus(tenantId, orderId, statusesBefore(progress), progress);
  }

  async getOrder(tenantId: string, outletId: string, orderId: string) {
    const order = await this.orders.findById(tenantId, outletId, orderId);
    if (!order) {
      throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Order not found." });
    }
    return toOrder(order);
  }
}
