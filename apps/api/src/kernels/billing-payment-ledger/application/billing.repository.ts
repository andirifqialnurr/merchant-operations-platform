import type { BillStatus, PaymentMethod, PaymentStatus, SaleStatus } from "@merchant/contracts";

export type BillingMutationContext = { actorId: string; requestId?: string };

export type BillRecord = {
  currency: string;
  discountMinor: bigint;
  id: string;
  orderId: string;
  paidMinor: bigint;
  roundingMinor: bigint;
  serviceChargeMinor: bigint;
  status: BillStatus;
  subtotalMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
};

export type PaymentRecord = {
  amountMinor: bigint;
  confirmedAt: Date | null;
  id: string;
  method: PaymentMethod;
  reference: string | null;
  status: PaymentStatus;
  tenderedMinor: bigint | null;
};

export type SaleRecord = {
  completedAt: Date | null;
  id: string;
  saleNumber: number;
  status: SaleStatus;
  totalMinor: bigint;
};

export type CheckoutRecord = { bill: BillRecord; payment: PaymentRecord; sale: SaleRecord };

export type FullPayment = {
  currency: string;
  idempotencyKey: string;
  method: PaymentMethod;
  orderId: string;
  outletId: string;
  reference: string | null;
  /** The open shift the money is taken in. */
  registerSessionId: string;
  subtotalMinor: bigint;
  tenantId: string;
  tenderedMinor: bigint | null;
  totalMinor: bigint;
};

export type RefundRecord = {
  amountMinor: bigint;
  createdAt: Date;
  id: string;
  method: PaymentMethod;
  reason: string;
};

export type SaleRefundsRecord = { refunds: RefundRecord[]; sale: SaleRecord };

export type NewRefund = {
  amountMinor: bigint;
  idempotencyKey: string;
  method: PaymentMethod;
  outletId: string;
  paymentId: string;
  reason: string;
  /** The open shift the refund is paid out in. */
  registerSessionId: string;
  saleId: string;
  tenantId: string;
};

export type RefundOutcome =
  | { kind: "recorded"; result: SaleRefundsRecord }
  | { kind: "exceeds_refundable"; refundableMinor: bigint }
  | { kind: "shift_not_open" };

export type PaidOrderState = { saleNumber: number; saleStatus: SaleStatus };

export type FullPaymentOutcome =
  | { checkout: CheckoutRecord; kind: "recorded" }
  | { kind: "bill_already_paid" }
  | { kind: "order_canceled" }
  | { kind: "shift_not_open" };

/** Persistence port for bills, payments, and sales. */
export interface BillingRepository {
  /** The checkout a payment with this key produced, if the key was used. */
  findCheckoutByIdempotencyKey(
    tenantId: string,
    outletId: string,
    idempotencyKey: string,
  ): Promise<CheckoutRecord | null>;
  /**
   * In one transaction: bills the order if needed, takes the full payment in
   * the given open shift, marks the bill paid, and completes the sale.
   */
  recordFullPayment(
    payment: FullPayment,
    context: BillingMutationContext,
  ): Promise<FullPaymentOutcome>;
  /**
   * The paid checkout of an order with the name of the cashier who took the
   * payment, or null while the order is unpaid.
   */
  findPaidCheckoutByOrder(
    tenantId: string,
    outletId: string,
    orderId: string,
  ): Promise<(CheckoutRecord & { cashierName: string }) | null>;
  /** Paid orders among `orderIds`, with the number and state of the sale each became. */
  paidOrders(tenantId: string, orderIds: readonly string[]): Promise<Map<string, PaidOrderState>>;
  /** The refund a request with this key produced, with the order it belongs to. */
  findRefundByIdempotencyKey(
    tenantId: string,
    outletId: string,
    idempotencyKey: string,
  ): Promise<{ orderId: string; result: SaleRefundsRecord } | null>;
  refundsOfSale(tenantId: string, saleId: string): Promise<RefundRecord[]>;
  /**
   * In one transaction: locks the shift and the sale, checks the amount
   * against what is still refundable, records the refund, and updates the
   * sale status.
   */
  recordRefund(refund: NewRefund, context: BillingMutationContext): Promise<RefundOutcome>;
  /** Refunds paid out in a shift, summed per method. */
  sumRefundsByMethod(
    tenantId: string,
    registerSessionId: string,
  ): Promise<Map<PaymentMethod, bigint>>;
  /** Paid payments attached to a shift, summed per method. */
  sumPaymentsByMethod(
    tenantId: string,
    registerSessionId: string,
  ): Promise<Map<PaymentMethod, bigint>>;
}

export const BILLING_REPOSITORY = Symbol("BILLING_REPOSITORY");
