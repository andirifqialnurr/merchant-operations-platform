import { orderSchema, type CreatePosOrder, type Order } from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { CatalogService } from "../../../catalog/catalog.service.js";
import { priceOrderLines } from "../domain/price-order.js";
import {
  ORDER_REPOSITORY,
  type OrderMutationContext,
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
    orderNumber: record.orderNumber,
    orderType: record.orderType,
    outletId: record.outletId,
    source: record.source,
    status: record.status,
    submittedAt: record.submittedAt?.toISOString() ?? null,
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
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  async submitPosOrder(
    tenantId: string,
    outletId: string,
    input: CreatePosOrder,
    idempotencyKey: string,
    context: OrderMutationContext,
  ) {
    // A retry returns the order already taken, priced as it was then.
    const existing = await this.orders.findByIdempotencyKey(tenantId, outletId, idempotencyKey);
    if (existing) return toOrder(existing);

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
          source: "POS",
          tenantId,
        },
        context,
      ),
    );
  }

  async getOrder(tenantId: string, outletId: string, orderId: string) {
    const order = await this.orders.findById(tenantId, outletId, orderId);
    if (!order) {
      throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Order not found." });
    }
    return toOrder(order);
  }
}
