import * as z from "zod";

export const API_HEADERS = {
  idempotencyKey: "idempotency-key",
  outletId: "x-outlet-id",
  requestId: "x-request-id",
  tenantId: "x-tenant-id",
} as const;

export const requestIdSchema = z.string().trim().min(1).max(100).meta({
  description: "Request correlation identifier",
  example: "req_01JZ8X4VYAT7Y0G4E5JD2Y6D9M",
});

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(255)
  .regex(/^[A-Za-z0-9._:-]+$/)
  .meta({ description: "Stable key for retry-safe write operations" });

export const requestContextHeadersSchema = z.object({
  [API_HEADERS.outletId]: z.uuid(),
  [API_HEADERS.tenantId]: z.uuid(),
  [API_HEADERS.requestId]: requestIdSchema.optional(),
  [API_HEADERS.idempotencyKey]: idempotencyKeySchema.optional(),
});

export const tenantRequestHeadersSchema = z.object({
  [API_HEADERS.tenantId]: z.uuid(),
  [API_HEADERS.outletId]: z.uuid().optional(),
  [API_HEADERS.requestId]: requestIdSchema.optional(),
});

export const platformRequestHeadersSchema = z.object({
  [API_HEADERS.requestId]: requestIdSchema.optional(),
});

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const cursorPageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable(),
});

export function createCursorPageSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pageInfo: cursorPageInfoSchema,
  });
}

export const apiErrorSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_.-]*$/),
  message: z.string().min(1),
  requestId: requestIdSchema,
  details: z.record(z.string(), z.unknown()).optional(),
});

export const validationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.array(z.union([z.string(), z.number()])),
});

export const validationErrorSchema = apiErrorSchema.extend({
  code: z.literal("VALIDATION_ERROR"),
  details: z.object({ issues: z.array(validationIssueSchema) }),
});

export const healthResponseSchema = z.object({
  service: z.literal("api"),
  status: z.literal("ok"),
});

export const authLoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).max(128),
});

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1).max(160),
});

export const authSessionSchema = z.object({
  expiresAt: z.iso.datetime(),
  user: authUserSchema,
});

export const authLogoutResponseSchema = z.object({
  success: z.literal(true),
});

export const PLATFORM_PERMISSIONS = {
  docsRead: "platform.docs.read",
  subscriptionManage: "platform.subscription.manage",
  subscriptionRead: "platform.subscription.read",
  supportAccess: "platform.support.access",
  tenantManage: "platform.tenant.manage",
  tenantRead: "platform.tenant.read",
} as const;

export const platformRoleSchema = z.enum(["OWNER", "ADMIN", "SUPPORT"]);
export const platformPermissionKeySchema = z.enum(Object.values(PLATFORM_PERMISSIONS));
export const platformUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1).max(160),
  role: platformRoleSchema,
  permissionKeys: z.array(platformPermissionKeySchema),
});
export const platformSessionSchema = z.object({
  expiresAt: z.iso.datetime(),
  user: platformUserSchema,
});
export const provisionPlatformUserSchema = authLoginRequestSchema.extend({
  displayName: z.string().trim().min(2).max(160),
  role: platformRoleSchema,
});

export const sessionTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const organizationUnitStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const organizationNameSchema = z.string().trim().min(2).max(160);
export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const outletCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(40)
  .regex(/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/);
export const timezoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^(?:UTC|[A-Za-z_]+\/[A-Za-z0-9_+.-]+)$/);

const organizationRecordTimestampsSchema = z.object({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const tenantSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  status: organizationUnitStatusSchema,
});

export const brandSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  status: organizationUnitStatusSchema,
});

export const outletSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  brandId: z.uuid(),
  code: outletCodeSchema,
  name: organizationNameSchema,
  timezone: timezoneSchema,
  status: organizationUnitStatusSchema,
});

export const createTenantSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
});

export const updateTenantSchema = z
  .object({
    name: organizationNameSchema.optional(),
    slug: organizationSlugSchema.optional(),
    status: organizationUnitStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Perubahan tenant wajib diisi." });

export const createBrandSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
});

