import {
  API_HEADERS,
  apiErrorSchema,
  authLoginRequestSchema,
  authLogoutResponseSchema,
  authSessionSchema,
  catalogCategorySchema,
  catalogModifierGroupSchema,
  catalogModifierOptionSchema,
  catalogOutletProductSchema,
  catalogOutletSnapshotSchema,
  catalogProductImageSchema,
  catalogProductModifierGroupSchema,
  catalogProductSchema,
  catalogProductVariantSchema,
  catalogSnapshotSchema,
  createCatalogCategorySchema,
  createCatalogModifierGroupSchema,
  createCatalogModifierOptionSchema,
  createCatalogOutletProductForOutletSchema,
  createCatalogProductImageSchema,
  createCatalogProductModifierGroupSchema,
  createCatalogProductSchema,
  createCatalogProductVariantSchema,
  entityIdParamsSchema,
  requestContextHeadersSchema,
  tenantRequestHeadersSchema,
  updateCatalogCategorySchema,
  updateCatalogModifierGroupSchema,
  updateCatalogModifierOptionSchema,
  updateCatalogOutletProductSchema,
  updateCatalogProductImageSchema,
  updateCatalogProductModifierGroupSchema,
  updateCatalogProductSchema,
  updateCatalogProductVariantSchema,
  workspaceContextsSchema,
  type AuthLoginRequest,
  type CatalogRecordStatus,
  type CreateCatalogCategory,
  type CreateCatalogModifierGroup,
  type CreateCatalogModifierOption,
  type CreateCatalogOutletProductForOutlet,
  type CreateCatalogProduct,
  type CreateCatalogProductImage,
  type CreateCatalogProductModifierGroup,
  type CreateCatalogProductVariant,
  type UpdateCatalogCategory,
  type UpdateCatalogModifierGroup,
  type UpdateCatalogModifierOption,
  type UpdateCatalogOutletProduct,
  type UpdateCatalogProduct,
  type UpdateCatalogProductImage,
  type UpdateCatalogProductModifierGroup,
  type UpdateCatalogProductVariant,
} from "@merchant/contracts";

type Schema<T> = { parse(value: unknown): T };

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function apiRequest<T>(path: string, schema: Schema<T>, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: { Accept: "application/json", ...init.headers },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    throw new ApiClientError(
      parsed.success ? parsed.data.message : "Layanan tidak dapat memproses permintaan.",
      parsed.success ? parsed.data.code : "API_REQUEST_FAILED",
      response.status,
    );
  }
  return schema.parse(payload);
}

function tenantHeaders(tenantId: string) {
  const parsed = tenantRequestHeadersSchema.parse({
    [API_HEADERS.requestId]: `web_${crypto.randomUUID()}`,
    [API_HEADERS.tenantId]: tenantId,
  });
  return {
    [API_HEADERS.requestId]: parsed[API_HEADERS.requestId] ?? `web_${crypto.randomUUID()}`,
    [API_HEADERS.tenantId]: parsed[API_HEADERS.tenantId],
  };
}

function outletHeaders(tenantId: string, outletId: string) {
  const parsed = requestContextHeadersSchema.parse({
    [API_HEADERS.outletId]: outletId,
    [API_HEADERS.requestId]: `web_${crypto.randomUUID()}`,
    [API_HEADERS.tenantId]: tenantId,
  });
  return {
    [API_HEADERS.outletId]: parsed[API_HEADERS.outletId],
    [API_HEADERS.requestId]: parsed[API_HEADERS.requestId] ?? `web_${crypto.randomUUID()}`,
    [API_HEADERS.tenantId]: parsed[API_HEADERS.tenantId],
  };
}

function jsonMutation<TInput, TOutput>(
  path: string,
  method: "POST" | "PATCH",
  input: TInput,
  inputSchema: Schema<TInput>,
  outputSchema: Schema<TOutput>,
  headers: Record<string, string>,
) {
  return apiRequest(path, outputSchema, {
    body: JSON.stringify(inputSchema.parse(input)),
    headers: { ...headers, "Content-Type": "application/json" },
    method,
  });
}

