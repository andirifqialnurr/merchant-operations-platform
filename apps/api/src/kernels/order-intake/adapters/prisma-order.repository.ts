import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../audit/critical-action-audit.js";
import type {
  NewSubmittedOrder,
  OrderMutationContext,
  OrderRecord,
  OrderRepository,
} from "../application/order.repository.js";

const orderSelect = {
  createdAt: true,
  currency: true,
  id: true,
  items: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      lineTotalMinor: true,
      modifiers: {
        orderBy: { position: "asc" },
        select: { groupNameSnapshot: true, optionNameSnapshot: true, priceDeltaMinor: true },
      },
      nameSnapshot: true,
      note: true,
      productId: true,
      quantity: true,
      unitPriceMinor: true,
      variantNameSnapshot: true,
    },
  },
  note: true,
  orderNumber: true,
  orderType: true,
  outletId: true,
  source: true,
  status: true,
  submittedAt: true,
  tenantId: true,
} as const;

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  async findById(tenantId: string, outletId: string, orderId: string): Promise<OrderRecord | null> {
    return getPrismaClient().order.findFirst({
      select: orderSelect,
      where: { id: orderId, outletId, tenantId },
    });
  }

  async findByIdempotencyKey(
    tenantId: string,
    outletId: string,
    idempotencyKey: string,
  ): Promise<OrderRecord | null> {
    return getPrismaClient().order.findUnique({
      select: orderSelect,
      where: { tenantId_outletId_idempotencyKey: { idempotencyKey, outletId, tenantId } },
    });
  }

  async createSubmitted(
    order: NewSubmittedOrder,
    context: OrderMutationContext,
  ): Promise<OrderRecord> {
    const { outletId, tenantId } = order;
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        // The counter row is locked by the update, so concurrent orders queue here.
        const counter = await transaction.orderNumberCounter.upsert({
          create: { lastNumber: 1, outletId, tenantId },
          select: { lastNumber: true },
          update: { lastNumber: { increment: 1 } },
          where: { tenantId_outletId: { outletId, tenantId } },
        });
        const submittedAt = new Date();
        // Lines are written with explicit tenant keys: every relation here is a
        // composite (tenant_id, id) foreign key.
        const header = await transaction.order.create({
          data: {
            actorId: context.actorId,
            currency: order.currency,
            idempotencyKey: order.idempotencyKey,
            note: order.note,
            orderNumber: counter.lastNumber,
            orderType: order.orderType,
            outletId,
            source: order.source,
            status: "SUBMITTED",
            submittedAt,
            tenantId,
          },
          select: { id: true },
        });
        const items = await transaction.orderItem.createManyAndReturn({
          data: order.lines.map((line, position) => ({
            lineTotalMinor: line.lineTotalMinor,
            nameSnapshot: line.name,
            note: line.note,
            orderId: header.id,
            position,
            productId: line.productId,
            quantity: line.quantity,
            tenantId,
            unitPriceMinor: line.unitPriceMinor,
            variantNameSnapshot: line.variantName,
          })),
          select: { id: true, position: true },
        });
        const itemIds = new Map(items.map((item) => [item.position, item.id]));
        await transaction.orderItemModifier.createMany({
          data: order.lines.flatMap((line, position) =>
            line.modifiers.map((modifier, modifierPosition) => ({
              groupNameSnapshot: modifier.groupName,
              optionNameSnapshot: modifier.optionName,
              orderItemId: itemIds.get(position)!,
              position: modifierPosition,
              priceDeltaMinor: modifier.priceDeltaMinor,
              tenantId,
            })),
          ),
        });
        const created = await transaction.order.findUniqueOrThrow({
          select: orderSelect,
          where: { tenantId_id: { id: header.id, tenantId } },
        });

        const payload = {
          itemCount: created.items.length,
          orderId: created.id,
          orderNumber: created.orderNumber,
          orderType: created.orderType,
          source: created.source,
          submittedAt: submittedAt.toISOString(),
        };
        await transaction.auditLog.create({
          data: {
            action: "order.submit",
            actorId: context.actorId,
            entityId: created.id,
            entityType: "order_order",
            metadata: buildAuditMetadata("order.submit", payload),
            outletId,
            ...(context.requestId ? { requestId: context.requestId } : {}),
            tenantId,
          },
        });
        await transaction.outboxEvent.create({
          data: {
            aggregateId: created.id,
            aggregateType: "order_order",
            outletId,
            payload,
            tenantId,
            type: "order.submitted.v1",
          },
        });
        return created;
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // Either a concurrent retry with the same key, or the first order of an
      // outlet racing to create its counter. The key tells which.
      const existing = await this.findByIdempotencyKey(tenantId, outletId, order.idempotencyKey);
      if (existing) return existing;
      throw error;
    }
  }
}
