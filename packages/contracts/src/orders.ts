import * as z from "zod";

import { currencyCodeSchema, moneyMinorSchema } from "./money.ts";
import { catalogNameSchema } from "./catalog.ts";

export const orderSourceSchema = z.enum(["POS", "SELF_ORDER", "MANUAL", "EXTERNAL"]);

export const orderTypeSchema = z.enum(["DINE_IN", "TAKEAWAY"]);

export const orderStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELED",
]);

export const orderItemModifierSchema = z.object({
  groupName: catalogNameSchema,
  optionName: catalogNameSchema,
  priceDeltaMinor: moneyMinorSchema,
});

/** A line as it was taken: names and prices are snapshots, not live catalog data. */
export const orderItemSchema = z.object({
  id: z.uuid(),
  lineTotalMinor: moneyMinorSchema,
  modifiers: z.array(orderItemModifierSchema),
  name: catalogNameSchema,
  note: z.string().nullable(),
  productId: z.uuid().nullable(),
  quantity: z.number().int().min(1),
  /** Outlet price plus the variant and modifier surcharges. */
  unitPriceMinor: moneyMinorSchema,
  variantName: catalogNameSchema.nullable(),
});

export const orderSchema = z.object({
  cancelReason: z.string().nullable(),
  canceledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  currency: currencyCodeSchema,
  id: z.uuid(),
  items: z.array(orderItemSchema),
  note: z.string().nullable(),
  orderNumber: z.number().int().min(1),
  orderType: orderTypeSchema,
  outletId: z.uuid(),
  source: orderSourceSchema,
  status: orderStatusSchema,
  submittedAt: z.iso.datetime().nullable(),
  /** Sum of the line totals; discounts, tax, and rounding belong to the bill. */
  subtotalMinor: moneyMinorSchema,
});

/** The client names what was chosen; every price is decided by the server. */
export const createOrderItemSchema = z.object({
  modifierOptionIds: z.array(z.uuid()).max(50).default([]),
  note: z.string().trim().min(1).max(300).optional(),
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(999),
  variantId: z.uuid().optional(),
});

export const createPosOrderSchema = z.object({
  items: z.array(createOrderItemSchema).min(1).max(100),
  note: z.string().trim().min(1).max(500).optional(),
  /** Dine-in joins once table sessions exist. */
  orderType: z.literal("TAKEAWAY"),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const orderPaymentStateSchema = z.enum(["UNPAID", "PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);

/** One row of the cashier's order list; the payment state comes from billing. */
export const posOrderSummarySchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  itemCount: z.number().int().min(0),
  orderNumber: z.number().int().min(1),
  paymentState: orderPaymentStateSchema,
  saleNumber: z.number().int().min(1).nullable(),
  status: orderStatusSchema,
  subtotalMinor: moneyMinorSchema,
});

export const posOrderListSchema = z.object({ orders: z.array(posOrderSummarySchema) });

export type CancelOrder = z.infer<typeof cancelOrderSchema>;

export type OrderPaymentState = z.infer<typeof orderPaymentStateSchema>;

export type PosOrderList = z.infer<typeof posOrderListSchema>;

export type PosOrderSummary = z.infer<typeof posOrderSummarySchema>;

export type CreateOrderItem = z.infer<typeof createOrderItemSchema>;

export type CreatePosOrder = z.infer<typeof createPosOrderSchema>;

export type Order = z.infer<typeof orderSchema>;

export type OrderItem = z.infer<typeof orderItemSchema>;

export type OrderSource = z.infer<typeof orderSourceSchema>;

export type OrderStatus = z.infer<typeof orderStatusSchema>;

export type OrderType = z.infer<typeof orderTypeSchema>;
