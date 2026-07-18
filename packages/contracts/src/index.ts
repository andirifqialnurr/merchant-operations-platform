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

export type ApiError = z.infer<typeof apiErrorSchema>;
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type AuthLogoutResponse = z.infer<typeof authLogoutResponseSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type ContractSchema = z.ZodType;
export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type RequestContextHeaders = z.infer<typeof requestContextHeadersSchema>;

export function toOpenApiSchema(schema: ContractSchema) {
  return z.toJSONSchema(schema, { target: "openapi-3.0" });
}

export const commonOpenApiSchemas = {
  ApiError: toOpenApiSchema(apiErrorSchema),
  AuthLoginRequest: toOpenApiSchema(authLoginRequestSchema),
  AuthLogoutResponse: toOpenApiSchema(authLogoutResponseSchema),
  AuthSession: toOpenApiSchema(authSessionSchema),
  AuthUser: toOpenApiSchema(authUserSchema),
  CursorPageInfo: toOpenApiSchema(cursorPageInfoSchema),
  HealthResponse: toOpenApiSchema(healthResponseSchema),
  RequestContextHeaders: toOpenApiSchema(requestContextHeadersSchema),
  ValidationError: toOpenApiSchema(validationErrorSchema),
} as const;
