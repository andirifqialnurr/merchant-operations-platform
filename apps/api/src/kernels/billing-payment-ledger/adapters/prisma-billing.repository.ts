import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../audit/critical-action-audit.js";
import type {
  BillingMutationContext,
  BillingRepository,
  CheckoutRecord,
  FullPayment,
  FullPaymentOutcome,
} from "../application/billing.repository.js";

const billSelect = {
  currency: true,
  discountMinor: true,
  id: true,
  orderId: true,
  paidMinor: true,
  roundingMinor: true,
  serviceChargeMinor: true,
  status: true,
  subtotalMinor: true,
  taxMinor: true,
  totalMinor: true,
} as const;

const paymentSelect = {
  amountMinor: true,
  confirmedAt: true,
  id: true,
  method: true,
  reference: true,
  status: true,
  tenderedMinor: true,
} as const;

const saleSelect = {
  completedAt: true,
  id: true,
  saleNumber: true,
  status: true,
  totalMinor: true,
} as const;

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

  async paidOrders(tenantId: string, orderIds: readonly string[]) {
    if (orderIds.length === 0) return new Map<string, number>();
    const bills = await getPrismaClient().bill.findMany({
      select: { orderId: true, sale: { select: { saleNumber: true } } },
      where: { orderId: { in: [...orderIds] }, status: "PAID", tenantId },
    });
    return new Map(
      bills.flatMap((bill) => (bill.sale ? [[bill.orderId, bill.sale.saleNumber] as const] : [])),
    );
  }

  async sumCashPayments(tenantId: string, registerSessionId: string) {
    const result = await getPrismaClient().billingPayment.aggregate({
      _sum: { amountMinor: true },
      where: { method: "CASH", registerSessionId, status: "PAID", tenantId },
    });
    return result._sum.amountMinor ?? 0n;
  }

  async recordFullPayment(
    payment: FullPayment,
    context: BillingMutationContext,
  ): Promise<FullPaymentOutcome> {
    const { outletId, tenantId } = payment;
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
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

        const existing = await transaction.bill.findUnique({
          select: { id: true },
          where: { tenantId_orderId: { orderId: payment.orderId, tenantId } },
        });
        const billId =
          existing?.id ??
          (
            await transaction.bill.create({
              data: {
                currency: payment.currency,
                orderId: payment.orderId,
                outletId,
                subtotalMinor: payment.subtotalMinor,
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
              aggregateId: paid.id,
              aggregateType: "billing_payment",
              outletId,
              payload,
              tenantId,
              type: "payment.recorded.v1",
            },
            {
              aggregateId: sale.id,
              aggregateType: "sales_sale",
              outletId,
              payload: {
                completedAt: now.toISOString(),
                currency: payment.currency,
                orderId: payment.orderId,
                saleId: sale.id,
                saleNumber: sale.saleNumber,
                totalMinor: payment.totalMinor.toString(),
              },
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
