import * as z from "zod";

import { currencyCodeSchema } from "./money.ts";
import { organizationRecordTimestampsSchema, uniqueIds, uniquePermissions } from "./internal.ts";
import {
  organizationNameSchema,
  organizationSlugSchema,
  organizationUnitStatusSchema,
  outletCodeSchema,
} from "./organization.ts";

export const PERMISSIONS = {
  accessMembershipManage: "access.membership.manage",
  accessRoleManage: "access.role.manage",
  accessRoleRead: "access.role.read",
  catalogManage: "catalog.manage",
  catalogRead: "catalog.read",
  customerContactView: "customer.contact.view",
  customerManage: "customer.manage",
  customerView: "customer.view",
  cashVarianceApprove: "cash_variance.approve",
  deviceManage: "device.manage",
  deviceRead: "device.read",
  financeDashboardView: "finance.dashboard.view",
  financeExpenseCreate: "finance.expense.create",
  financeReportExport: "finance.report.export",
  kdsIntakeManage: "kds.intake.manage",
  kdsTicketManage: "kds.ticket.manage",
  kdsTicketView: "kds.ticket.view",
  inventoryAdjust: "inventory.adjust",
  inventoryReceive: "inventory.receive",
  inventoryStocktake: "inventory.stocktake",
  orderCancel: "order.cancel",
  orderCreate: "order.create",
  orderMoveTable: "order.move_table",
  organizationManage: "organization.manage",
  organizationRead: "organization.read",
  paymentConfirm: "payment.confirm",
  paymentReconcile: "payment.reconcile",
  paymentRefund: "payment.refund",
  shiftClose: "shift.close",
  shiftOpen: "shift.open",
  tableLayoutManage: "table.layout.manage",
  tableManage: "table.manage",
  tableQrManage: "table.qr.manage",
  tableView: "table.view",
} as const;

export const permissionKeySchema = z.enum(Object.values(PERMISSIONS));

export const membershipStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const roleCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(80)
  .regex(/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/);

export const roleSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  code: roleCodeSchema,
  name: organizationNameSchema,
  isSystem: z.boolean(),
  status: organizationUnitStatusSchema,
  permissionKeys: z.array(permissionKeySchema),
});

export const createRoleSchema = z.object({
  code: roleCodeSchema,
  name: organizationNameSchema,
  permissionKeys: z
    .array(permissionKeySchema)
    .min(1)
    .refine(uniquePermissions, { message: "Permission tidak boleh duplikat." }),
});

export const updateRoleSchema = z
  .object({
    name: organizationNameSchema.optional(),
    permissionKeys: z
      .array(permissionKeySchema)
      .min(1)
      .refine(uniquePermissions, { message: "Permission tidak boleh duplikat." })
      .optional(),
    status: organizationUnitStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan role wajib diisi.",
  });

export const membershipSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  status: membershipStatusSchema,
  allOutlets: z.boolean(),
  roleIds: z.array(z.uuid()),
  outletIds: z.array(z.uuid()),
});

/**
 * A member of the workspace with who they are. Only for people who manage
 * members: the plain membership (and every event) carries no name or email.
 */
/** Six digits, typed on someone else's screen to approve an action there. */
export const approvalPinSchema = z.string().regex(/^\d{6}$/);

export const setApprovalPinSchema = z.object({ pin: approvalPinSchema });

/** Whether the signed-in person may approve at all, and whether their PIN is set. */
export const approvalPinStatusSchema = z.object({
  canApprove: z.boolean(),
  hasPin: z.boolean(),
});

/** Someone who can approve an action at a location right now. Only the name is shown. */
export const approverSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  userId: z.uuid(),
});

export const approverListSchema = z.object({ approvers: z.array(approverSchema) });

/** Who approves and the PIN they typed. The PIN is checked and never stored or logged. */
export const approvalSchema = z.object({
  approverUserId: z.uuid(),
  pin: approvalPinSchema,
});

