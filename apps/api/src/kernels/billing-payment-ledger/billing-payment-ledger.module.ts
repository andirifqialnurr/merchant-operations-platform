import { Module } from "@nestjs/common";

import { PrismaBillingRepository } from "./adapters/prisma-billing.repository.js";
import { BILLING_REPOSITORY } from "./application/billing.repository.js";
import { BillingService } from "./application/billing.service.js";
import { BillingReceiptQueries } from "./application/billing-receipt-queries.js";
import { BILLING_RECEIPT_READER } from "./application/billing-receipt-reader.js";
import { PrismaBillingReceiptReader } from "./adapters/prisma-billing-receipt-reader.js";

/**
 * Billing and payment ledger kernel. Owns billing_bills, billing_payments,
 * billing_payment_allocations, sales_sales, and sales_number_counters.
 */
@Module({
  exports: [BillingService, BillingReceiptQueries],
  providers: [
    BillingReceiptQueries,
    PrismaBillingReceiptReader,
    { provide: BILLING_RECEIPT_READER, useExisting: PrismaBillingReceiptReader },
    BillingService,
    PrismaBillingRepository,
    { provide: BILLING_REPOSITORY, useExisting: PrismaBillingRepository },
  ],
})
export class BillingPaymentLedgerModule {}
