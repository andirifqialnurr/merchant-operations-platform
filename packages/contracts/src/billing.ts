import * as z from "zod";

import {
  currencyCodeSchema,
  moneyMinorSchema,
  positiveMoneyMinorSchema,
  signedMoneyMinorSchema,
} from "./money.ts";
import { orderSchema } from "./orders.ts";

export const billStatusSchema = z.enum(["UNPAID", "PARTIALLY_PAID", "PAID", "VOID"]);

export const paymentMethodSchema = z.enum(["CASH", "MERCHANT_QRIS", "TRANSFER", "EDC", "OTHER"]);

export const paymentStatusSchema = z.enum([
  "UNPAID",
  "VERIFYING",
  "PAID",
  "REFUND_PENDING",
  "REFUNDED",
  "FAILED",
  "EXPIRED",
]);

export const saleStatusSchema = z.enum([
  "OPEN",
  "COMPLETED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "VOIDED",
]);

/** What is owed for an order. The total is always derived from its parts. */
export const billSchema = z.object({
  currency: currencyCodeSchema,
  discountMinor: moneyMinorSchema,
  id: z.uuid(),
  orderId: z.uuid(),
  paidMinor: moneyMinorSchema,
  roundingMinor: signedMoneyMinorSchema,
  serviceChargeMinor: moneyMinorSchema,
  status: billStatusSchema,
  subtotalMinor: moneyMinorSchema,
  taxMinor: moneyMinorSchema,
  totalMinor: moneyMinorSchema,
});

export const paymentSchema = z.object({
  amountMinor: positiveMoneyMinorSchema,
  /** Cash only: tendered minus amount. Derived, never entered. */
  changeMinor: moneyMinorSchema.nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  id: z.uuid(),
  method: paymentMethodSchema,
  reference: z.string().nullable(),
  status: paymentStatusSchema,
  /** Cash only: what the customer handed over. */
  tenderedMinor: moneyMinorSchema.nullable(),
});

export const saleSchema = z.object({
  completedAt: z.iso.datetime().nullable(),
  id: z.uuid(),
  saleNumber: z.number().int().min(1),
  status: saleStatusSchema,
  totalMinor: moneyMinorSchema,
});

/** The result of paying an order in full at the cashier. */
export const checkoutSchema = z.object({
  bill: billSchema,
  payment: paymentSchema,
  sale: saleSchema,
});

/**
 * The cashier states how the order was paid. The amount is always the full
 * amount due and is decided by the server.
 */
const paymentReferenceSchema = z.string().trim().min(1).max(120);

export const payOrderSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("CASH"), tenderedMinor: positiveMoneyMinorSchema }),
  z.object({
    method: z.literal("MERCHANT_QRIS"),
    /** Optional trace number the cashier read from the payment notification. */
    reference: paymentReferenceSchema.optional(),
  }),
  z.object({ method: z.literal("TRANSFER"), reference: paymentReferenceSchema.optional() }),
  z.object({ method: z.literal("EDC"), reference: paymentReferenceSchema.optional() }),
]);

export type Bill = z.infer<typeof billSchema>;

export type BillStatus = z.infer<typeof billStatusSchema>;

export type Checkout = z.infer<typeof checkoutSchema>;

export type PayOrder = z.infer<typeof payOrderSchema>;

export type Payment = z.infer<typeof paymentSchema>;

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export type Sale = z.infer<typeof saleSchema>;

export type SaleStatus = z.infer<typeof saleStatusSchema>;

export const refundSchema = z.object({
  amountMinor: positiveMoneyMinorSchema,
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  method: paymentMethodSchema,
  reason: z.string().min(3).max(300),
});

/** The amount and reason are entered; the method is always the sale's payment method. */
export const refundOrderSchema = z.object({
  amountMinor: positiveMoneyMinorSchema,
  reason: z.string().trim().min(3).max(300),
});

/** A sale's refunds and what can still be refunded. Both are derived by the server. */
export const saleRefundsSchema = z.object({
  refundableMinor: moneyMinorSchema,
  refunds: z.array(refundSchema),
  sale: saleSchema,
});

export type Refund = z.infer<typeof refundSchema>;

export type RefundOrder = z.infer<typeof refundOrderSchema>;

export type SaleRefunds = z.infer<typeof saleRefundsSchema>;

/**
 * Everything a receipt prints for one paid order. Outlet and workspace names
 * come from the caller's workspace context, so they are not repeated here.
 */
export const receiptSchema = z.object({
  bill: billSchema,
  cashierName: z.string().min(1).max(160),
  order: orderSchema,
  payment: paymentSchema,
  refundableMinor: moneyMinorSchema,
  refunds: z.array(refundSchema),
  sale: saleSchema,
});

export type Receipt = z.infer<typeof receiptSchema>;