export const memberSchema = z.object({
  allOutlets: z.boolean(),
  /** True when this person has set an approval PIN. The PIN itself is never readable. */
  hasApprovalPin: z.boolean(),
  displayName: z.string().trim().min(1).max(160),
  email: z.email().max(254),
  membershipId: z.uuid(),
  outletIds: z.array(z.uuid()),
  roleIds: z.array(z.uuid()),
  status: membershipStatusSchema,
  userId: z.uuid(),
});

export const memberListSchema = z.object({ members: z.array(memberSchema) });

export const createMembershipSchema = z
  .object({
    userId: z.uuid(),
    roleIds: z.array(z.uuid()).min(1).refine(uniqueIds, { message: "Role tidak boleh duplikat." }),
    allOutlets: z.boolean().default(false),
    outletIds: z.array(z.uuid()).default([]).refine(uniqueIds, {
      message: "Outlet tidak boleh duplikat.",
    }),
  })
  .refine((value) => !value.allOutlets || value.outletIds.length === 0, {
    message: "outletIds harus kosong ketika allOutlets aktif.",
    path: ["outletIds"],
  });

/** How many sign-ins were ended. */
export const sessionRevocationSchema = z.object({
  revokedSessions: z.number().int().min(0),
});

export const updateMembershipSchema = z
  .object({
    status: membershipStatusSchema.optional(),
    roleIds: z
      .array(z.uuid())
      .min(1)
      .refine(uniqueIds, {
        message: "Role tidak boleh duplikat.",
      })
      .optional(),
    allOutlets: z.boolean().optional(),
    outletIds: z
      .array(z.uuid())
      .refine(uniqueIds, {
        message: "Outlet tidak boleh duplikat.",
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan membership wajib diisi.",
  })
  .refine(
    (value) => !(value.allOutlets === true && value.outletIds && value.outletIds.length > 0),
    { message: "outletIds harus kosong ketika allOutlets aktif.", path: ["outletIds"] },
  );

export const authorizationContextSchema = z.object({
  allOutlets: z.boolean(),
  /** Set when the session was opened on a registered device. */
  deviceId: z.uuid().optional(),
  membershipId: z.uuid(),
  outletIds: z.array(z.uuid()),
  permissionKeys: z.array(permissionKeySchema),
  tenantId: z.uuid(),
  userId: z.uuid(),
});

export const workspaceOutletSchema = z.object({
  code: outletCodeSchema,
  id: z.uuid(),
  name: organizationNameSchema,
  status: organizationUnitStatusSchema,
});

export const workspaceContextSchema = z.object({
  allOutlets: z.boolean(),
  membershipId: z.uuid(),
  outlets: z.array(workspaceOutletSchema),
  permissionKeys: z.array(permissionKeySchema),
  tenant: z.object({
    /** Every amount of the workspace is in this currency. */
    currency: currencyCodeSchema,
    id: z.uuid(),
    name: organizationNameSchema,
    slug: organizationSlugSchema,
  }),
});

export const workspaceContextsSchema = z.array(workspaceContextSchema);

export type AuthorizationContext = z.infer<typeof authorizationContextSchema>;

export type WorkspaceContext = z.infer<typeof workspaceContextSchema>;

export type CreateMembership = z.infer<typeof createMembershipSchema>;

export type CreateRole = z.infer<typeof createRoleSchema>;

export type Membership = z.infer<typeof membershipSchema>;

export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export type PermissionKey = z.infer<typeof permissionKeySchema>;

export type Role = z.infer<typeof roleSchema>;

export type UpdateMembership = z.infer<typeof updateMembershipSchema>;

export type UpdateRole = z.infer<typeof updateRoleSchema>;

export type SessionRevocation = z.infer<typeof sessionRevocationSchema>;

export type Member = z.infer<typeof memberSchema>;

export type Approval = z.infer<typeof approvalSchema>;

export type ApprovalPinStatus = z.infer<typeof approvalPinStatusSchema>;

export type Approver = z.infer<typeof approverSchema>;

export type SetApprovalPin = z.infer<typeof setApprovalPinSchema>;

export type MemberList = z.infer<typeof memberListSchema>;
