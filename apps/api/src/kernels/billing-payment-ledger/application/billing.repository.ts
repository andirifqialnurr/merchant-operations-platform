import type {
  BillStatus,
  OutletCharges,
  PaymentMethod,
  PaymentStatus,
  SaleStatus,
} from "@merchant/contracts";
import {
  type ActorCommandOrigin,
  type CommandOrigin,
} from "../../../shared/command/command-origin.js";

export type BillingMutationContext = ActorCommandOrigin;

export type BillRecord = {
  chargesIncluded: boolean;
  currency: string;
  discountMinor: bigint;
  id: string;
  orderId: string;
  paidMinor: bigint;
  roundingMinor: bigint;
  serviceChargeMinor: bigint;
  serviceChargeRateBp: number;
  status: BillStatus;
  subtotalMinor: bigint;
  /** The table visit the bill was paid with, if any. */
  tableSessionId: string | null;
  taxMinor: bigint;
  taxRateBp: number;
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
  /** The charges of the outlet when the bill is made, kept on the bill. */
  charges: OutletCharges;
  currency: string;
  idempotencyKey: string;
  method: PaymentMethod;
  orderId: string;
  outletId: string;
  reference: string | null;
  /** The open shift the money is taken in. */
  registerSessionId: string;
  serviceChargeMinor: bigint;
  /** The amount before service and tax. */
  subtotalMinor: bigint;
  taxMinor: bigint;
  tenantId: string;
  tenderedMinor: bigint | null;
  totalMinor: bigint;
};

/** One order's part of a table visit's payment. */
export type SessionBillLine = {
  orderId: string;
  serviceChargeMinor: bigint;
  subtotalMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
};

/** Every unpaid order of a table visit, paid at once. */
export type SessionPayment = Omit<
  FullPayment,
  "orderId" | "serviceChargeMinor" | "subtotalMinor" | "taxMinor" | "totalMinor"
> & {
  bills: readonly SessionBillLine[];
  tableSessionId: string;
  /** The sum of the bills: what the one payment takes. */
  totalMinor: bigint;
  /**
   * A guest's claim this payment confirms. The claim becomes the payment, so
   * the money is counted once; its amount must equal the total.
   */
  claimId?: string;
};

/** Guests at a table say they paid; the cashier has not decided yet (VERIFYING). */
export type PaymentClaimRecord = {
  amountMinor: bigint;
  claimedAt: Date;
  id: string;
  method: Extract<PaymentMethod, "MERCHANT_QRIS" | "TRANSFER">;
  status: PaymentStatus;
  tableSessionId: string;
};

export type NewPaymentClaim = {
  amountMinor: bigint;
  idempotencyKey: string;
  method: PaymentClaimRecord["method"];
  outletId: string;
  tableSessionId: string;
  tenantId: string;
};

export type SessionCheckoutRecord = {
  checkouts: Array<{ bill: BillRecord; sale: SaleRecord }>;
  payment: PaymentRecord;
};

export type SessionPaymentOutcome =
  | { checkout: SessionCheckoutRecord; kind: "recorded" }
  | { kind: "bill_already_paid" }
  | { kind: "claim_changed" }
  | { kind: "order_canceled" }
  | { kind: "shift_not_open" };

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
  /** Set when someone other than the person at the cashier approved the refund. */
  approvedBy?: { displayName: string; userId: string };
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

export type PaidOrderState = { saleNumber: number; saleStatus: SaleStatus; totalMinor: bigint };

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
  /** The bills and sales a table visit's payment with this key produced, if the key was used. */
  findSessionCheckoutByIdempotencyKey(
    tenantId: string,
    outletId: string,
    idempotencyKey: string,
  ): Promise<SessionCheckoutRecord | null>;
  /**
   * In one transaction: bills every order of the visit, takes one payment
   * for all of them in the given open shift, and completes a sale per bill.
   * Nothing is written when any order is canceled or already paid.
   */
  recordSessionPayment(
    payment: SessionPayment,
    context: BillingMutationContext,
  ): Promise<SessionPaymentOutcome>;
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
  /**
   * Records a guest's claim, or returns the one the visit already waits on
   * (only one at a time), so asking twice is one claim.
   */
  claimPayment(claim: NewPaymentClaim, origin: CommandOrigin): Promise<PaymentClaimRecord>;
  /** A claim of the outlet, whatever was decided on it. */
  findClaim(tenantId: string, outletId: string, id: string): Promise<PaymentClaimRecord | null>;
  /** Claims still waiting on a cashier, oldest first. */
  verifyingClaims(tenantId: string, outletId: string): Promise<PaymentClaimRecord[]>;
  /** The cashier did not receive the money: the claim fails. Null when it was not waiting. */
  rejectClaim(
    tenantId: string,
    outletId: string,
    id: string,
    now: Date,
    context: BillingMutationContext,
  ): Promise<PaymentClaimRecord | null>;
  /** Paid payments attached to a shift, summed per method. */
  sumPaymentsByMethod(
    tenantId: string,
    registerSessionId: string,
  ): Promise<Map<PaymentMethod, bigint>>;
}

export const BILLING_REPOSITORY = Symbol("BILLING_REPOSITORY");
