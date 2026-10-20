import * as z from "zod";

import { billSchema, paymentSchema, refundSchema, saleSchema } from "./billing.ts";
import { currencyCodeSchema, moneyMinorSchema, signedMoneyMinorSchema } from "./money.ts";
import { orderSchema } from "./orders.ts";
import { tableSessionSchema } from "./floor.ts";

/** A read-only price breakdown. Paid values are snapshots, never today's outlet rates. */
export const visitOrderPricingSchema = billSchema
  .omit({ id: true, orderId: true, paidMinor: true, status: true })
  .extend({ source: z.enum(["PAID_SNAPSHOT", "CURRENT_CHARGES"]) })
  .strict();

/** Financial projection only; the HTTP query adds authoritative visit/table context separately. */
export const visitFinancialDocumentSchema = z
  .object({
    currency: currencyCodeSchema,
    kind: z.enum(["BILL", "RECEIPT"]),
    orders: z.array(
      z
        .object({
          order: orderSchema,
          paymentId: z.uuid().nullable(),
          pricing: visitOrderPricingSchema,
          sale: saleSchema.nullable(),
        })
        .strict(),
    ),
    /** Pending rounds are review context, not priced debt or a completed sale. */
    pendingOrders: z.array(orderSchema),
    /** Each actual transaction appears once, including legacy per-order payments. */
    payments: z.array(paymentSchema.extend({ cashierName: z.string().min(1).max(160) }).strict()),
    refunds: z.array(refundSchema.extend({ orderId: z.uuid() }).strict()),
    state: z.enum(["EMPTY", "PENDING", "UNPAID", "PARTIALLY_PAID", "PAID"]),
    totals: z
      .object({
        discountMinor: moneyMinorSchema,
        dueMinor: moneyMinorSchema,
        netPaidMinor: moneyMinorSchema,
        paidMinor: moneyMinorSchema,
        refundedMinor: moneyMinorSchema,
        roundingMinor: signedMoneyMinorSchema,
        serviceChargeMinor: moneyMinorSchema,
        subtotalMinor: moneyMinorSchema,
        taxMinor: moneyMinorSchema,
        totalMinor: moneyMinorSchema,
      })
      .strict(),
  })
  .strict();

/** Staff-only visit query; metadata belongs to this document, not to each transaction/order. */
export const visitDocumentSchema = visitFinancialDocumentSchema
  .extend({
    visit: tableSessionSchema.pick({ id: true, displayNumber: true, status: true }).strict(),
    tableLabel: z.string().min(1).nullable(),
    outlet: z
      .object({
        name: z.string().min(1),
        workspaceName: z.string().min(1),
        timezone: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type VisitDocument = z.infer<typeof visitDocumentSchema>;
export type VisitFinancialDocument = z.infer<typeof visitFinancialDocumentSchema>;
export type VisitOrderPricing = z.infer<typeof visitOrderPricingSchema>;
