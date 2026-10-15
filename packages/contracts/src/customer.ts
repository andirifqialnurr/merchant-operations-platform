import * as z from "zod";

import { currencyCodeSchema, moneyMinorSchema } from "./money.ts";

/** Digits, with one leading "+" kept; spaces, dashes, and brackets are dropped. */
export function normalizePhone(value: string) {
  const trimmed = value.trim();
  return (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "");
}

export const customerPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,24}$/)
  .overwrite(normalizePhone)
  .refine((phone) => phone.replace("+", "").length >= 6 && phone.length <= 16);

const customerNameSchema = z.string().trim().min(1).max(120);
const customerNoteSchema = z.string().trim().min(1).max(500);

/** A customer needs a name or a phone number to be found again; the rest is optional. */
export const createCustomerSchema = z
  .object({
    name: customerNameSchema.optional(),
    note: customerNoteSchema.optional(),
    phone: customerPhoneSchema.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.name ?? value.phone), {
    message: "A customer needs a name or a phone number.",
    path: ["name"],
  });

/** What changes; `null` clears a field. */
export const updateCustomerSchema = z
  .object({
    name: customerNameSchema.nullable().optional(),
    note: customerNoteSchema.nullable().optional(),
    phone: customerPhoneSchema.nullable().optional(),
  })
  .strict();

/**
 * A customer as staff see them. The phone number is there only for roles
 * allowed to see contacts (`customer.contact.view`); others get its last
 * digits to tell two customers apart.
 */
export const customerSchema = z
  .object({
    id: z.uuid(),
    /** Paid visits linked to the customer. */
    visitCount: z.number().int().min(0),
    lastVisitAt: z.iso.datetime().nullable(),
    name: z.string().min(1).nullable(),
    note: z.string().min(1).nullable(),
    phone: z.string().min(1).nullable(),
    /** The last four digits, for everyone who may see the customer. */
    phoneEnding: z.string().min(1).max(4).nullable(),
    /** What the customer paid over all linked visits, in the workspace currency. */
    spendMinor: moneyMinorSchema,
  })
  .strict();

/** One order linked to a customer; paid ones carry their sale. */
export const customerVisitSchema = z
  .object({
    /** When it was paid, or when it was linked while still unpaid. */
    at: z.iso.datetime(),
    currency: currencyCodeSchema.nullable(),
    orderNumber: z.number().int().min(1),
    saleNumber: z.number().int().min(1).nullable(),
    totalMinor: moneyMinorSchema.nullable(),
  })
  .strict();

export const customerDetailSchema = z
  .object({ customer: customerSchema, visits: z.array(customerVisitSchema) })
  .strict();

export const customerListSchema = z.object({ customers: z.array(customerSchema) }).strict();

export const customerSearchQuerySchema = z
  .object({ q: z.string().trim().max(120).optional() })
  .strict();

/** The order the cashier links the customer to, at the outlet in the request. */
export const linkCustomerOrderSchema = z.object({ orderId: z.uuid() }).strict();

/** The customer linked to an order, if any. */
export const orderCustomerSchema = z.object({ customer: customerSchema.nullable() }).strict();

export type CreateCustomer = z.infer<typeof createCustomerSchema>;

export type Customer = z.infer<typeof customerSchema>;

export type CustomerDetail = z.infer<typeof customerDetailSchema>;

export type CustomerVisit = z.infer<typeof customerVisitSchema>;

export type LinkCustomerOrder = z.infer<typeof linkCustomerOrderSchema>;

export type UpdateCustomer = z.infer<typeof updateCustomerSchema>;
