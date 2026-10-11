import type { SellableMenu } from "@merchant/contracts";

/**
 * What the order kernel needs to price an order: what the outlet sells right
 * now, with its prices. The kernel does not know who answers; the application
 * root connects this port to the catalog kernel.
 */
export interface SellableMenuSource {
  getSellableMenu(tenantId: string, outletId: string): Promise<SellableMenu>;
}

export const SELLABLE_MENU_SOURCE = Symbol("SELLABLE_MENU_SOURCE");
