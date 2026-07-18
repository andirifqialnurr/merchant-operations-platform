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

export type ApiError = z.infer<typeof apiErrorSchema>;
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type AuthLogoutResponse = z.infer<typeof authLogoutResponseSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type ContractSchema = z.ZodType;
export type CreateBrand = z.infer<typeof createBrandSchema>;
export type CreateOutlet = z.infer<typeof createOutletSchema>;
export type CreateTenant = z.infer<typeof createTenantSchema>;
export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type OrganizationSnapshot = z.infer<typeof organizationSnapshotSchema>;
export type OrganizationUnitStatus = z.infer<typeof organizationUnitStatusSchema>;
export type Outlet = z.infer<typeof outletSchema>;
export type RequestContextHeaders = z.infer<typeof requestContextHeadersSchema>;
export type Tenant = z.infer<typeof tenantSchema>;
export type UpdateBrand = z.infer<typeof updateBrandSchema>;
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
  Brand: toOpenApiSchema(brandSchema),
  CreateBrand: toOpenApiSchema(createBrandSchema),
  CreateOutlet: toOpenApiSchema(createOutletSchema),
  CreateTenant: toOpenApiSchema(createTenantSchema),
  CursorPageInfo: toOpenApiSchema(cursorPageInfoSchema),
  HealthResponse: toOpenApiSchema(healthResponseSchema),
  OrganizationSnapshot: toOpenApiSchema(organizationSnapshotSchema),
  Outlet: toOpenApiSchema(outletSchema),
  RequestContextHeaders: toOpenApiSchema(requestContextHeadersSchema),
  Tenant: toOpenApiSchema(tenantSchema),
  UpdateBrand: toOpenApiSchema(updateBrandSchema),
  UpdateOutlet: toOpenApiSchema(updateOutletSchema),
  UpdateTenant: toOpenApiSchema(updateTenantSchema),
  ValidationError: toOpenApiSchema(validationErrorSchema),
} as const;
