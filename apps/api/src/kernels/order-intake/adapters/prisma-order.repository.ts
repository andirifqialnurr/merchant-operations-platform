import type { OrderStatus } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { ConflictException, Injectable } from "@nestjs/common";

import { lockTableVisit } from "../../../shared/command/lock-table-visit.js";

import { buildAuditMetadata } from "../../../core/audit/public.js";
import type {
  NewSubmittedOrder,
  OrderMutationContext,
  OrderSubmitContext,
  OrderRecord,
  OrderRepository,
} from "../application/order.repository.js";
import { eventOrigin } from "../../../shared/command/command-origin.js";
import { safeEventPayload } from "../../../shared/command/event-payload.js";

const orderSelect = {
  moderationStatus: true,
  cancelReason: true,
  canceledAt: true,
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
  tableSessionId: true,
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

  async pendingBySession(tenantId: string, outletId: string) {
    const rows = await getPrismaClient().order.groupBy({
      by: ["tableSessionId"],
      _count: { _all: true },
      where: {
        tenantId,
        outletId,
        source: "SELF_ORDER",
        status: "SUBMITTED",
        moderationStatus: "PENDING",
        tableSessionId: { not: null },
      },
    });
    return new Map(
      rows.flatMap((row) =>
        row.tableSessionId ? [[row.tableSessionId, row._count._all] as const] : [],
      ),
    );
  }

  async listBySession(tenantId: string, outletId: string, tableSessionId: string) {
    return getPrismaClient().order.findMany({
      orderBy: { createdAt: "asc" },
      select: orderSelect,
      where: { outletId, tableSessionId, tenantId },
    });
  }

  async listSince(tenantId: string, outletId: string, since: Date, limit: number) {
    return getPrismaClient().order.findMany({
      orderBy: { createdAt: "desc" },
      select: orderSelect,
      take: limit,
      where: { createdAt: { gte: since }, outletId, tenantId },
    });
  }

  async cancel(
    tenantId: string,
    outletId: string,
    orderId: string,
    reason: string,
    ensureCancellable: () => Promise<void>,
    context: OrderMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const before = await transaction.order.findFirst({
        select: { tableSessionId: true },
        where: { id: orderId, outletId, tenantId },
      });
      await lockTableVisit(transaction, tenantId, before?.tableSessionId ?? null);
      // Locks the order row. Taking a payment touches the same row first, so
      // the paid check below sees every payment committed before this lock,
      // and a payment that comes later finds the order canceled.
      const lock = await transaction.order.updateMany({
        data: { updatedAt: new Date() },
        where: { id: orderId, outletId, status: { not: "CANCELED" }, tenantId },
      });
      if (lock.count !== 1) {
        return transaction.order.findFirst({
          select: orderSelect,
          where: { id: orderId, outletId, tenantId },
        });
      }
      await ensureCancellable();

      const canceledAt = new Date();
      const current = await transaction.order.findFirstOrThrow({
        select: { moderationStatus: true },
        where: { id: orderId, outletId, tenantId },
      });
      await transaction.order.updateMany({
        data: {
          ...(current.moderationStatus === "PENDING"
            ? {
                moderationStatus: "REJECTED",
                moderatedAt: canceledAt,
                moderatedBy: context.actorId,
              }
            : {}),
          cancelReason: reason,
          canceledAt,
          canceledBy: context.actorId,
          status: "CANCELED",
        },
        where: { id: orderId, outletId, tenantId },
      });
      const payload = { canceledAt: canceledAt.toISOString(), orderId, reason };
      await transaction.auditLog.create({
        data: {
          action: "order.cancel",
          actorId: context.actorId,
          entityId: orderId,
          entityType: "order_order",
          metadata: buildAuditMetadata("order.cancel", payload),
          outletId,
          ...(context.requestId ? { requestId: context.requestId } : {}),
          tenantId,
        },
      });
      await transaction.outboxEvent.create({
        data: {
          ...eventOrigin(context, "CORE_ORDER"),
          aggregateId: orderId,
          aggregateType: "order_order",
          outletId,
          payload: safeEventPayload(payload),
          tenantId,
          type: "order.canceled.v1",
        },
      });
      return transaction.order.findUniqueOrThrow({
        select: orderSelect,
        where: { tenantId_id: { id: orderId, tenantId } },
      });
    });
  }

  async decideGuestOrder(
    tenantId: string,
    outletId: string,
    orderId: string,
    decision: "ACCEPTED" | "REJECTED",
    reason: string | null,
    ensureVisitOpen: (visitId: string) => Promise<void>,
    context: OrderMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const before = await transaction.order.findFirst({
        select: { tableSessionId: true },
        where: { id: orderId, outletId, tenantId },
      });
      if (!before) return null;
      await lockTableVisit(transaction, tenantId, before.tableSessionId);
      await transaction.$queryRaw`SELECT id FROM order_orders WHERE id = ${orderId}::uuid AND tenant_id = ${tenantId}::uuid AND outlet_id = ${outletId}::uuid FOR UPDATE`;
      const current = await transaction.order.findFirstOrThrow({
        select: orderSelect,
        where: { id: orderId, outletId, tenantId },
      });
      if (current.moderationStatus === decision) return current;
      if (
        current.source !== "SELF_ORDER" ||
        current.moderationStatus !== "PENDING" ||
        current.status !== "SUBMITTED" ||
        !current.tableSessionId
      ) {
        throw new ConflictException({
          code: "SELF_ORDER_ALREADY_DECIDED",
          message: "This order cannot be moderated.",
        });
      }
      await ensureVisitOpen(current.tableSessionId);
      const now = new Date();
      await transaction.order.update({
        data: {
          moderationStatus: decision,
          moderatedAt: now,
          moderatedBy: context.actorId,
          ...(decision === "REJECTED"
            ? {
                status: "CANCELED",
                canceledAt: now,
                canceledBy: context.actorId,
                cancelReason: reason,
              }
            : {}),
        },
        where: { tenantId_id: { tenantId, id: orderId } },
      });
      const payload =
        decision === "ACCEPTED"
          ? {
              orderId,
              orderNumber: current.orderNumber,
              orderType: current.orderType,
              source: current.source,
              itemCount: current.items.length,
              submittedAt: current.submittedAt!.toISOString(),
            }
          : { orderId, canceledAt: now.toISOString() };
      const action = decision === "ACCEPTED" ? "order.guest_accept" : "order.guest_reject";
      await transaction.auditLog.create({
        data: {
          tenantId,
          outletId,
          actorId: context.actorId,
          entityId: orderId,
          entityType: "order_order",
          action,
          metadata: buildAuditMetadata(action, {
            orderId,
            decision,
            occurredAt: now.toISOString(),
          }),
          ...(context.requestId ? { requestId: context.requestId } : {}),
        },
      });
      await transaction.outboxEvent.create({
        data: {
          ...eventOrigin(context, "CORE_ORDER"),
          tenantId,
          outletId,
          aggregateId: orderId,
          aggregateType: "order_order",
          type: decision === "ACCEPTED" ? "order.submitted.v1" : "order.canceled.v1",
          payload: safeEventPayload(payload),
        },
      });
      return transaction.order.findUniqueOrThrow({
        select: orderSelect,
        where: { tenantId_id: { tenantId, id: orderId } },
      });
    });
  }

  async moveStatus(
    tenantId: string,
    orderId: string,
    from: readonly OrderStatus[],
    to: OrderStatus,
  ) {
    const moved = await getPrismaClient().order.updateMany({
      data: { status: to },
      where: {
        id: orderId,
        moderationStatus: { in: ["NOT_REQUIRED", "ACCEPTED"] },
        status: { in: [...from] },
        tenantId,
      },
    });
    if (moved.count === 1) return "moved" as const;
    const exists = await getPrismaClient().order.findFirst({
      select: { id: true },
      where: { id: orderId, tenantId },
    });
    return exists ? ("unchanged" as const) : ("missing" as const);
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
    context: OrderSubmitContext,
    ensureVisitOpen?: () => Promise<void>,
  ): Promise<OrderRecord> {
    const { outletId, tenantId } = order;
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        await lockTableVisit(transaction, tenantId, order.tableSessionId);
        // Replays retain their original snapshot, even after a visit closes.
        const replay = await transaction.order.findUnique({
          select: orderSelect,
          where: {
            tenantId_outletId_idempotencyKey: {
              tenantId,
              outletId,
              idempotencyKey: order.idempotencyKey,
            },
          },
        });
        if (replay) {
          if (replay.tableSessionId !== order.tableSessionId || replay.source !== order.source)
            throw new ConflictException({
              code: "IDEMPOTENCY_KEY_CONFLICT",
              message: "This key belongs to another order context.",
            });
          return replay;
        }
        if (order.tableSessionId) {
          if (!ensureVisitOpen) throw new Error("Table orders require a visit guard.");
          await ensureVisitOpen();
        }
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
            ...(context.actorId ? { actorId: context.actorId } : {}),
            currency: order.currency,
            idempotencyKey: order.idempotencyKey,
            note: order.note,
            orderNumber: counter.lastNumber,
            orderType: order.orderType,
            outletId,
            source: order.source,
            moderationStatus: order.source === "SELF_ORDER" ? "PENDING" : "NOT_REQUIRED",
            status: "SUBMITTED",
            submittedAt,
            tableSessionId: order.tableSessionId,
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
            ...(context.actorId ? { actorId: context.actorId } : {}),
            entityId: created.id,
            entityType: "order_order",
            metadata: buildAuditMetadata("order.submit", payload),
            outletId,
            ...(context.requestId ? { requestId: context.requestId } : {}),
            tenantId,
          },
        });
        if (created.moderationStatus !== "PENDING")
          await transaction.outboxEvent.create({
            data: {
              ...eventOrigin(context, "CORE_ORDER"),
              aggregateId: created.id,
              aggregateType: "order_order",
              outletId,
              payload: safeEventPayload(payload),
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
      if (existing) {
        if (existing.tableSessionId !== order.tableSessionId || existing.source !== order.source)
          throw new ConflictException({
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "This key belongs to another order context.",
          });
        return existing;
      }
      throw error;
    }
  }
}
