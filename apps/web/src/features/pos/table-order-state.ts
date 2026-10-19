import type { TableSessionDetail } from "@merchant/contracts";

export type VisitOrder = TableSessionDetail["orders"][number];

export function isPendingGuestOrder(order: Pick<VisitOrder, "moderationStatus" | "status">) {
  return order.moderationStatus === "PENDING" && order.status !== "CANCELED";
}

/** One status location per order, without calling a pending estimate unpaid/paid. */
export function visitOrderLabel(order: Pick<VisitOrder, "moderationStatus" | "status" | "paid">) {
  if (order.moderationStatus === "REJECTED") return "orderRejected";
  if (order.status === "CANCELED") return "orderCanceled";
  if (isPendingGuestOrder(order)) return "orderPending";
  if (order.paid) return "orderPaid";
  return order.moderationStatus === "ACCEPTED" ? "orderAcceptedUnpaid" : "orderUnpaid";
}

/** Pending rounds must be decided even when the accepted debt is zero. */
export function visitHasPending(
  orders: readonly Pick<VisitOrder, "moderationStatus" | "status">[],
) {
  return orders.some(isPendingGuestOrder);
}