export const updateBrandSchema = z
  .object({
    name: organizationNameSchema.optional(),
    slug: organizationSlugSchema.optional(),
    status: organizationUnitStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Perubahan brand wajib diisi." });

export const createOutletSchema = z.object({
  brandId: z.uuid(),
  code: outletCodeSchema,
  name: organizationNameSchema,
  timezone: timezoneSchema.default("Asia/Jakarta"),
});

export const updateOutletSchema = z
  .object({
    brandId: z.uuid().optional(),
    code: outletCodeSchema.optional(),
    name: organizationNameSchema.optional(),
    timezone: timezoneSchema.optional(),
    status: organizationUnitStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Perubahan outlet wajib diisi." });

export const organizationSnapshotSchema = z.object({
  tenant: tenantSchema,
  brands: z.array(brandSchema),
  outlets: z.array(outletSchema),
});

export const catalogRecordStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const productAvailabilitySchema = z.enum(["AVAILABLE", "SOLD_OUT"]);
export const catalogNameSchema = z.string().trim().min(2).max(160);
export const catalogSlugSchema = organizationSlugSchema;
export const moneyMinorSchema = z
  .string()
  .regex(/^(?:0|[1-9][0-9]{0,17})$/)
  .meta({ description: "Non-negative amount in currency minor units", example: "25000" });
export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/)
  .meta({ example: "IDR" });
export const displayOrderSchema = z.number().int().min(0).max(100_000);

export const catalogCategorySchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  name: catalogNameSchema,
  slug: catalogSlugSchema,
  displayOrder: displayOrderSchema,
  status: catalogRecordStatusSchema,
});

export const catalogProductSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  categoryId: z.uuid(),
  name: catalogNameSchema,
  slug: catalogSlugSchema,
  description: z.string().trim().min(1).max(2_000).nullable(),
  basePriceMinor: moneyMinorSchema,
  currency: currencyCodeSchema,
  availability: productAvailabilitySchema,
  status: catalogRecordStatusSchema,
});

export const createCatalogCategorySchema = z.object({
  name: catalogNameSchema,
  slug: catalogSlugSchema,
  displayOrder: displayOrderSchema.default(0),
});

export const updateCatalogCategorySchema = z
  .object({
    name: catalogNameSchema.optional(),
    slug: catalogSlugSchema.optional(),
    displayOrder: displayOrderSchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan kategori wajib diisi.",
  });

export const createCatalogProductSchema = z.object({
  categoryId: z.uuid(),
  name: catalogNameSchema,
  slug: catalogSlugSchema,
  description: z.string().trim().min(1).max(2_000).nullable().optional(),
  basePriceMinor: moneyMinorSchema,
  currency: currencyCodeSchema.default("IDR"),
  availability: productAvailabilitySchema.default("AVAILABLE"),
});

export const updateCatalogProductSchema = z
  .object({
    categoryId: z.uuid().optional(),
    name: catalogNameSchema.optional(),
    slug: catalogSlugSchema.optional(),
    description: z.string().trim().min(1).max(2_000).nullable().optional(),
    basePriceMinor: moneyMinorSchema.optional(),
    currency: currencyCodeSchema.optional(),
    availability: productAvailabilitySchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan produk wajib diisi.",
  });

export const modifierSelectionTypeSchema = z.enum(["SINGLE", "MULTIPLE"]);
export const selectionCountSchema = z.number().int().min(0).max(100);
export const productImageObjectKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(512)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
  .refine((value) => !value.split("/").includes(".."), {
    message: "Object key tidak boleh memuat path traversal.",
  });
