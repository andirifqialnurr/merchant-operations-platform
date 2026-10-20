import { getPrismaClient } from "@merchant/database";
import { ConflictException, Injectable } from "@nestjs/common";
import { isOrderApproved } from "@merchant/contracts";

import { lockTableVisit } from "../../../shared/command/lock-table-visit.js";

import { buildAuditMetadata } from "../../../core/audit/public.js";
import type {
  NewRefund,
  PaidOrderState,
  RefundOutcome,
  BillingMutationContext,
  BillingRepository,
  CheckoutRecord,
  FullPayment,
  FullPaymentOutcome,
  NewPaymentClaim,
  PaymentClaimRecord,
  SessionCheckoutRecord,
  SessionPayment,
  SessionPaymentOutcome,
} from "../application/billing.repository.js";
import { eventOrigin, type CommandOrigin } from "../../../shared/command/command-origin.js";
import { safeEventPayload } from "../../../shared/command/event-payload.js";
import { billSelect, paymentSelect, saleSelect, refundSelect } from "./billing-record-selects.js";

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];

/** Recheck under the visit lock: new rounds/decisions cannot slip into a stale total. */
async function ensureVisitOrders(
  transaction: Transaction,
  tenantId: string,
  outletId: string,
  visitId: string,
  expectedIds: readonly string[],
) {
  const orders = await transaction.order.findMany({
    select: { id: true, moderationStatus: true },
    where: {
      tenantId,
      outletId,
      tableSessionId: visitId,
      status: { not: "CANCELED" },
      OR: [{ bill: null }, { bill: { status: "UNPAID" } }],
    },
  });
  if (orders.some((order) => !isOrderApproved(order)))
    throw new ConflictException({
      code: "SELF_ORDER_PENDING",
      message: "Decide pending orders before payment.",
    });
  if (
    orders.length !== expectedIds.length ||
    orders.some((order) => !expectedIds.includes(order.id))
  )
    throw new ConflictException({
      code: "ORDER_TOTAL_CHANGED",
      message: "The visit's orders changed. Check its total again.",
    });
}

/** Thrown inside a transaction to undo a table visit's payment when a bill does not match. */
class SessionBillMismatch extends Error {}

/** Thrown inside a transaction when the claim being confirmed is no longer as the cashier saw it. */
class ClaimChanged extends Error {}

const claimSelect = {
  amountMinor: true,
  createdAt: true,
  id: true,
  method: true,
  status: true,
  tableSessionId: true,
} as const;

