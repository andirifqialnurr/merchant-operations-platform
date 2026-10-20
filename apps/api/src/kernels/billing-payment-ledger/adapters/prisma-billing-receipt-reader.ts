import { Injectable } from "@nestjs/common";

import { readDatabase } from "../../../core/read-snapshots/public.js";
import type { ReadScope, ReadSnapshot } from "../../../shared/query/read-snapshot.js";
import type {
  BillingReceiptReader,
  ReceiptLedgerEntry,
} from "../application/billing-receipt-reader.js";
import { billSelect, paymentSelect, saleSelect, refundSelect } from "./billing-record-selects.js";

@Injectable()
export class PrismaBillingReceiptReader implements BillingReceiptReader {
  async read(
    scope: ReadScope,
    orderIds: readonly string[],
    snapshot: ReadSnapshot,
  ): Promise<ReceiptLedgerEntry[]> {
    const rows = await readDatabase(scope, snapshot).bill.findMany({
      // Scope through the authoritative order as well: an inconsistent bill outlet is
      // detected below, never silently interpreted as an unpaid order.
      where: {
        tenantId: scope.tenantId,
        orderId: { in: [...orderIds] },
        order: { tenantId: scope.tenantId, outletId: scope.outletId },
      },
      orderBy: { id: "asc" },
      select: {
        ...billSelect,
        tenantId: true,
        outletId: true,
        allocations: {
          orderBy: { id: "asc" },
          select: {
            amountMinor: true,
            payment: {
              select: {
                ...paymentSelect,
                tenantId: true,
                outletId: true,
                actor: { select: { displayName: true } },
                _count: { select: { allocations: true } },
              },
            },
          },
        },
        sale: {
          select: {
            ...saleSelect,
            tenantId: true,
            outletId: true,
            refunds: {
              orderBy: { id: "asc" },
              select: {
                ...refundSelect,
                tenantId: true,
                outletId: true,
                paymentId: true,
                status: true,
              },
            },
          },
        },
      },
    });
    const inScope = (record: { tenantId: string; outletId: string }) =>
      record.tenantId === scope.tenantId && record.outletId === scope.outletId;
    return rows.map(({ allocations, sale, tenantId, outletId, ...bill }) => ({
      bill,
      sale: sale
        ? {
            completedAt: sale.completedAt,
            id: sale.id,
            saleNumber: sale.saleNumber,
            status: sale.status,
            totalMinor: sale.totalMinor,
          }
        : null,
      refunds: (sale?.refunds ?? []).map(({ amountMinor, createdAt, id, method, reason }) => ({
        amountMinor,
        createdAt,
        id,
        method,
        reason,
      })),
      scopeValid:
        inScope({ tenantId, outletId }) &&
        allocations.every(({ payment }) => inScope(payment)) &&
        (!sale ||
          (inScope(sale) &&
            sale.refunds.every(
              (refund) =>
                inScope(refund) &&
                refund.status === "COMPLETED" &&
                allocations.some(({ payment }) => payment.id === refund.paymentId),
            ))),
      allocations: allocations.map(
        ({
          amountMinor,
          payment: { actor, _count, tenantId: _tenant, outletId: _outlet, ...payment },
        }) => {
          void [_tenant, _outlet];
          return {
            amountMinor,
            payment,
            cashierName: actor?.displayName ?? null,
            paymentAllocationCount: _count.allocations,
          };
        },
      ),
    }));
  }
}
