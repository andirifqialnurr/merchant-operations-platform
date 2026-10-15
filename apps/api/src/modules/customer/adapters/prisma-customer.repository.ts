import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata, buildAuditPayload } from "../../../core/audit/public.js";
import type { ActorCommandOrigin } from "../../../shared/command/command-origin.js";
import {
  CustomerPhoneTakenError,
  type CustomerRecord,
  type CustomerRepository,
  type LinkedSale,
  type NewOrderLink,
} from "../application/customer.repository.js";

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];

const select = { id: true, name: true, note: true, phone: true, status: true } as const;

type Row = {
  id: string;
  name: string | null;
  note: string | null;
  phone: string | null;
  status: CustomerRecord["status"];
};

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** Paid visits, spend, and the last visit of each customer, from their links. */
async function withHistory(
  tenantId: string,
  rows: readonly Row[],
  client: Transaction | ReturnType<typeof getPrismaClient> = getPrismaClient(),
): Promise<CustomerRecord[]> {
  if (rows.length === 0) return [];
  const totals = await client.customerOrderLink.groupBy({
    _count: { saleNumber: true },
    _max: { completedAt: true, linkedAt: true },
    _sum: { totalMinor: true },
    by: ["customerId"],
    where: { customerId: { in: rows.map((row) => row.id) }, saleNumber: { not: null }, tenantId },
  });
  const byCustomer = new Map(totals.map((total) => [total.customerId, total]));
  return rows.map((row) => {
    const total = byCustomer.get(row.id);
    return {
      ...row,
      lastVisitAt: total ? (total._max.completedAt ?? total._max.linkedAt) : null,
      spendMinor: total?._sum.totalMinor ?? 0n,
      visitCount: total?._count.saleNumber ?? 0,
    };
  });
}

async function audit(
  transaction: Transaction,
  action: string,
  tenantId: string,
  entityId: string,
  payload: Record<string, unknown>,
  origin: ActorCommandOrigin,
) {
  await transaction.auditLog.create({
    data: {
      action,
      actorId: origin.actorId,
      entityId,
      entityType: "customer_customer",
      metadata: buildAuditMetadata(action, buildAuditPayload({ after: payload })),
      ...(origin.requestId ? { requestId: origin.requestId } : {}),
      tenantId,
    },
  });
}

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  async search(tenantId: string, query: { digits?: string; text?: string }, limit: number) {
    const rows = await getPrismaClient().customerCustomer.findMany({
      orderBy: query.text || query.digits ? [{ name: "asc" }] : [{ updatedAt: "desc" }],
      select,
      take: limit,
      where: {
        status: "ACTIVE",
        tenantId,
        ...(query.text || query.digits
          ? {
              OR: [
                ...(query.text
                  ? [{ name: { contains: query.text, mode: "insensitive" as const } }]
                  : []),
                ...(query.digits ? [{ phone: { contains: query.digits } }] : []),
              ],
            }
          : {}),
      },
    });
    return withHistory(tenantId, rows);
  }

  async find(tenantId: string, id: string) {
    const row = await getPrismaClient().customerCustomer.findFirst({
      select,
      where: { id, tenantId },
    });
    return row ? ((await withHistory(tenantId, [row]))[0] ?? null) : null;
  }

  async visits(tenantId: string, customerId: string) {
    const rows = await getPrismaClient().customerOrderLink.findMany({
      orderBy: { linkedAt: "desc" },
      select: {
        completedAt: true,
        currency: true,
        linkedAt: true,
        orderNumber: true,
        saleNumber: true,
        totalMinor: true,
      },
      where: { customerId, tenantId },
    });
    return rows.map((row) => ({
      at: row.completedAt ?? row.linkedAt,
      currency: row.currency,
      orderNumber: row.orderNumber,
      saleNumber: row.saleNumber,
      totalMinor: row.totalMinor,
    }));
  }

  async create(
    tenantId: string,
    input: { name: string | null; note: string | null; phone: string | null },
    origin: ActorCommandOrigin,
  ) {
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const row = await transaction.customerCustomer.create({
          data: { ...input, createdBy: origin.actorId, tenantId },
          select,
        });
        // The phone number stays out of the audit trail.
        await audit(
          transaction,
          "customer.create",
          tenantId,
          row.id,
          { hasPhone: Boolean(row.phone) },
          origin,
        );
        return { ...row, lastVisitAt: null, spendMinor: 0n, visitCount: 0 };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new CustomerPhoneTakenError();
      throw error;
    }
  }

  async update(
    tenantId: string,
    id: string,
    change: { name?: string | null; note?: string | null; phone?: string | null },
    origin: ActorCommandOrigin,
  ) {
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const changed = await transaction.customerCustomer.updateMany({
          data: { ...change, updatedAt: new Date() },
          where: { id, status: "ACTIVE", tenantId },
        });
        if (changed.count === 0) return null;
        const row = await transaction.customerCustomer.findFirstOrThrow({
          select,
          where: { id, tenantId },
        });
        await audit(
          transaction,
          "customer.update",
          tenantId,
          id,
          { fields: Object.keys(change) },
          origin,
        );
        return (await withHistory(tenantId, [row], transaction))[0] ?? null;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new CustomerPhoneTakenError();
      throw error;
    }
  }

  async countActive(tenantId: string) {
    return getPrismaClient().customerCustomer.count({ where: { status: "ACTIVE", tenantId } });
  }

  async linkOrder(tenantId: string, link: NewOrderLink, origin: ActorCommandOrigin) {
    const existing = await getPrismaClient().customerOrderLink.findFirst({
      select: { customerId: true },
      where: { sourceReference: link.orderId, sourceType: "ORDER", tenantId },
    });
    if (existing) return existing.customerId === link.customerId ? "same" : "taken";
    try {
      await getPrismaClient().$transaction(async (transaction) => {
        await transaction.customerOrderLink.create({
          data: {
            customerId: link.customerId,
            linkedBy: origin.actorId,
            orderNumber: link.orderNumber,
            outletId: link.outletId,
            sourceReference: link.orderId,
            tenantId,
            ...(link.sale
              ? {
                  completedAt: link.sale.completedAt,
                  currency: link.sale.currency,
                  saleNumber: link.sale.saleNumber,
                  totalMinor: link.sale.totalMinor,
                }
              : {}),
          },
        });
        await audit(
          transaction,
          "customer.link_order",
          tenantId,
          link.customerId,
          { orderId: link.orderId },
          origin,
        );
      });
      return "linked";
    } catch (error) {
      // Linked by someone else a moment earlier.
      if (!isUniqueViolation(error)) throw error;
      const now = await getPrismaClient().customerOrderLink.findFirst({
        select: { customerId: true },
        where: { sourceReference: link.orderId, sourceType: "ORDER", tenantId },
      });
      return now?.customerId === link.customerId ? "same" : "taken";
    }
  }

  async customerOfOrder(tenantId: string, orderId: string) {
    const link = await getPrismaClient().customerOrderLink.findFirst({
      select: { customer: { select } },
      where: { sourceReference: orderId, sourceType: "ORDER", tenantId },
    });
    return link ? ((await withHistory(tenantId, [link.customer]))[0] ?? null) : null;
  }

  async recordSale(tenantId: string, orderId: string, sale: LinkedSale) {
    const changed = await getPrismaClient().customerOrderLink.updateMany({
      data: {
        completedAt: sale.completedAt,
        currency: sale.currency,
        saleNumber: sale.saleNumber,
        totalMinor: sale.totalMinor,
      },
      where: { sourceReference: orderId, sourceType: "ORDER", tenantId },
    });
    return changed.count > 0;
  }
}
