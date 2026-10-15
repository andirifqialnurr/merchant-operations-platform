import type { PayOrder } from "@merchant/contracts";
import { ConflictException, Inject, Injectable } from "@nestjs/common";

import { BillingService } from "../../../kernels/billing-payment-ledger/public.js";
import { OrderIntakeService } from "../../../kernels/order-intake/public.js";
import { OrganizationService } from "../../../core/workspaces/public.js";
import type { ShiftMutationContext } from "./register-session.repository.js";
import { ShiftService } from "./shift.service.js";

/**
 * Pays an order at the cashier. Money is always taken inside the cashier's
 * open shift, so every payment can be reconciled when the shift closes.
 */
@Injectable()
export class CheckoutService {
  constructor(
    @Inject(ShiftService) private readonly shifts: ShiftService,
    @Inject(OrderIntakeService) private readonly orders: OrderIntakeService,
    @Inject(BillingService) private readonly billing: BillingService,
    @Inject(OrganizationService) private readonly organization: OrganizationService,
  ) {}

  /** What the cashier screen needs to show the total before paying. */
  outletCharges(tenantId: string, outletId: string) {
    return this.organization.outletCharges(tenantId, outletId);
  }

  async payOrder(
    tenantId: string,
    outletId: string,
    orderId: string,
    pay: PayOrder,
    idempotencyKey: string,
    context: ShiftMutationContext,
  ) {
    const order = await this.orders.getOrder(tenantId, outletId, orderId);
    const shift = await this.shifts.findOpen(tenantId, outletId, context.actorId);
    if (!shift) {
      throw new ConflictException({
        code: "POS_SHIFT_REQUIRED",
        message: "Open a shift before taking payments.",
      });
    }
    // Read at the moment of paying: this is what the bill is made with.
    const charges = await this.organization.outletCharges(tenantId, outletId);
    return this.billing.payOrderInFull(
      { charges, idempotencyKey, order, outletId, pay, registerSessionId: shift.id, tenantId },
      context,
    );
  }

  /**
   * Pays every unpaid order of a table visit at once. Which orders belong to
   * the visit is read from the orders themselves; the visit's tables and its
   * state belong to the tables module.
   */
  async payTableSession(
    tenantId: string,
    outletId: string,
    tableSessionId: string,
    pay: PayOrder,
    idempotencyKey: string,
    context: ShiftMutationContext,
  ) {
    const shift = await this.shifts.findOpen(tenantId, outletId, context.actorId);
    if (!shift) {
      throw new ConflictException({
        code: "POS_SHIFT_REQUIRED",
        message: "Open a shift before taking payments.",
      });
    }
    const orders = (await this.orders.listBySession(tenantId, outletId, tableSessionId)).filter(
      (order) => order.status !== "CANCELED",
    );
    const paid = await this.billing.paidOrders(
      tenantId,
      orders.map((order) => order.id),
    );
    const charges = await this.organization.outletCharges(tenantId, outletId);
    return this.billing.payTableSessionInFull(
      {
        charges,
        idempotencyKey,
        orders: orders.filter((order) => !paid.has(order.id)),
        outletId,
        pay,
        registerSessionId: shift.id,
        tableSessionId,
        tenantId,
      },
      context,
    );
  }
}