export const productImageContentTypeSchema = z.enum([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const productImageDimensionSchema = z.number().int().min(1).max(100_000);

const modifierSelectionRuleSchema = z
  .object({
    maxSelections: selectionCountSchema,
    minSelections: selectionCountSchema,
    selectionType: modifierSelectionTypeSchema,
  })
  .refine((value) => value.minSelections <= value.maxSelections, {
    message: "Minimum pilihan tidak boleh melebihi maksimum pilihan.",
  })
  .refine((value) => value.selectionType === "MULTIPLE" || value.maxSelections <= 1, {
    message: "Modifier SINGLE hanya boleh memiliki maksimum satu pilihan.",
  });

export const catalogProductVariantSchema = organizationRecordTimestampsSchema.extend({
  availability: productAvailabilitySchema,
  displayOrder: displayOrderSchema,
  id: z.uuid(),
  name: catalogNameSchema,
  priceDeltaMinor: moneyMinorSchema,
  productId: z.uuid(),
  status: catalogRecordStatusSchema,
  tenantId: z.uuid(),
});

export const createCatalogProductVariantSchema = z.object({
  availability: productAvailabilitySchema.default("AVAILABLE"),
  displayOrder: displayOrderSchema.default(0),
  name: catalogNameSchema,
  priceDeltaMinor: moneyMinorSchema.default("0"),
  productId: z.uuid(),
});

export const updateCatalogProductVariantSchema = z
  .object({
    availability: productAvailabilitySchema.optional(),
    displayOrder: displayOrderSchema.optional(),
    name: catalogNameSchema.optional(),
    priceDeltaMinor: moneyMinorSchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan variant wajib diisi.",
  });

export const catalogModifierGroupSchema = organizationRecordTimestampsSchema
  .extend({
    displayOrder: displayOrderSchema,
    id: z.uuid(),
    name: catalogNameSchema,
    ...modifierSelectionRuleSchema.shape,
    status: catalogRecordStatusSchema,
    tenantId: z.uuid(),
  })
  .refine((value) => value.minSelections <= value.maxSelections, {
    message: "Minimum pilihan tidak boleh melebihi maksimum pilihan.",
  })
  .refine((value) => value.selectionType === "MULTIPLE" || value.maxSelections <= 1, {
    message: "Modifier SINGLE hanya boleh memiliki maksimum satu pilihan.",
  });

export const createCatalogModifierGroupSchema = z
  .object({
    displayOrder: displayOrderSchema.default(0),
    name: catalogNameSchema,
    maxSelections: selectionCountSchema.default(1),
    minSelections: selectionCountSchema.default(0),
    selectionType: modifierSelectionTypeSchema.default("SINGLE"),
  })
  .pipe(
    z
      .object({
        displayOrder: displayOrderSchema,
        name: catalogNameSchema,
        ...modifierSelectionRuleSchema.shape,
      })
      .refine((value) => value.minSelections <= value.maxSelections, {
        message: "Minimum pilihan tidak boleh melebihi maksimum pilihan.",
      })
      .refine((value) => value.selectionType === "MULTIPLE" || value.maxSelections <= 1, {
        message: "Modifier SINGLE hanya boleh memiliki maksimum satu pilihan.",
      }),
  );

export const updateCatalogModifierGroupSchema = z
  .object({
    displayOrder: displayOrderSchema.optional(),
    maxSelections: selectionCountSchema.optional(),
    minSelections: selectionCountSchema.optional(),
    name: catalogNameSchema.optional(),
    selectionType: modifierSelectionTypeSchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan modifier group wajib diisi.",
  });

export const catalogModifierOptionSchema = organizationRecordTimestampsSchema.extend({
  availability: productAvailabilitySchema,
  displayOrder: displayOrderSchema,
  groupId: z.uuid(),
  id: z.uuid(),
  name: catalogNameSchema,
  priceDeltaMinor: moneyMinorSchema,
  status: catalogRecordStatusSchema,
  tenantId: z.uuid(),
});

export const createCatalogModifierOptionSchema = z.object({
  availability: productAvailabilitySchema.default("AVAILABLE"),
  displayOrder: displayOrderSchema.default(0),
  groupId: z.uuid(),
  name: catalogNameSchema,
  priceDeltaMinor: moneyMinorSchema.default("0"),
});

export const updateCatalogModifierOptionSchema = z
  .object({
    availability: productAvailabilitySchema.optional(),
    displayOrder: displayOrderSchema.optional(),
    name: catalogNameSchema.optional(),
    priceDeltaMinor: moneyMinorSchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan modifier option wajib diisi.",
  });

export const catalogProductModifierGroupSchema = organizationRecordTimestampsSchema.extend({
  displayOrder: displayOrderSchema,
  id: z.uuid(),
  modifierGroupId: z.uuid(),
  productId: z.uuid(),
  status: catalogRecordStatusSchema,
  tenantId: z.uuid(),
});

export const createCatalogProductModifierGroupSchema = z.object({
  displayOrder: displayOrderSchema.default(0),
  modifierGroupId: z.uuid(),
  productId: z.uuid(),
});

export const updateCatalogProductModifierGroupSchema = z
  .object({
    displayOrder: displayOrderSchema.optional(),
    status: catalogRecordStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan assignment modifier wajib diisi.",
  });

export const catalogProductImageSchema = organizationRecordTimestampsSchema.extend({
  altText: z.string().trim().min(1).max(300).nullable(),
  contentType: productImageContentTypeSchema,
  displayOrder: displayOrderSchema,
  height: productImageDimensionSchema.nullable(),
  id: z.uuid(),
  isPrimary: z.boolean(),
  objectKey: productImageObjectKeySchema,
  productId: z.uuid(),
  status: catalogRecordStatusSchema,
  tenantId: z.uuid(),
  width: productImageDimensionSchema.nullable(),
});

export const createCatalogProductImageSchema = z.object({
  altText: z.string().trim().min(1).max(300).nullable().optional(),
  contentType: productImageContentTypeSchema,
  displayOrder: displayOrderSchema.default(0),
  height: productImageDimensionSchema.nullable().optional(),
  isPrimary: z.boolean().default(false),
  objectKey: productImageObjectKeySchema,
  productId: z.uuid(),
  width: productImageDimensionSchema.nullable().optional(),
});

export const updateCatalogProductImageSchema = z
  .object({
    altText: z.string().trim().min(1).max(300).nullable().optional(),
    displayOrder: displayOrderSchema.optional(),
    height: productImageDimensionSchema.nullable().optional(),
    isPrimary: z.boolean().optional(),
    status: catalogRecordStatusSchema.optional(),
    width: productImageDimensionSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Perubahan product image wajib diisi.",
  });

export const catalogSnapshotSchema = z.object({
  categories: z.array(catalogCategorySchema),
  modifierGroups: z.array(catalogModifierGroupSchema),
  modifierOptions: z.array(catalogModifierOptionSchema),
  productImages: z.array(catalogProductImageSchema),
  productModifierGroups: z.array(catalogProductModifierGroupSchema),
  productVariants: z.array(catalogProductVariantSchema),
  products: z.array(catalogProductSchema),
});

export const MODULES = {
  coreAudit: "CORE_AUDIT",
  coreBill: "CORE_BILL",
  coreCatalog: "CORE_CATALOG",
  coreIdentity: "CORE_IDENTITY",
  coreOrder: "CORE_ORDER",
  corePaymentLedger: "CORE_PAYMENT_LEDGER",
  coreSubscription: "CORE_SUBSCRIPTION",
  coreTenancy: "CORE_TENANCY",
  cafeProfile: "CAFE_PROFILE",
  customerBasic: "CUSTOMER_BASIC",
  financeBasic: "FINANCE_BASIC",
  inventoryBasic: "INVENTORY_BASIC",
  kds: "KDS",
  pos: "POS",
  tableSelfOrder: "TABLE_SELF_ORDER",
} as const;

export const PLAN_CODES = {
  cafeDigital: "CAFE_DIGITAL",
  cafeOperations: "CAFE_OPERATIONS",
  customModular: "CUSTOM_MODULAR",
  posBasic: "POS_BASIC",
  profile: "PROFILE",
} as const;

export const moduleKeySchema = z.enum(Object.values(MODULES));
export const planCodeSchema = z.enum(Object.values(PLAN_CODES));
export const moduleKindSchema = z.enum(["CORE", "COMMERCIAL"]);
export const subscriptionStatusSchema = z.enum([
  "TRIAL",
  "ACTIVE",
  "GRACE",
  "SUSPENDED",
  "TERMINATED",
]);
export const entitlementSourceSchema = z.enum(["CORE", "PLAN", "OVERRIDE", "DEPENDENCY", "NONE"]);

export const replaceSubscriptionSchema = z.object({
  planCode: planCodeSchema,
  status: subscriptionStatusSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable().optional(),
  graceEndsAt: z.iso.datetime().nullable().optional(),
});

export const setTenantEntitlementSchema = z.object({
  moduleKey: moduleKeySchema,
  enabled: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export const platformEntitlementParamsSchema = z.object({
  id: z.uuid(),
  moduleKey: moduleKeySchema,
});

export const platformSetTenantEntitlementSchema = setTenantEntitlementSchema.omit({
  moduleKey: true,
});

const entitlementOverrideSchema = z.object({
  actorId: z.uuid().nullable(),
  effectiveAt: z.iso.datetime(),
  enabled: z.boolean(),
  reason: z.string().min(1).max(500),
});

export const subscriptionSchema = organizationRecordTimestampsSchema.extend({
  id: z.uuid(),
  tenantId: z.uuid(),
  planCode: planCodeSchema,
  planName: organizationNameSchema,
  status: subscriptionStatusSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  graceEndsAt: z.iso.datetime().nullable(),
});

export const moduleEntitlementSchema = z.object({
  key: moduleKeySchema,
  name: organizationNameSchema,
  kind: moduleKindSchema,
  enabled: z.boolean(),
  source: entitlementSourceSchema,
  reason: z.string().min(1),
  planDefault: z.boolean(),
  override: entitlementOverrideSchema.nullable(),
  requiredBy: z.array(moduleKeySchema),
});

export const entitlementSnapshotSchema = z.object({
  subscription: subscriptionSchema.nullable(),
  modules: z.array(moduleEntitlementSchema),
});

export const platformTenantMasterSchema = z.object({
  entitlement: entitlementSnapshotSchema,
  organization: organizationSnapshotSchema,
});

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

const uniqueIds = (values: string[]) => new Set(values).size === values.length;
const uniquePermissions = (values: PermissionKey[]) => new Set(values).size === values.length;

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

export const entityIdParamsSchema = z.object({ id: z.uuid() });

export type ApiError = z.infer<typeof apiErrorSchema>;
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type AuthLogoutResponse = z.infer<typeof authLogoutResponseSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type CatalogCategory = z.infer<typeof catalogCategorySchema>;
export type CatalogModifierGroup = z.infer<typeof catalogModifierGroupSchema>;
export type CatalogModifierOption = z.infer<typeof catalogModifierOptionSchema>;
export type CatalogProduct = z.infer<typeof catalogProductSchema>;
export type CatalogProductImage = z.infer<typeof catalogProductImageSchema>;
export type CatalogProductModifierGroup = z.infer<typeof catalogProductModifierGroupSchema>;
export type CatalogProductVariant = z.infer<typeof catalogProductVariantSchema>;
export type CatalogRecordStatus = z.infer<typeof catalogRecordStatusSchema>;
export type CatalogSnapshot = z.infer<typeof catalogSnapshotSchema>;
export type AuthorizationContext = z.infer<typeof authorizationContextSchema>;
export type ContractSchema = z.ZodType;
export type CreateBrand = z.infer<typeof createBrandSchema>;
export type CreateCatalogCategory = z.infer<typeof createCatalogCategorySchema>;
export type CreateCatalogModifierGroup = z.infer<typeof createCatalogModifierGroupSchema>;
export type CreateCatalogModifierOption = z.infer<typeof createCatalogModifierOptionSchema>;
export type CreateCatalogProduct = z.infer<typeof createCatalogProductSchema>;
export type CreateCatalogProductImage = z.infer<typeof createCatalogProductImageSchema>;
export type CreateCatalogProductModifierGroup = z.infer<
  typeof createCatalogProductModifierGroupSchema
>;
export type CreateCatalogProductVariant = z.infer<typeof createCatalogProductVariantSchema>;
export type CreateMembership = z.infer<typeof createMembershipSchema>;
export type CreateRole = z.infer<typeof createRoleSchema>;
export type CreateOutlet = z.infer<typeof createOutletSchema>;
export type CreateTenant = z.infer<typeof createTenantSchema>;
export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type OrganizationSnapshot = z.infer<typeof organizationSnapshotSchema>;
export type OrganizationUnitStatus = z.infer<typeof organizationUnitStatusSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;
export type ModifierSelectionType = z.infer<typeof modifierSelectionTypeSchema>;
export type ModuleEntitlement = z.infer<typeof moduleEntitlementSchema>;
export type ModuleKey = z.infer<typeof moduleKeySchema>;
export type ModuleKind = z.infer<typeof moduleKindSchema>;
export type Outlet = z.infer<typeof outletSchema>;
export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;
export type PlanCode = z.infer<typeof planCodeSchema>;
export type PlatformEntitlementParams = z.infer<typeof platformEntitlementParamsSchema>;
export type PlatformPermissionKey = z.infer<typeof platformPermissionKeySchema>;
export type PlatformRequestHeaders = z.infer<typeof platformRequestHeadersSchema>;
export type PlatformRole = z.infer<typeof platformRoleSchema>;
export type PlatformSession = z.infer<typeof platformSessionSchema>;
export type PlatformSetTenantEntitlement = z.infer<typeof platformSetTenantEntitlementSchema>;
export type PlatformTenantMaster = z.infer<typeof platformTenantMasterSchema>;
export type PlatformUser = z.infer<typeof platformUserSchema>;
export type ProvisionPlatformUser = z.infer<typeof provisionPlatformUserSchema>;
export type RequestContextHeaders = z.infer<typeof requestContextHeadersSchema>;
export type PermissionKey = z.infer<typeof permissionKeySchema>;
export type ReplaceSubscription = z.infer<typeof replaceSubscriptionSchema>;
export type Role = z.infer<typeof roleSchema>;
export type SetTenantEntitlement = z.infer<typeof setTenantEntitlementSchema>;
export type Subscription = z.infer<typeof subscriptionSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type EntitlementSnapshot = z.infer<typeof entitlementSnapshotSchema>;
export type TenantRequestHeaders = z.infer<typeof tenantRequestHeadersSchema>;
export type Tenant = z.infer<typeof tenantSchema>;
export type UpdateBrand = z.infer<typeof updateBrandSchema>;
export type UpdateCatalogCategory = z.infer<typeof updateCatalogCategorySchema>;
export type UpdateCatalogModifierGroup = z.infer<typeof updateCatalogModifierGroupSchema>;
export type UpdateCatalogModifierOption = z.infer<typeof updateCatalogModifierOptionSchema>;
export type UpdateCatalogProduct = z.infer<typeof updateCatalogProductSchema>;
export type UpdateCatalogProductImage = z.infer<typeof updateCatalogProductImageSchema>;
export type UpdateCatalogProductModifierGroup = z.infer<
  typeof updateCatalogProductModifierGroupSchema
>;
export type UpdateCatalogProductVariant = z.infer<typeof updateCatalogProductVariantSchema>;
export type UpdateMembership = z.infer<typeof updateMembershipSchema>;
export type UpdateRole = z.infer<typeof updateRoleSchema>;
export type UpdateOutlet = z.infer<typeof updateOutletSchema>;
export type UpdateTenant = z.infer<typeof updateTenantSchema>;

export function toOpenApiSchema(schema: ContractSchema) {
  return z.toJSONSchema(schema, { target: "openapi-3.0" });
}

export const commonOpenApiSchemas = {
  ApiError: toOpenApiSchema(apiErrorSchema),
  AuthLoginRequest: toOpenApiSchema(authLoginRequestSchema),
  AuthLogoutResponse: toOpenApiSchema(authLogoutResponseSchema),
  AuthSession: toOpenApiSchema(authSessionSchema),
  AuthUser: toOpenApiSchema(authUserSchema),
  AuthorizationContext: toOpenApiSchema(authorizationContextSchema),
  Brand: toOpenApiSchema(brandSchema),
  CatalogCategory: toOpenApiSchema(catalogCategorySchema),
  CatalogModifierGroup: toOpenApiSchema(catalogModifierGroupSchema),
  CatalogModifierOption: toOpenApiSchema(catalogModifierOptionSchema),
  CatalogProduct: toOpenApiSchema(catalogProductSchema),
  CatalogProductImage: toOpenApiSchema(catalogProductImageSchema),
  CatalogProductModifierGroup: toOpenApiSchema(catalogProductModifierGroupSchema),
  CatalogProductVariant: toOpenApiSchema(catalogProductVariantSchema),
  CatalogSnapshot: toOpenApiSchema(catalogSnapshotSchema),
  CreateBrand: toOpenApiSchema(createBrandSchema),
  CreateCatalogCategory: toOpenApiSchema(createCatalogCategorySchema),
  CreateCatalogModifierGroup: toOpenApiSchema(createCatalogModifierGroupSchema),
  CreateCatalogModifierOption: toOpenApiSchema(createCatalogModifierOptionSchema),
  CreateCatalogProduct: toOpenApiSchema(createCatalogProductSchema),
  CreateCatalogProductImage: toOpenApiSchema(createCatalogProductImageSchema),
  CreateCatalogProductModifierGroup: toOpenApiSchema(createCatalogProductModifierGroupSchema),
  CreateCatalogProductVariant: toOpenApiSchema(createCatalogProductVariantSchema),
  CreateMembership: toOpenApiSchema(createMembershipSchema),
  CreateRole: toOpenApiSchema(createRoleSchema),
  CreateOutlet: toOpenApiSchema(createOutletSchema),
  CreateTenant: toOpenApiSchema(createTenantSchema),
  CursorPageInfo: toOpenApiSchema(cursorPageInfoSchema),
  HealthResponse: toOpenApiSchema(healthResponseSchema),
  Membership: toOpenApiSchema(membershipSchema),
  EntitlementSnapshot: toOpenApiSchema(entitlementSnapshotSchema),
  ModuleEntitlement: toOpenApiSchema(moduleEntitlementSchema),
  OrganizationSnapshot: toOpenApiSchema(organizationSnapshotSchema),
  Outlet: toOpenApiSchema(outletSchema),
  PlatformEntitlementParams: toOpenApiSchema(platformEntitlementParamsSchema),
  PlatformRequestHeaders: toOpenApiSchema(platformRequestHeadersSchema),
  PlatformSession: toOpenApiSchema(platformSessionSchema),
  PlatformSetTenantEntitlement: toOpenApiSchema(platformSetTenantEntitlementSchema),
  PlatformTenantMaster: toOpenApiSchema(platformTenantMasterSchema),
  PlatformUser: toOpenApiSchema(platformUserSchema),
  ProvisionPlatformUser: toOpenApiSchema(provisionPlatformUserSchema),
  RequestContextHeaders: toOpenApiSchema(requestContextHeadersSchema),
  ReplaceSubscription: toOpenApiSchema(replaceSubscriptionSchema),
  Role: toOpenApiSchema(roleSchema),
  TenantRequestHeaders: toOpenApiSchema(tenantRequestHeadersSchema),
  Tenant: toOpenApiSchema(tenantSchema),
  SetTenantEntitlement: toOpenApiSchema(setTenantEntitlementSchema),
  Subscription: toOpenApiSchema(subscriptionSchema),
  UpdateBrand: toOpenApiSchema(updateBrandSchema),
  UpdateCatalogCategory: toOpenApiSchema(updateCatalogCategorySchema),
  UpdateCatalogModifierGroup: toOpenApiSchema(updateCatalogModifierGroupSchema),
  UpdateCatalogModifierOption: toOpenApiSchema(updateCatalogModifierOptionSchema),
  UpdateCatalogProduct: toOpenApiSchema(updateCatalogProductSchema),
  UpdateCatalogProductImage: toOpenApiSchema(updateCatalogProductImageSchema),
  UpdateCatalogProductModifierGroup: toOpenApiSchema(updateCatalogProductModifierGroupSchema),
  UpdateCatalogProductVariant: toOpenApiSchema(updateCatalogProductVariantSchema),
  UpdateMembership: toOpenApiSchema(updateMembershipSchema),
  UpdateRole: toOpenApiSchema(updateRoleSchema),
  UpdateOutlet: toOpenApiSchema(updateOutletSchema),
  UpdateTenant: toOpenApiSchema(updateTenantSchema),
  ValidationError: toOpenApiSchema(validationErrorSchema),
} as const;
