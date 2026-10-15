import { Module } from "@nestjs/common";

import { AuthModule } from "../../core/auth/public.js";
import { AccessModule } from "../../core/memberships/public.js";
import { MeteringModule } from "../../core/metering/public.js";
import { BillingPaymentLedgerModule } from "../../kernels/billing-payment-ledger/public.js";
import { OrderIntakeModule } from "../../kernels/order-intake/public.js";
import { CustomerController } from "./adapters/customer.controller.js";
import { PrismaCustomerRepository } from "./adapters/prisma-customer.repository.js";
import { SaleEventsHandler } from "./adapters/sale-events.handler.js";
import { CUSTOMER_REPOSITORY } from "./application/customer.repository.js";
import { Customers } from "./application/customers.js";

/**
 * Customer Basic. Owns customer_customers and customer_order_links. Reads
 * orders and paid sales through the order and billing kernels, and hears
 * about sales from `sale.completed.v1`. Nothing it holds reaches the kitchen.
 */
@Module({
  controllers: [CustomerController],
  imports: [
    AccessModule,
    AuthModule,
    BillingPaymentLedgerModule,
    MeteringModule,
    OrderIntakeModule,
  ],
  providers: [
    Customers,
    SaleEventsHandler,
    PrismaCustomerRepository,
    { provide: CUSTOMER_REPOSITORY, useExisting: PrismaCustomerRepository },
  ],
})
export class CustomerModule {}