export const merchantApi = {
  session: () => apiRequest("/auth/session", authSessionSchema),
  login: (input: AuthLoginRequest) =>
    apiRequest("/auth/login", authSessionSchema, {
      body: JSON.stringify(authLoginRequestSchema.parse(input)),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  logout: () => apiRequest("/auth/logout", authLogoutResponseSchema, { method: "POST" }),
  workspaces: () => apiRequest("/access/workspaces", workspaceContextsSchema),
  catalog: (tenantId: string) =>
    apiRequest("/catalog", catalogSnapshotSchema, { headers: tenantHeaders(tenantId) }),
  outletCatalog: (tenantId: string, outletId: string) =>
    apiRequest(`/catalog/outlets/${outletId}`, catalogOutletSnapshotSchema, {
      headers: outletHeaders(tenantId, outletId),
    }),
  createCategory: (tenantId: string, input: CreateCatalogCategory) =>
    jsonMutation(
      "/catalog/categories",
      "POST",
      input,
      createCatalogCategorySchema,
      catalogCategorySchema,
      tenantHeaders(tenantId),
    ),
  updateCategory: (tenantId: string, id: string, input: UpdateCatalogCategory) =>
    jsonMutation(
      `/catalog/categories/${entityIdParamsSchema.parse({ id }).id}`,
      "PATCH",
      input,
      updateCatalogCategorySchema,
      catalogCategorySchema,
      tenantHeaders(tenantId),
    ),
  createProduct: (tenantId: string, input: CreateCatalogProduct) =>
    jsonMutation(
      "/catalog/products",
      "POST",
      input,
      createCatalogProductSchema,
      catalogProductSchema,
      tenantHeaders(tenantId),
    ),
  updateProduct: (tenantId: string, id: string, input: UpdateCatalogProduct) =>
    jsonMutation(
      `/catalog/products/${entityIdParamsSchema.parse({ id }).id}`,
      "PATCH",
      input,
      updateCatalogProductSchema,
      catalogProductSchema,
      tenantHeaders(tenantId),
    ),
  createVariant: (tenantId: string, input: CreateCatalogProductVariant) =>
    jsonMutation(
      "/catalog/variants",
      "POST",
      input,
      createCatalogProductVariantSchema,
      catalogProductVariantSchema,
      tenantHeaders(tenantId),
    ),
  updateVariant: (tenantId: string, id: string, input: UpdateCatalogProductVariant) =>
    jsonMutation(
      `/catalog/variants/${id}`,
      "PATCH",
      input,
      updateCatalogProductVariantSchema,
      catalogProductVariantSchema,
      tenantHeaders(tenantId),
    ),
  createModifierGroup: (tenantId: string, input: CreateCatalogModifierGroup) =>
    jsonMutation(
      "/catalog/modifier-groups",
      "POST",
      input,
      createCatalogModifierGroupSchema,
      catalogModifierGroupSchema,
      tenantHeaders(tenantId),
    ),
  updateModifierGroup: (tenantId: string, id: string, input: UpdateCatalogModifierGroup) =>
    jsonMutation(
      `/catalog/modifier-groups/${id}`,
      "PATCH",
      input,
      updateCatalogModifierGroupSchema,
      catalogModifierGroupSchema,
      tenantHeaders(tenantId),
    ),
  createModifierOption: (tenantId: string, input: CreateCatalogModifierOption) =>
    jsonMutation(
      "/catalog/modifier-options",
      "POST",
      input,
      createCatalogModifierOptionSchema,
      catalogModifierOptionSchema,
      tenantHeaders(tenantId),
    ),
  updateModifierOption: (tenantId: string, id: string, input: UpdateCatalogModifierOption) =>
    jsonMutation(
      `/catalog/modifier-options/${id}`,
      "PATCH",
      input,
      updateCatalogModifierOptionSchema,
      catalogModifierOptionSchema,
      tenantHeaders(tenantId),
    ),
  createProductModifierGroup: (tenantId: string, input: CreateCatalogProductModifierGroup) =>
    jsonMutation(
      "/catalog/product-modifier-groups",
      "POST",
      input,
      createCatalogProductModifierGroupSchema,
      catalogProductModifierGroupSchema,
      tenantHeaders(tenantId),
    ),
  updateProductModifierGroup: (
    tenantId: string,
    id: string,
    input: UpdateCatalogProductModifierGroup,
  ) =>
    jsonMutation(
      `/catalog/product-modifier-groups/${id}`,
      "PATCH",
      input,
      updateCatalogProductModifierGroupSchema,
      catalogProductModifierGroupSchema,
      tenantHeaders(tenantId),
    ),
  createProductImage: (tenantId: string, input: CreateCatalogProductImage) =>
    jsonMutation(
      "/catalog/product-images",
      "POST",
      input,
      createCatalogProductImageSchema,
      catalogProductImageSchema,
      tenantHeaders(tenantId),
    ),
  updateProductImage: (tenantId: string, id: string, input: UpdateCatalogProductImage) =>
    jsonMutation(
      `/catalog/product-images/${id}`,
      "PATCH",
      input,
      updateCatalogProductImageSchema,
      catalogProductImageSchema,
      tenantHeaders(tenantId),
    ),
  createOutletProduct: (
    tenantId: string,
    outletId: string,
    input: CreateCatalogOutletProductForOutlet,
  ) =>
    jsonMutation(
      `/catalog/outlets/${outletId}/products`,
      "POST",
      input,
      createCatalogOutletProductForOutletSchema,
      catalogOutletProductSchema,
      outletHeaders(tenantId, outletId),
    ),
  updateOutletProduct: (
    tenantId: string,
    outletId: string,
    id: string,
    input: UpdateCatalogOutletProduct,
  ) =>
    jsonMutation(
      `/catalog/outlets/${outletId}/products/${id}`,
      "PATCH",
      input,
      updateCatalogOutletProductSchema,
      catalogOutletProductSchema,
      outletHeaders(tenantId, outletId),
    ),
};

export function nextCatalogStatus(status: CatalogRecordStatus): CatalogRecordStatus {
  return status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
}
