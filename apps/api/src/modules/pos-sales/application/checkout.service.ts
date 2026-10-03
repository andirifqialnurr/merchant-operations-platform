import type { PayOrder } from "@merchant/contracts";
import { ConflictException, Inject, Injectable } from "@nestjs/common";

import { BillingService } from "../../../kernels/billing-payment-ledger/public.js";
import { OrderIntakeService } from "../../../kernels/order-intake/public.js";
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
  ) {}

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
    return this.billing.payOrderInFull(
      { idempotencyKey, order, outletId, pay, registerSessionId: shift.id, tenantId },
      context,
    );
  }
}
