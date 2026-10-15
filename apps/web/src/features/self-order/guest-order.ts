import type { GuestOrder, GuestOrderStatus, GuestVisit } from "@merchant/contracts";

import { addLine, isLineComplete, type CartLine, type MenuItem } from "@/lib/menu-cart";

/** The steps a guest sees an order go through; a canceled order has none. */
export const GUEST_STEPS = ["RECEIVED", "PREPARING", "READY"] as const satisfies readonly Exclude<
  GuestOrderStatus,
  "CANCELED"
>[];

/** Where an order is among the steps, or null when it was canceled. */
export function stepOf(status: GuestOrderStatus) {
  return status === "CANCELED" ? null : GUEST_STEPS.indexOf(status);
}

/** Newest first: the order just sent is the one a guest looks for. */
export function newestFirst(visit: GuestVisit | undefined): GuestOrder[] {
  return [...(visit?.orders ?? [])].reverse();
}

/**
 * "Order again": the plain lines of an order that the menu still sells as
 * they were. A line with a variant or modifiers is left out; the guest picks
 * those again from the menu.
 */
export function reorderLines(order: GuestOrder, menu: readonly MenuItem[]): CartLine[] {
  const products = new Map(menu.map((product) => [product.id, product]));
  const lines: CartLine[] = [];
  for (const line of order.lines) {
    if (!line.productId) continue;
    const product = products.get(line.productId);
    const candidate: CartLine = {
      modifierOptionIds: [],
      productId: line.productId,
      quantity: line.quantity,
    };
    if (product && isLineComplete(product, candidate)) lines.push(candidate);
  }
  return lines;
}

/** Adds an earlier order's plain lines to the cart. */
export function addOrderAgain(
  cart: readonly CartLine[],
  order: GuestOrder,
  menu: readonly MenuItem[],
): CartLine[] {
  return reorderLines(order, menu).reduce<CartLine[]>(
    (next, line) => addLine(next, line),
    [...cart],
  );
}
