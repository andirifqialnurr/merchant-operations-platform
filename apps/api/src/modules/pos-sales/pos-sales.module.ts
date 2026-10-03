import { Module } from "@nestjs/common";

import { AccessModule } from "../../access/access.module.js";
import { AuthModule } from "../../core/auth/auth.module.js";
import { CatalogModule } from "../../catalog/catalog.module.js";
import { BillingPaymentLedgerModule } from "../../kernels/billing-payment-ledger/billing-payment-ledger.module.js";
import { OrderIntakeModule } from "../../kernels/order-intake/order-intake.module.js";
import { HeldCartController } from "./adapters/held-cart.controller.js";
import { MenuController } from "./adapters/menu.controller.js";
import { OrderController } from "./adapters/order.controller.js";
import { PrismaHeldCartRepository } from "./adapters/prisma-held-cart.repository.js";
import { PrismaRegisterSessionRepository } from "./adapters/prisma-register-session.repository.js";
import { ShiftController } from "./adapters/shift.controller.js";
import { HELD_CART_REPOSITORY } from "./application/held-cart.repository.js";
import { HeldCartService } from "./application/held-cart.service.js";
import { CheckoutService } from "./application/checkout.service.js";
import { PosOrdersService } from "./application/pos-orders.service.js";
import { REGISTER_SESSION_REPOSITORY } from "./application/register-session.repository.js";
import { ShiftService } from "./application/shift.service.js";

/** POS & Sales. Owns pos_register_sessions and pos_cash_movements. */
@Module({
  controllers: [HeldCartController, MenuController, OrderController, ShiftController],
  imports: [AccessModule, AuthModule, BillingPaymentLedgerModule, CatalogModule, OrderIntakeModule],
  providers: [
    CheckoutService,
    HeldCartService,
    PrismaHeldCartRepository,
    { provide: HELD_CART_REPOSITORY, useExisting: PrismaHeldCartRepository },
    PosOrdersService,
    ShiftService,
    PrismaRegisterSessionRepository,
    { provide: REGISTER_SESSION_REPOSITORY, useExisting: PrismaRegisterSessionRepository },
  ],
})
export class PosSalesModule {}
