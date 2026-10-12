/**
 * An order as the kitchen needs it: what to prepare and for whom, with the
 * notes people typed. No price is part of this shape, so none can reach the
 * kitchen through it.
 *
 * Events do not carry free text (security.md 10), so the handler of an order
 * event asks the owner of orders for these by ID. The kitchen declares what
 * it needs; the application root connects it to the order kernel.
 */
export type KitchenOrder = {
  /** True when the order was canceled before the kitchen heard of it. */
  canceled: boolean;
  items: Array<{ modifiers: string[]; name: string; note?: string; quantity: number }>;
  orderLabel: string;
  source: "POS" | "SELF_ORDER";
};

export interface KitchenOrderSource {
  /** The order at this outlet, or null when there is none. */
  kitchenOrder(tenantId: string, outletId: string, orderId: string): Promise<KitchenOrder | null>;
}

export const KITCHEN_ORDER_SOURCE = Symbol("KITCHEN_ORDER_SOURCE");
