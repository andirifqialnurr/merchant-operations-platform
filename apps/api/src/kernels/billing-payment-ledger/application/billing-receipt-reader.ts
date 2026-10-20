import type { ReadScope, ReadSnapshot } from "../../../shared/query/read-snapshot.js";
import type { BillRecord, PaymentRecord, SaleRecord, RefundRecord } from "./billing.repository.js";

export type ReceiptLedgerEntry = {
  bill: BillRecord;
  sale: SaleRecord | null;
  refunds: RefundRecord[];
  scopeValid: boolean;
  allocations: Array<{
    amountMinor: bigint;
    payment: PaymentRecord;
    cashierName: string | null;
    paymentAllocationCount: number;
  }>;
};

export interface BillingReceiptReader {
  /** All bill states, including broken paid bills. No take:1, status filter, or silent omission. */
  read(
    scope: ReadScope,
    orderIds: readonly string[],
    snapshot: ReadSnapshot,
  ): Promise<ReceiptLedgerEntry[]>;
}

export const BILLING_RECEIPT_READER = Symbol("BILLING_RECEIPT_READER");
