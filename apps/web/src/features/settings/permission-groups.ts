import { PERMISSIONS, type PermissionKey } from "@merchant/contracts";

/**
 * Permissions as a person choosing them thinks of them: by the part of the
 * business they open, not by their technical prefix. Every permission is in
 * exactly one group; a test keeps this list complete.
 */
export const PERMISSION_GROUPS = [
  {
    key: "selling",
    permissions: [
      PERMISSIONS.orderCreate,
      PERMISSIONS.orderCancel,
      PERMISSIONS.paymentConfirm,
      PERMISSIONS.paymentRefund,
      PERMISSIONS.paymentReconcile,
      PERMISSIONS.shiftOpen,
      PERMISSIONS.shiftClose,
      PERMISSIONS.cashVarianceApprove,
    ],
  },
  { key: "catalog", permissions: [PERMISSIONS.catalogRead, PERMISSIONS.catalogManage] },
  {
    key: "tables",
    permissions: [
      PERMISSIONS.tableView,
      PERMISSIONS.tableManage,
      PERMISSIONS.tableLayoutManage,
      PERMISSIONS.tableQrManage,
      PERMISSIONS.orderMoveTable,
    ],
  },
  {
    key: "inventory",
    permissions: [
      PERMISSIONS.inventoryReceive,
      PERMISSIONS.inventoryAdjust,
      PERMISSIONS.inventoryStocktake,
    ],
  },
  {
    key: "finance",
    permissions: [
      PERMISSIONS.financeDashboardView,
      PERMISSIONS.financeExpenseCreate,
      PERMISSIONS.financeReportExport,
    ],
  },
  {
    key: "business",
    permissions: [
      PERMISSIONS.organizationRead,
      PERMISSIONS.organizationManage,
      PERMISSIONS.deviceRead,
      PERMISSIONS.deviceManage,
    ],
  },
  {
    key: "people",
    permissions: [
      PERMISSIONS.accessMembershipManage,
      PERMISSIONS.accessRoleRead,
      PERMISSIONS.accessRoleManage,
    ],
  },
] as const satisfies ReadonlyArray<{ key: string; permissions: readonly PermissionKey[] }>;

/** "Kasir Senior" becomes KASIR_SENIOR: the stable code of a role the business makes. */
export function roleCodeFromName(name: string) {
  return (
    name
      .normalize("NFKD")
      // "é" was split into "e" and its accent; the accent is dropped, the letter kept.
      .replace(/\p{M}/gu, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase()
      .slice(0, 80)
  );
}
