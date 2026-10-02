import { Module } from "@nestjs/common";

import { PrismaBillingRepository } from "./adapters/prisma-billing.repository.js";
import { BILLING_REPOSITORY } from "./application/billing.repository.js";
import { BillingService } from "./application/billing.service.js";

/**
 * Billing and payment ledger kernel. Owns billing_bills, billing_payments,
 * billing_payment_allocations, sales_sales, and sales_number_counters.
 */
@Module({
  exports: [BillingService],
  providers: [
    BillingService,
    PrismaBillingRepository,
    { provide: BILLING_REPOSITORY, useExisting: PrismaBillingRepository },
  ],
})
export class BillingPaymentLedgerModule {}
