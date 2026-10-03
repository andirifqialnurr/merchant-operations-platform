import * as z from "zod";

import { createOrderItemSchema } from "./orders.ts";

/**
 * A cart set aside to finish later. It keeps only what was chosen; prices
 * are worked out again from the menu when it is resumed.
 */
export const holdCartSchema = z.object({
  items: z.array(createOrderItemSchema).min(1).max(100),
  label: z.string().trim().min(1).max(60),
});

export const heldCartSchema = z.object({
  createdAt: z.iso.datetime(),
  createdByName: z.string().min(1).max(160),
  id: z.uuid(),
  itemCount: z.number().int().min(1),
  label: z.string().min(1).max(60),
});

export const heldCartListSchema = z.object({ heldCarts: z.array(heldCartSchema) });

/** What a resumed cart hands back to the cashier's screen. */
export const resumedCartSchema = z.object({
  items: z.array(createOrderItemSchema),
  label: z.string().min(1).max(60),
});

export type HeldCart = z.infer<typeof heldCartSchema>;

export type HeldCartList = z.infer<typeof heldCartListSchema>;

export type HoldCart = z.infer<typeof holdCartSchema>;

export type ResumedCart = z.infer<typeof resumedCartSchema>;
