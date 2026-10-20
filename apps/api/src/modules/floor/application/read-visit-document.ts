import { visitDocumentSchema } from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { OrganizationService } from "../../../core/workspaces/public.js";
import { BillingReceiptQueries } from "../../../kernels/billing-payment-ledger/public.js";
import { OrderIntakeService } from "../../../kernels/order-intake/public.js";
import { READ_SNAPSHOTS, type ReadSnapshots } from "../../../shared/query/read-snapshot.js";
import { visitFinancialDocument } from "../domain/visit-financial-document.js";
import {
  TABLE_SESSION_REPOSITORY,
  type TableSessionRepository,
} from "./table-session.repository.js";

@Injectable()
export class ReadVisitDocument {
  constructor(
    @Inject(READ_SNAPSHOTS) private readonly snapshots: ReadSnapshots,
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
    @Inject(OrderIntakeService) private readonly orders: OrderIntakeService,
    @Inject(BillingReceiptQueries) private readonly billing: BillingReceiptQueries,
    @Inject(OrganizationService) private readonly organization: OrganizationService,
  ) {}

  execute(tenantId: string, outletId: string, sessionId: string) {
    return this.snapshots.run({ tenantId, outletId }, async (snapshot) => {
      const session = await this.sessions.findSession(tenantId, outletId, sessionId, snapshot);
      if (!session)
        throw new NotFoundException({
          code: "TABLE_SESSION_NOT_FOUND",
          message: "This visit was not found.",
        });
      const context = await this.organization.visitDocumentContext(tenantId, outletId, snapshot);
      const orders = await this.orders.listBySession(tenantId, outletId, sessionId, snapshot);
      const paid = await this.billing.read(
        { tenantId, outletId },
        orders.map((order) => order.id),
        snapshot,
      );
      const paidIds = new Set(paid.map((row) => row.orderId));
      const byId = new Map(orders.map((order) => [order.id, order]));
      const unavailable = () =>
        new ConflictException({
          code: "RECEIPT_ALLOCATION_UNAVAILABLE",
          message: "The saved financial snapshot cannot be represented on a visit document.",
        });
      const receipts = paid.map((row) => {
        const order = byId.get(row.orderId);
        if (!order || (row.tableSessionId !== null && row.tableSessionId !== sessionId))
          throw unavailable();
        return { ...row.receipt, order };
      });
      const document = visitFinancialDocument({
        currency: context.currency,
        outletId,
        sessionId,
        charges: context.charges,
        receipts,
        unpaidOrders: orders.filter((order) => !paidIds.has(order.id)),
      });
      if (!document) throw unavailable();
      const tableLabel = await this.sessions.primaryTableLabel(
        tenantId,
        outletId,
        sessionId,
        snapshot,
      );
      return visitDocumentSchema.parse({
        ...document,
        visit: { id: session.id, displayNumber: session.displayNumber, status: session.status },
        tableLabel,
        outlet: context.outlet,
      });
    });
  }
}
