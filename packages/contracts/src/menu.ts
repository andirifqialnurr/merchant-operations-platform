import * as z from "zod";

import { currencyCodeSchema, moneyMinorSchema } from "./money.ts";
import { catalogNameSchema, modifierSelectionTypeSchema, selectionCountSchema } from "./catalog.ts";

/**
 * What a cashier can sell at one outlet right now. Only sellable products,
 * variants, and modifier options appear, each with the price that applies at
 * the outlet, so the screen never has to work out availability or price.
 */
export const sellableMenuOptionSchema = z.object({
  id: z.uuid(),
  name: catalogNameSchema,
  priceDeltaMinor: moneyMinorSchema,
});

export const sellableMenuModifierGroupSchema = z.object({
  id: z.uuid(),
  maxSelections: selectionCountSchema,
  minSelections: selectionCountSchema,
  name: catalogNameSchema,
  options: z.array(sellableMenuOptionSchema),
  selectionType: modifierSelectionTypeSchema,
});

export const sellableMenuProductSchema = z.object({
  categoryId: z.uuid(),
  currency: currencyCodeSchema,
  id: z.uuid(),
  modifierGroups: z.array(sellableMenuModifierGroupSchema),
  name: catalogNameSchema,
  /** Outlet price before any variant or modifier surcharge. */
  priceMinor: moneyMinorSchema,
  /** When not empty, exactly one variant must be chosen. */
  variants: z.array(sellableMenuOptionSchema),
});

export const sellableMenuSchema = z.object({
  categories: z.array(z.object({ id: z.uuid(), name: catalogNameSchema })),
  outletId: z.uuid(),
  products: z.array(sellableMenuProductSchema),
});

export type SellableMenu = z.infer<typeof sellableMenuSchema>;

export type SellableMenuModifierGroup = z.infer<typeof sellableMenuModifierGroupSchema>;

export type SellableMenuOption = z.infer<typeof sellableMenuOptionSchema>;

export type SellableMenuProduct = z.infer<typeof sellableMenuProductSchema>;
