import * as z from "zod";

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
  cashVarianceApprove: "cash_variance.approve",
  financeDashboardView: "finance.dashboard.view",
  financeExpenseCreate: "finance.expense.create",
  financeReportExport: "finance.report.export",
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
