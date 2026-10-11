import { PERMISSIONS, type PermissionKey } from "@merchant/contracts";

/**
 * Who a refund answers to (flowchart.md 5.4): the person at the cashier when
 * they may refund themselves, otherwise an approver who must be checked.
 * Without either there is no refund.
 */
export function refundAuthority(
  permissionKeys: readonly PermissionKey[],
  hasApproval: boolean,
): "approval" | "own" | "refused" {
  if (permissionKeys.includes(PERMISSIONS.paymentRefund)) return "own";
  return hasApproval ? "approval" : "refused";
}
