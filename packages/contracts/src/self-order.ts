import * as z from "zod";

import { outletChargesSchema } from "./charges.ts";
import { catalogNameSchema } from "./catalog.ts";
import { currencyCodeSchema, moneyMinorSchema } from "./money.ts";
import { claimMethodSchema } from "./billing.ts";
import { serviceRequestTypeSchema } from "./floor.ts";
import { createOrderItemSchema } from "./orders.ts";
import { sellableMenuModifierGroupSchema, sellableMenuOptionSchema } from "./menu.ts";

/**
 * What a guest who scanned a table's QR may see. No shape here carries an id
 * of the workspace, outlet, table, visit, or order, a position on the floor,
 * or the QR token: the token in the address is the guest's only key.
 */
export const guestMenuProductSchema = z
  .object({
    categoryId: z.uuid(),
    id: z.uuid(),
    modifierGroups: z.array(sellableMenuModifierGroupSchema),
    name: catalogNameSchema,
    /** Outlet price before any variant or modifier surcharge. */
    priceMinor: moneyMinorSchema,
    variants: z.array(sellableMenuOptionSchema),
  })
  .strict();

export const guestMenuSchema = z
  .object({
    categories: z.array(z.object({ id: z.uuid(), name: catalogNameSchema }).strict()),
    /** How the outlet adds tax and service, so the guest sees the total they will pay. */
    charges: outletChargesSchema,
    currency: currencyCodeSchema,
    /** How guests can pay from the table; empty when they pay at the cashier. */
    paymentNote: z.string().min(1).nullable(),
    products: z.array(guestMenuProductSchema),
  })
  .strict();

/** A guest's order: what they chose, and how many sit at the table when they open it. */
export const placeGuestOrderSchema = z
  .object({
    /** Used only when the table has no visit yet. */
    guestCount: z.number().int().min(1).max(99).optional(),
    items: z.array(createOrderItemSchema).min(1).max(50),
    note: z.string().trim().min(1).max(300).optional(),
  })
  .strict();

/** Where an order is, in the words a guest needs. */
export const guestOrderStatusSchema = z.enum(["RECEIVED", "PREPARING", "READY", "CANCELED"]);

export const guestOrderSchema = z
  .object({
    lines: z.array(
      z
        .object({
          modifiers: z.array(z.string().min(1)),
          name: catalogNameSchema,
          /** For "order again": the product, when it is a plain one the guest can add as it was. */
          productId: z.uuid().nullable(),
          quantity: z.number().int().min(1),
        })
        .strict(),
    ),
    /** The number staff and guests both say out loud. */
    orderNumber: z.number().int().min(1),
    status: guestOrderStatusSchema,
    submittedAt: z.iso.datetime().nullable(),
    totalMinor: moneyMinorSchema,
  })
  .strict();

/** The orders of the visit now at the table; empty when nobody sits there yet. */
export const guestVisitSchema = z
  .object({
    /** The guests said they paid; a cashier has not confirmed it yet. */
    claim: z
      .object({ amountMinor: moneyMinorSchema, method: claimMethodSchema })
      .strict()
      .nullable(),
    /** What is still to be paid for the visit. */
    dueMinor: moneyMinorSchema,
    orders: z.array(guestOrderSchema),
    /** What the guests asked staff for and are still waiting on. */
    requests: z.array(serviceRequestTypeSchema),
  })
  .strict();

/** "I have paid": by transfer or QRIS, for what the visit owes now. */
export const claimGuestPaymentSchema = z.object({ method: claimMethodSchema }).strict();

/** Calling a waiter, or asking for the bill. */
export const placeServiceRequestSchema = z.object({ type: serviceRequestTypeSchema }).strict();

export type GuestMenu = z.infer<typeof guestMenuSchema>;

export type GuestMenuProduct = z.infer<typeof guestMenuProductSchema>;

export type GuestOrder = z.infer<typeof guestOrderSchema>;

export type GuestOrderStatus = z.infer<typeof guestOrderStatusSchema>;

export type GuestVisit = z.infer<typeof guestVisitSchema>;

export type PlaceGuestOrder = z.infer<typeof placeGuestOrderSchema>;

export type PlaceServiceRequest = z.infer<typeof placeServiceRequestSchema>;

export type ClaimGuestPayment = z.infer<typeof claimGuestPaymentSchema>;