function toClaim(row: {
  amountMinor: bigint;
  createdAt: Date;
  id: string;
  method: string;
  status: PaymentClaimRecord["status"];
  tableSessionId: string | null;
}): PaymentClaimRecord {
  return {
    amountMinor: row.amountMinor,
    claimedAt: row.createdAt,
    id: row.id,
    method: row.method as PaymentClaimRecord["method"],
    status: row.status,
    tableSessionId: row.tableSessionId ?? "",
  };
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

@Injectable()
export class PrismaBillingRepository implements BillingRepository {
  async findCheckoutByIdempotencyKey(
    tenantId: string,
    outletId: string,
    idempotencyKey: string,
  ): Promise<CheckoutRecord | null> {
    const row = await getPrismaClient().billingPayment.findUnique({
      select: {
        ...paymentSelect,
        allocations: {
          select: { bill: { select: { ...billSelect, sale: { select: saleSelect } } } },
          take: 1,
        },
      },
      where: { tenantId_outletId_idempotencyKey: { idempotencyKey, outletId, tenantId } },
    });
    const billed = row?.allocations[0]?.bill;
    if (!row || !billed?.sale) return null;
    const { sale, ...bill } = billed;
    return {
      bill,
      payment: {
        amountMinor: row.amountMinor,
        confirmedAt: row.confirmedAt,
        id: row.id,
        method: row.method,
        reference: row.reference,
        status: row.status,
        tenderedMinor: row.tenderedMinor,
      },
      sale,
    };
  }

  async findSessionCheckoutByIdempotencyKey(
    tenantId: string,
    outletId: string,
    idempotencyKey: string,
  ): Promise<SessionCheckoutRecord | null> {
    const row = await getPrismaClient().billingPayment.findUnique({
      select: {
        ...paymentSelect,
        allocations: {
          orderBy: { createdAt: "asc" },
          select: { bill: { select: { ...billSelect, sale: { select: saleSelect } } } },
        },
      },
      where: { tenantId_outletId_idempotencyKey: { idempotencyKey, outletId, tenantId } },
    });
    if (!row) return null;
    const checkouts = row.allocations.flatMap(({ bill: { sale, ...bill } }) =>
      sale ? [{ bill, sale }] : [],
    );
    if (checkouts.length === 0) return null;
    const { allocations: _allocations, ...payment } = row;
    void _allocations;
    return { checkouts, payment };
  }

  async recordSessionPayment(
    payment: SessionPayment,
    context: BillingMutationContext,
  ): Promise<SessionPaymentOutcome> {
    const { outletId, tenantId } = payment;
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        await lockTableVisit(transaction, tenantId, payment.tableSessionId);
        const replay = await this.findSessionCheckoutByIdempotencyKey(
          tenantId,
          outletId,
          payment.idempotencyKey,
        );
        if (replay) {
          if (replay.checkouts.some(({ bill }) => bill.tableSessionId !== payment.tableSessionId))
            throw new ConflictException({
              code: "IDEMPOTENCY_KEY_REUSED",
              message: "This payment key belongs to another visit.",
            });
          return { kind: "recorded", checkout: replay };
        }
        await ensureVisitOrders(
          transaction,
          tenantId,
          outletId,
          payment.tableSessionId,
          payment.bills.map((bill) => bill.orderId),
        );
        // The same shift lock as a single payment: a closing shift either
        // counts this payment or refuses it.
        const shift = await transaction.posRegisterSession.updateMany({
          data: { updatedAt: new Date() },
          where: { id: payment.registerSessionId, outletId, status: "OPEN", tenantId },
        });
        if (shift.count !== 1) return { kind: "shift_not_open" as const };

        // Every order is locked before anything is written, so a canceled or
        // paid one stops the whole payment without leaving half of it behind.
        for (const line of payment.bills) {
          const order = await transaction.order.updateMany({
            data: { updatedAt: new Date() },
            where: {
              id: line.orderId,
              outletId,
              moderationStatus: { in: ["NOT_REQUIRED", "ACCEPTED"] },
              status: { not: "CANCELED" },
              tenantId,
            },
          });
          if (order.count !== 1) return { kind: "order_canceled" as const };
        }
        const existing = await transaction.bill.findMany({
          select: { id: true, orderId: true, status: true },
          where: { orderId: { in: payment.bills.map((line) => line.orderId) }, tenantId },
        });
        if (existing.some((bill) => bill.status !== "UNPAID")) {
          return { kind: "bill_already_paid" as const };
        }
        const existingByOrder = new Map(existing.map((bill) => [bill.orderId, bill.id]));

        const now = new Date();
        const billIds: string[] = [];
        for (const line of payment.bills) {
          const billId =
            existingByOrder.get(line.orderId) ??
            (
              await transaction.bill.create({
                data: {
                  chargesIncluded: payment.charges.included,
                  currency: payment.currency,
                  orderId: line.orderId,
                  outletId,
                  serviceChargeMinor: line.serviceChargeMinor,
                  serviceChargeRateBp: payment.charges.serviceChargeRateBp,
                  subtotalMinor: line.subtotalMinor,
                  tableSessionId: payment.tableSessionId,
                  taxMinor: line.taxMinor,
                  taxRateBp: payment.charges.taxRateBp,
                  tenantId,
                  totalMinor: line.totalMinor,
                },
                select: { id: true },
              })
            ).id;
          const settled = await transaction.bill.updateMany({
            data: {
              paidMinor: line.totalMinor,
              status: "PAID",
              tableSessionId: payment.tableSessionId,
            },
            where: { id: billId, status: "UNPAID", tenantId, totalMinor: line.totalMinor },
          });
          // A bill made earlier with another total: undo everything.
          if (settled.count !== 1) throw new SessionBillMismatch();
          billIds.push(billId);
        }

        let paid;
        if (payment.claimId) {
          // The guest's claim becomes this payment: the money is counted once,
          // in the confirming cashier's shift.
          const confirmed = await transaction.billingPayment.updateMany({
            data: {
              actorId: context.actorId,
              confirmedAt: now,
              confirmedBy: context.actorId,
              idempotencyKey: payment.idempotencyKey,
              reference: payment.reference,
              registerSessionId: payment.registerSessionId,
              status: "PAID",
            },
            where: {
              amountMinor: payment.totalMinor,
              id: payment.claimId,
              method: payment.method,
              outletId,
              status: "VERIFYING",
              tableSessionId: payment.tableSessionId,
              tenantId,
            },
          });
          if (confirmed.count !== 1) throw new ClaimChanged();
          paid = await transaction.billingPayment.findUniqueOrThrow({
            select: paymentSelect,
            where: { tenantId_id: { id: payment.claimId, tenantId } },
          });
        } else {
          paid = await transaction.billingPayment.create({
            data: {
              actorId: context.actorId,
              amountMinor: payment.totalMinor,
              confirmedAt: now,
              confirmedBy: context.actorId,
              idempotencyKey: payment.idempotencyKey,
              method: payment.method,
              outletId,
              reference: payment.reference,
              registerSessionId: payment.registerSessionId,
              status: "PAID",
              tenantId,
              tenderedMinor: payment.tenderedMinor,
            },
            select: paymentSelect,
          });
        }

        const checkouts: SessionCheckoutRecord["checkouts"] = [];
        for (const [index, line] of payment.bills.entries()) {
          const billId = billIds[index]!;
          await transaction.paymentAllocation.create({
            data: { amountMinor: line.totalMinor, billId, paymentId: paid.id, tenantId },
          });
          const counter = await transaction.saleNumberCounter.upsert({
            create: { lastNumber: 1, outletId, tenantId },
            select: { lastNumber: true },
            update: { lastNumber: { increment: 1 } },
            where: { tenantId_outletId: { outletId, tenantId } },
          });
          const sale = await transaction.sale.create({
            data: {
              billId,
              completedAt: now,
              outletId,
              saleNumber: counter.lastNumber,
              status: "COMPLETED",
              tenantId,
              totalMinor: line.totalMinor,
            },
            select: saleSelect,
          });
          const bill = await transaction.bill.findUniqueOrThrow({
            select: billSelect,
            where: { tenantId_id: { id: billId, tenantId } },
          });
          checkouts.push({ bill, sale });

          // Each order's share is told like a payment of its own, so whoever
          // listens hears the same thing for a table as for the counter.
          const payload = {
            amountMinor: line.totalMinor.toString(),
            billId,
            method: payment.method,
            orderId: line.orderId,
            paymentId: paid.id,
            shiftId: payment.registerSessionId,
            saleId: sale.id,
            saleNumber: sale.saleNumber,
          };
          await transaction.auditLog.create({
            data: {
              action: "payment.record",
              actorId: context.actorId,
              entityId: paid.id,
              entityType: "billing_payment",
              metadata: buildAuditMetadata("payment.record", payload),
              outletId,
              ...(context.requestId ? { requestId: context.requestId } : {}),
              tenantId,
            },
          });
          await transaction.outboxEvent.createMany({
            data: [
              {
                ...eventOrigin(context, "CORE_PAYMENT_LEDGER"),
                aggregateId: paid.id,
                aggregateType: "billing_payment",
                outletId,
                payload: safeEventPayload(payload),
                tenantId,
                type: "payment.recorded.v1",
              },
              {
                ...eventOrigin(context, "CORE_BILL"),
                aggregateId: sale.id,
                aggregateType: "sales_sale",
                outletId,
                payload: safeEventPayload({
                  completedAt: now.toISOString(),
                  currency: payment.currency,
                  orderId: line.orderId,
                  saleId: sale.id,
                  saleNumber: sale.saleNumber,
                  totalMinor: line.totalMinor.toString(),
                }),
                tenantId,
                type: "sale.completed.v1",
              },
            ],
          });
        }
        return { checkout: { checkouts, payment: paid }, kind: "recorded" as const };
      });
    } catch (error) {
      if (error instanceof SessionBillMismatch) return { kind: "bill_already_paid" };
      if (error instanceof ClaimChanged) return { kind: "claim_changed" };
      if (!isUniqueConstraintError(error)) throw error;
      const replayed = await this.findSessionCheckoutByIdempotencyKey(
        tenantId,
        outletId,
        payment.idempotencyKey,
      );
      return replayed ? { checkout: replayed, kind: "recorded" } : { kind: "bill_already_paid" };
    }
  }

  async findPaidCheckoutByOrder(tenantId: string, outletId: string, orderId: string) {
    const bill = await getPrismaClient().bill.findFirst({
      select: {
        ...billSelect,
        _count: { select: { allocations: true } },
        allocations: {
          orderBy: { createdAt: "asc" },
          select: {
            amountMinor: true,
            payment: {
              select: {
                ...paymentSelect,
                actor: { select: { displayName: true } },
                _count: { select: { allocations: true } },
              },
            },
          },
          take: 1,
        },
        sale: { select: saleSelect },
      },
      where: { orderId, outletId, status: "PAID", tenantId },
    });
    const allocation = bill?.allocations[0];
    const paid = allocation?.payment;
    // A paid payment always has its cashier; only an undecided claim has none.
    if (!bill?.sale || !paid?.actor || !allocation) return null;
    const { actor, _count, ...payment } = paid;
    return {
      allocation: {
        amountMinor: allocation.amountMinor,
        billAllocationCount: bill._count.allocations,
        paymentAllocationCount: _count.allocations,
      },
      bill: {
        chargesIncluded: bill.chargesIncluded,
        currency: bill.currency,
        discountMinor: bill.discountMinor,
        id: bill.id,
        orderId: bill.orderId,
        paidMinor: bill.paidMinor,
        roundingMinor: bill.roundingMinor,
        serviceChargeMinor: bill.serviceChargeMinor,
        tableSessionId: bill.tableSessionId,
        serviceChargeRateBp: bill.serviceChargeRateBp,
        status: bill.status,
        subtotalMinor: bill.subtotalMinor,
        taxMinor: bill.taxMinor,
        taxRateBp: bill.taxRateBp,
        totalMinor: bill.totalMinor,
      },
      cashierName: actor.displayName,
      payment,
      sale: bill.sale,
    };
  }

  async paidOrders(tenantId: string, orderIds: readonly string[]) {
    if (orderIds.length === 0) return new Map<string, PaidOrderState>();
    const bills = await getPrismaClient().bill.findMany({
      select: {
        orderId: true,
        sale: { select: { saleNumber: true, status: true } },
        totalMinor: true,
      },
      where: { orderId: { in: [...orderIds] }, status: "PAID", tenantId },
    });
    return new Map(
      bills.flatMap((bill) =>
        bill.sale
          ? [
              [
                bill.orderId,
                {
                  saleNumber: bill.sale.saleNumber,
                  saleStatus: bill.sale.status,
                  totalMinor: bill.totalMinor,
                },
              ] as const,
            ]
          : [],
      ),
    );
  }

  async refundsOfSale(tenantId: string, saleId: string) {
    return getPrismaClient().saleRefund.findMany({
      orderBy: { createdAt: "asc" },
      select: refundSelect,
      where: { saleId, tenantId },
    });
  }

  async findRefundByIdempotencyKey(tenantId: string, outletId: string, idempotencyKey: string) {
    const row = await getPrismaClient().saleRefund.findUnique({
      select: {
        sale: { select: { ...saleSelect, bill: { select: { orderId: true } } } },
        saleId: true,
      },
      where: { tenantId_outletId_idempotencyKey: { idempotencyKey, outletId, tenantId } },
    });
    if (!row) return null;
    const { bill, ...sale } = row.sale;
    return {
      orderId: bill.orderId,
      result: { refunds: await this.refundsOfSale(tenantId, row.saleId), sale },
    };
  }

  async sumRefundsByMethod(tenantId: string, registerSessionId: string) {
    const groups = await getPrismaClient().saleRefund.groupBy({
      _sum: { amountMinor: true },
      by: ["method"],
      where: { registerSessionId, tenantId },
    });
    return new Map(groups.map((group) => [group.method, group._sum.amountMinor ?? 0n] as const));
  }

  async recordRefund(refund: NewRefund, context: BillingMutationContext): Promise<RefundOutcome> {
    const { outletId, tenantId } = refund;
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        // Same shift lock as payments and closing, so a cash refund is always
        // part of the shift it is paid out in.
        const shift = await transaction.posRegisterSession.updateMany({
          data: { updatedAt: new Date() },
          where: { id: refund.registerSessionId, outletId, status: "OPEN", tenantId },
        });
        if (shift.count !== 1) return { kind: "shift_not_open" };

        // Locks the sale so two refunds cannot both pass the amount check.
        await transaction.sale.updateMany({
          data: { updatedAt: new Date() },
          where: { id: refund.saleId, tenantId },
        });
        const sale = await transaction.sale.findUniqueOrThrow({
          select: { totalMinor: true },
          where: { tenantId_id: { id: refund.saleId, tenantId } },
        });
        const refunded = await transaction.saleRefund.aggregate({
          _sum: { amountMinor: true },
          where: { saleId: refund.saleId, tenantId },
        });
        const refundableMinor = sale.totalMinor - (refunded._sum.amountMinor ?? 0n);
        if (refund.amountMinor > refundableMinor) {
          return { kind: "exceeds_refundable", refundableMinor };
        }

        const created = await transaction.saleRefund.create({
          data: {
            actorId: context.actorId,
            amountMinor: refund.amountMinor,
            ...(refund.approvedBy ? { approvedBy: refund.approvedBy.userId } : {}),
            idempotencyKey: refund.idempotencyKey,
            method: refund.method,
            outletId,
            paymentId: refund.paymentId,
            reason: refund.reason,
            registerSessionId: refund.registerSessionId,
            saleId: refund.saleId,
            tenantId,
          },
          select: refundSelect,
        });
        const fully = refund.amountMinor === refundableMinor;
        const updated = await transaction.sale.update({
          data: { status: fully ? "REFUNDED" : "PARTIALLY_REFUNDED" },
          select: saleSelect,
          where: { tenantId_id: { id: refund.saleId, tenantId } },
        });

        const payload = {
          amountMinor: refund.amountMinor.toString(),
          method: refund.method,
          reason: refund.reason,
          refundId: created.id,
          saleId: refund.saleId,
          saleNumber: updated.saleNumber,
          shiftId: refund.registerSessionId,
          ...(refund.approvedBy ? { approvedByUserId: refund.approvedBy.userId } : {}),
        };
        await transaction.auditLog.create({
          data: {
            action: "sale.refund",
            actorId: context.actorId,
            entityId: refund.saleId,
            entityType: "sales_sale",
            // The trail names the approver as they were called at the time; events carry the ID only.
            metadata: buildAuditMetadata("sale.refund", {
              ...payload,
              ...(refund.approvedBy ? { approvedByName: refund.approvedBy.displayName } : {}),
            }),
            outletId,
            ...(context.requestId ? { requestId: context.requestId } : {}),
            tenantId,
          },
        });
        await transaction.outboxEvent.create({
          data: {
            ...eventOrigin(context, "CORE_BILL"),
            aggregateId: refund.saleId,
            aggregateType: "sales_sale",
            outletId,
            payload: safeEventPayload(payload),
            tenantId,
            type: "sale.refunded.v1",
          },
        });
        const refunds = await transaction.saleRefund.findMany({
          orderBy: { createdAt: "asc" },
          select: refundSelect,
          where: { saleId: refund.saleId, tenantId },
        });
        return { kind: "recorded", result: { refunds, sale: updated } };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const replayed = await this.findRefundByIdempotencyKey(
        tenantId,
        outletId,
        refund.idempotencyKey,
      );
      if (!replayed) throw error;
      return { kind: "recorded", result: replayed.result };
    }
  }

  async claimPayment(claim: NewPaymentClaim, origin: CommandOrigin): Promise<PaymentClaimRecord> {
    const { outletId, tenantId } = claim;
    const waiting = () =>
      getPrismaClient().billingPayment.findFirst({
        select: claimSelect,
        where: { status: "VERIFYING", tableSessionId: claim.tableSessionId, tenantId },
      });
    const existing = await waiting();
    if (existing) return toClaim(existing);
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        await lockTableVisit(transaction, tenantId, claim.tableSessionId);
        await ensureVisitOrders(
          transaction,
          tenantId,
          outletId,
          claim.tableSessionId,
          claim.orderIds,
        );
        const row = await transaction.billingPayment.create({
          data: {
            amountMinor: claim.amountMinor,
            idempotencyKey: claim.idempotencyKey,
            method: claim.method,
            outletId,
            status: "VERIFYING",
            tableSessionId: claim.tableSessionId,
            tenantId,
          },
          select: claimSelect,
        });
        const payload = {
          amountMinor: row.amountMinor.toString(),
          method: row.method,
          paymentId: row.id,
        };
        await transaction.auditLog.create({
          data: {
            action: "payment.claim",
            entityId: row.id,
            entityType: "billing_payment",
            metadata: buildAuditMetadata("payment.claim", payload),
            outletId,
            ...(origin.requestId ? { requestId: origin.requestId } : {}),
            tenantId,
          },
        });
        await transaction.outboxEvent.create({
          data: {
            ...eventOrigin(origin, "CORE_PAYMENT_LEDGER"),
            aggregateId: row.id,
            aggregateType: "billing_payment",
            outletId,
            payload: safeEventPayload(payload),
            tenantId,
            type: "payment.claimed.v1",
          },
        });
        return toClaim(row);
      });
    } catch (error) {
      // Another tap made the claim a moment earlier: that one stands.
      if (!isUniqueConstraintError(error)) throw error;
      const now = await waiting();
      if (now) return toClaim(now);
      const same = await getPrismaClient().billingPayment.findUnique({
        select: claimSelect,
        where: {
          tenantId_outletId_idempotencyKey: {
            idempotencyKey: claim.idempotencyKey,
            outletId,
            tenantId,
          },
        },
      });
      if (same) return toClaim(same);
      throw error;
    }
  }

  async findClaim(tenantId: string, outletId: string, id: string) {
    const row = await getPrismaClient().billingPayment.findFirst({
      select: claimSelect,
      where: { id, outletId, tableSessionId: { not: null }, tenantId },
    });
    return row ? toClaim(row) : null;
  }

  async verifyingClaims(tenantId: string, outletId: string) {
    const rows = await getPrismaClient().billingPayment.findMany({
      orderBy: { createdAt: "asc" },
      select: claimSelect,
      where: { outletId, status: "VERIFYING", tenantId },
    });
    return rows.map(toClaim);
  }

  async rejectClaim(
    tenantId: string,
    outletId: string,
    id: string,
    now: Date,
    context: BillingMutationContext,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const changed = await transaction.billingPayment.updateMany({
        data: { confirmedAt: now, confirmedBy: context.actorId, status: "FAILED" },
        where: { id, outletId, status: "VERIFYING", tenantId },
      });
      if (changed.count !== 1) return null;
      const row = await transaction.billingPayment.findUniqueOrThrow({
        select: claimSelect,
        where: { tenantId_id: { id, tenantId } },
      });
      const payload = {
        amountMinor: row.amountMinor.toString(),
        method: row.method,
        paymentId: row.id,
      };
      await transaction.auditLog.create({
        data: {
          action: "payment.claim.reject",
          actorId: context.actorId,
          entityId: row.id,
          entityType: "billing_payment",
          metadata: buildAuditMetadata("payment.claim.reject", payload),
          outletId,
          ...(context.requestId ? { requestId: context.requestId } : {}),
          tenantId,
        },
      });
      await transaction.outboxEvent.create({
        data: {
          ...eventOrigin(context, "CORE_PAYMENT_LEDGER"),
          aggregateId: row.id,
          aggregateType: "billing_payment",
          outletId,
          payload: safeEventPayload(payload),
          tenantId,
          type: "payment.claim_rejected.v1",
        },
      });
      return toClaim(row);
    });
  }

  async sumPaymentsByMethod(tenantId: string, registerSessionId: string) {
    const groups = await getPrismaClient().billingPayment.groupBy({
      _sum: { amountMinor: true },
      by: ["method"],
      where: { registerSessionId, status: "PAID", tenantId },
    });
    return new Map(groups.map((group) => [group.method, group._sum.amountMinor ?? 0n] as const));
  }

  async recordFullPayment(
    payment: FullPayment,
    context: BillingMutationContext,
  ): Promise<FullPaymentOutcome> {
    const { outletId, tenantId } = payment;
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const before = await transaction.order.findFirst({
          select: { tableSessionId: true },
          where: { id: payment.orderId, tenantId, outletId },
        });
        await lockTableVisit(transaction, tenantId, before?.tableSessionId ?? null);
        // Locks the shift row for this transaction. Closing a shift takes the
        // same lock before it totals the cash, so a payment is either counted
        // by the close or refused here; it can never fall in between.
        const shift = await transaction.posRegisterSession.updateMany({
          data: { updatedAt: new Date() },
          where: { id: payment.registerSessionId, outletId, status: "OPEN", tenantId },
        });
        if (shift.count !== 1) return { kind: "shift_not_open" };

        // Locks the order the same way cancelling does, so an order is either
        // canceled before it is paid or paid before it is canceled.
        const order = await transaction.order.updateMany({
          data: { updatedAt: new Date() },
          where: { id: payment.orderId, outletId, status: { not: "CANCELED" }, tenantId },
        });
        if (order.count !== 1) return { kind: "order_canceled" };
        const locked = await transaction.order.findFirstOrThrow({
          select: { moderationStatus: true },
          where: { id: payment.orderId, outletId, tenantId },
        });
        if (!isOrderApproved(locked))
          throw new ConflictException({
            code: "SELF_ORDER_PENDING",
            message: "Staff must approve this order before payment.",
          });

        const existing = await transaction.bill.findUnique({
          select: { id: true },
          where: { tenantId_orderId: { orderId: payment.orderId, tenantId } },
        });
        const billId =
          existing?.id ??
          (
            await transaction.bill.create({
              data: {
                chargesIncluded: payment.charges.included,
                currency: payment.currency,
                orderId: payment.orderId,
                outletId,
                serviceChargeMinor: payment.serviceChargeMinor,
                serviceChargeRateBp: payment.charges.serviceChargeRateBp,
                subtotalMinor: payment.subtotalMinor,
                taxMinor: payment.taxMinor,
                taxRateBp: payment.charges.taxRateBp,
                tenantId,
                totalMinor: payment.totalMinor,
              },
              select: { id: true },
            })
          ).id;

        // Guarded by status so two payments can never both settle the bill.
        const settled = await transaction.bill.updateMany({
          data: { paidMinor: payment.totalMinor, status: "PAID" },
          where: { id: billId, status: "UNPAID", tenantId, totalMinor: payment.totalMinor },
        });
        if (settled.count !== 1) return { kind: "bill_already_paid" };

        const now = new Date();
        const paid = await transaction.billingPayment.create({
          data: {
            actorId: context.actorId,
            amountMinor: payment.totalMinor,
            confirmedAt: now,
            confirmedBy: context.actorId,
            idempotencyKey: payment.idempotencyKey,
            method: payment.method,
            outletId,
            reference: payment.reference,
            registerSessionId: payment.registerSessionId,
            status: "PAID",
            tenantId,
            tenderedMinor: payment.tenderedMinor,
          },
          select: paymentSelect,
        });
        await transaction.paymentAllocation.create({
          data: { amountMinor: payment.totalMinor, billId, paymentId: paid.id, tenantId },
        });

        const counter = await transaction.saleNumberCounter.upsert({
          create: { lastNumber: 1, outletId, tenantId },
          select: { lastNumber: true },
          update: { lastNumber: { increment: 1 } },
          where: { tenantId_outletId: { outletId, tenantId } },
        });
        const sale = await transaction.sale.create({
          data: {
            billId,
            completedAt: now,
            outletId,
            saleNumber: counter.lastNumber,
            status: "COMPLETED",
            tenantId,
            totalMinor: payment.totalMinor,
          },
          select: saleSelect,
        });
        const bill = await transaction.bill.findUniqueOrThrow({
          select: billSelect,
          where: { tenantId_id: { id: billId, tenantId } },
        });

        const payload = {
          amountMinor: payment.totalMinor.toString(),
          billId,
          method: payment.method,
          orderId: payment.orderId,
          paymentId: paid.id,
          shiftId: payment.registerSessionId,
          saleId: sale.id,
          saleNumber: sale.saleNumber,
        };
        await transaction.auditLog.create({
          data: {
            action: "payment.record",
            actorId: context.actorId,
            entityId: paid.id,
            entityType: "billing_payment",
            metadata: buildAuditMetadata("payment.record", payload),
            outletId,
            ...(context.requestId ? { requestId: context.requestId } : {}),
            tenantId,
          },
        });
        await transaction.outboxEvent.createMany({
          data: [
            {
              ...eventOrigin(context, "CORE_PAYMENT_LEDGER"),
              aggregateId: paid.id,
              aggregateType: "billing_payment",
              outletId,
              payload: safeEventPayload(payload),
              tenantId,
              type: "payment.recorded.v1",
            },
            {
              ...eventOrigin(context, "CORE_BILL"),
              aggregateId: sale.id,
              aggregateType: "sales_sale",
              outletId,
              payload: safeEventPayload({
                completedAt: now.toISOString(),
                currency: payment.currency,
                orderId: payment.orderId,
                saleId: sale.id,
                saleNumber: sale.saleNumber,
                totalMinor: payment.totalMinor.toString(),
              }),
              tenantId,
              type: "sale.completed.v1",
            },
          ],
        });

        return { checkout: { bill, payment: paid, sale }, kind: "recorded" };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // A concurrent request won: the same key replays, anything else lost the bill.
      const replayed = await this.findCheckoutByIdempotencyKey(
        tenantId,
        outletId,
        payment.idempotencyKey,
      );
      return replayed ? { checkout: replayed, kind: "recorded" } : { kind: "bill_already_paid" };
    }
  }
}
