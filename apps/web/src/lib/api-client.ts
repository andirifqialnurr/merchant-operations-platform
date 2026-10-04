import {
  API_HEADERS,
  apiErrorSchema,
  authLoginRequestSchema,
  authLogoutResponseSchema,
  authSessionSchema,
  updateUserPreferencesSchema,
  catalogCategorySchema,
  catalogModifierGroupSchema,
  catalogModifierOptionSchema,
  catalogOutletProductSchema,
  catalogOutletSnapshotSchema,
  catalogProductImageSchema,
  catalogProductModifierGroupSchema,
  catalogProductSchema,
  catalogProductVariantSchema,
  cancelOrderSchema,
  catalogSnapshotSchema,
  checkoutSchema,
  closeRegisterSessionSchema,
  createCatalogCategorySchema,
  createCatalogModifierGroupSchema,
  createCatalogModifierOptionSchema,
  createCatalogOutletProductForOutletSchema,
  createCatalogProductImageSchema,
  createCatalogProductModifierGroupSchema,
  createCatalogProductSchema,
  createCatalogProductVariantSchema,
  createPosOrderSchema,
  currentRegisterSessionSchema,
  entityIdParamsSchema,
  heldCartListSchema,
  heldCartSchema,
  holdCartSchema,
  openRegisterSessionSchema,
  orderSchema,
  payOrderSchema,
  posOrderListSchema,
  receiptSchema,
  refundOrderSchema,
  saleRefundsSchema,
  recordCashMovementSchema,
  registerSessionSchema,
  resumedCartSchema,
  requestContextHeadersSchema,
  sellableMenuSchema,
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
  acceptInvitationSchema,
  createInvitationSchema,
  invitationListSchema,
  invitationSchema,
  memberListSchema,
  membershipSchema,
  roleSchema,
  sessionRevocationSchema,
  updateMembershipSchema,
  type CreateInvitation,
  type UpdateMembership,
  activateDeviceSchema,
  invitationAcceptedSchema,
  invitationPreviewSchema,
  invitationTokenRequestSchema,
  type AcceptInvitation,
  fileUploadRequestSchema,
  fileUploadTicketSchema,
  type FileUploadRequest,
  deviceActivationTicketSchema,
  deviceListSchema,
  deviceSchema,
  registerDeviceSchema,
  subscriptionOverviewSchema,
  workspaceNavigationSchema,
  type RegisterDevice,
  type AuthLoginRequest,
  type UpdateUserPreferences,
  type CancelOrder,
  type CatalogRecordStatus,
  type CloseRegisterSession,
  type CreateCatalogCategory,
  type CreateCatalogModifierGroup,
  type CreateCatalogModifierOption,
  type CreateCatalogOutletProductForOutlet,
  type CreateCatalogProduct,
  type CreateCatalogProductImage,
  type CreateCatalogProductModifierGroup,
  type CreateCatalogProductVariant,
  type CreatePosOrder,
  type HoldCart,
  type OpenRegisterSession,
  type PayOrder,
  type RefundOrder,
  type RecordCashMovement,
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
const roleListSchema = roleSchema.array();
/** For endpoints that answer 204 No Content. */
const noContent: Schema<void> = { parse: () => undefined };

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly requestId?: string,
    /** Parameters of the error, e.g. which module or which installation status. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const UNSAFE_METHODS = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const CSRF_HEADER = "x-csrf-token";
let csrfToken: string | undefined;

/**
 * The API rejects session-authenticated writes without this custom header.
 * A cross-site form cannot set it, so its presence proves a same-origin caller.
 */
function getCsrfToken() {
  csrfToken ??= crypto.randomUUID();
  return csrfToken;
}

/** Tells the API which client sent the command, so events and support can trace it. */
const CLIENT_HEADERS = {
  [API_HEADERS.clientChannel]: "WEB",
  ...(process.env.NEXT_PUBLIC_APP_VERSION
    ? { [API_HEADERS.clientVersion]: process.env.NEXT_PUBLIC_APP_VERSION }
    : {}),
};

async function apiRequest<T>(path: string, schema: Schema<T>, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...CLIENT_HEADERS,
      ...(UNSAFE_METHODS.has(method) ? { [CSRF_HEADER]: getCsrfToken() } : {}),
      ...init.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    throw new ApiClientError(
      parsed.success ? parsed.data.message : "Layanan tidak dapat memproses permintaan.",
      parsed.success ? parsed.data.code : "API_REQUEST_FAILED",
      response.status,
      parsed.success ? parsed.data.requestId : undefined,
      parsed.success ? parsed.data.details : undefined,
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

/**
 * Address of a product picture for an image element. The API answers with a
 * redirect to a short-lived signed address, so this one never expires.
 */
export function productImageUrl(tenantId: string, imageId: string) {
  return `/api/v1/catalog/tenants/${tenantId}/product-images/${imageId}/content`;
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
  updatePreferences: (input: UpdateUserPreferences) =>
    jsonMutation(
      "/auth/preferences",
      "PATCH",
      input,
      updateUserPreferencesSchema,
      authSessionSchema,
      {},
    ),
  workspaces: () => apiRequest("/access/workspaces", workspaceContextsSchema),
  /** The secret travels in the body, never in the address. */
  invitationPreview: (token: string) =>
    apiRequest("/invitations/preview", invitationPreviewSchema, {
      body: JSON.stringify(invitationTokenRequestSchema.parse({ token })),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  acceptInvitation: (input: AcceptInvitation) =>
    apiRequest("/invitations/accept", invitationAcceptedSchema, {
      body: JSON.stringify(acceptInvitationSchema.parse(input)),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  navigation: (tenantId: string) =>
    apiRequest("/modules/navigation", workspaceNavigationSchema, {
      headers: tenantHeaders(tenantId),
    }),
  /** The device this browser is activated as, or null when it is not (or was revoked). */
  currentDevice: async () => {
    try {
      return await apiRequest("/device/current", deviceSchema);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) return null;
      throw error;
    }
  },
  activateDevice: (code: string) =>
    apiRequest("/device/activate", deviceSchema, {
      body: JSON.stringify(activateDeviceSchema.parse({ code })),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  members: (tenantId: string) =>
    apiRequest("/access/members", memberListSchema, { headers: tenantHeaders(tenantId) }),
  roles: (tenantId: string) =>
    apiRequest("/access/roles", roleListSchema, { headers: tenantHeaders(tenantId) }),
  invitations: (tenantId: string) =>
    apiRequest("/access/invitations", invitationListSchema, { headers: tenantHeaders(tenantId) }),
  createInvitation: (tenantId: string, input: CreateInvitation) =>
    jsonMutation(
      "/access/invitations",
      "POST",
      input,
      createInvitationSchema,
      invitationSchema,
      tenantHeaders(tenantId),
    ),
  resendInvitation: (tenantId: string, id: string) =>
    apiRequest(`/access/invitations/${id}/resend`, invitationSchema, {
      headers: tenantHeaders(tenantId),
      method: "POST",
    }),
  revokeInvitation: (tenantId: string, id: string) =>
    apiRequest(`/access/invitations/${id}/revoke`, invitationSchema, {
      headers: tenantHeaders(tenantId),
      method: "POST",
    }),
  updateMembership: (tenantId: string, id: string, input: UpdateMembership) =>
    jsonMutation(
      `/access/memberships/${id}`,
      "PATCH",
      input,
      updateMembershipSchema,
      membershipSchema,
      tenantHeaders(tenantId),
    ),
  revokeMemberSessions: (tenantId: string, id: string) =>
    apiRequest(`/access/memberships/${id}/revoke-sessions`, sessionRevocationSchema, {
      headers: tenantHeaders(tenantId),
      method: "POST",
    }),
  devices: (tenantId: string) =>
    apiRequest("/devices", deviceListSchema, { headers: tenantHeaders(tenantId) }),
  registerDevice: (tenantId: string, input: RegisterDevice) =>
    jsonMutation(
      "/devices",
      "POST",
      input,
      registerDeviceSchema,
      deviceActivationTicketSchema,
      tenantHeaders(tenantId),
    ),
  reissueDeviceCode: (tenantId: string, deviceId: string) =>
    apiRequest(`/devices/${deviceId}/activation-code`, deviceActivationTicketSchema, {
      headers: tenantHeaders(tenantId),
      method: "POST",
    }),
  revokeDevice: (tenantId: string, deviceId: string) =>
    apiRequest(`/devices/${deviceId}/revoke`, deviceSchema, {
      headers: tenantHeaders(tenantId),
      method: "POST",
    }),
  subscription: (tenantId: string) =>
    apiRequest("/subscription", subscriptionOverviewSchema, { headers: tenantHeaders(tenantId) }),
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
  createUpload: (tenantId: string, input: FileUploadRequest) =>
    jsonMutation(
      "/files/uploads",
      "POST",
      input,
      fileUploadRequestSchema,
      fileUploadTicketSchema,
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
  currentShift: (tenantId: string, outletId: string) =>
    apiRequest("/pos/shifts/current", currentRegisterSessionSchema, {
      headers: outletHeaders(tenantId, outletId),
    }),
  openShift: (tenantId: string, outletId: string, input: OpenRegisterSession) =>
    jsonMutation(
      "/pos/shifts",
      "POST",
      input,
      openRegisterSessionSchema,
      registerSessionSchema,
      outletHeaders(tenantId, outletId),
    ),
  /** The caller keeps one key per intended movement so a retry is not recorded twice. */
  recordCashMovement: (
    tenantId: string,
    outletId: string,
    shiftId: string,
    input: RecordCashMovement,
    idempotencyKey: string,
  ) =>
    jsonMutation(
      `/pos/shifts/${entityIdParamsSchema.parse({ id: shiftId }).id}/cash-movements`,
      "POST",
      input,
      recordCashMovementSchema,
      registerSessionSchema,
      { ...outletHeaders(tenantId, outletId), [API_HEADERS.idempotencyKey]: idempotencyKey },
    ),
  closeShift: (tenantId: string, outletId: string, shiftId: string, input: CloseRegisterSession) =>
    jsonMutation(
      `/pos/shifts/${entityIdParamsSchema.parse({ id: shiftId }).id}/close`,
      "POST",
      input,
      closeRegisterSessionSchema,
      registerSessionSchema,
      outletHeaders(tenantId, outletId),
    ),
  posOrders: (tenantId: string, outletId: string) =>
    apiRequest("/pos/orders", posOrderListSchema, { headers: outletHeaders(tenantId, outletId) }),
  posOrder: (tenantId: string, outletId: string, orderId: string) =>
    apiRequest(`/pos/orders/${entityIdParamsSchema.parse({ id: orderId }).id}`, orderSchema, {
      headers: outletHeaders(tenantId, outletId),
    }),
  posReceipt: (tenantId: string, outletId: string, orderId: string) =>
    apiRequest(
      `/pos/orders/${entityIdParamsSchema.parse({ id: orderId }).id}/receipt`,
      receiptSchema,
      {
        headers: outletHeaders(tenantId, outletId),
      },
    ),
  /** The caller keeps one key per intended refund so a retry never pays out twice. */
  refundOrder: (
    tenantId: string,
    outletId: string,
    orderId: string,
    input: RefundOrder,
    idempotencyKey: string,
  ) =>
    jsonMutation(
      `/pos/orders/${entityIdParamsSchema.parse({ id: orderId }).id}/refunds`,
      "POST",
      input,
      refundOrderSchema,
      saleRefundsSchema,
      { ...outletHeaders(tenantId, outletId), [API_HEADERS.idempotencyKey]: idempotencyKey },
    ),
  cancelOrder: (tenantId: string, outletId: string, orderId: string, input: CancelOrder) =>
    jsonMutation(
      `/pos/orders/${entityIdParamsSchema.parse({ id: orderId }).id}/cancel`,
      "POST",
      input,
      cancelOrderSchema,
      orderSchema,
      outletHeaders(tenantId, outletId),
    ),
  heldCarts: (tenantId: string, outletId: string) =>
    apiRequest("/pos/held-carts", heldCartListSchema, {
      headers: outletHeaders(tenantId, outletId),
    }),
  holdCart: (tenantId: string, outletId: string, input: HoldCart, idempotencyKey: string) =>
    jsonMutation("/pos/held-carts", "POST", input, holdCartSchema, heldCartSchema, {
      ...outletHeaders(tenantId, outletId),
      [API_HEADERS.idempotencyKey]: idempotencyKey,
    }),
  resumeHeldCart: (tenantId: string, outletId: string, id: string) =>
    apiRequest(
      `/pos/held-carts/${entityIdParamsSchema.parse({ id }).id}/resume`,
      resumedCartSchema,
      { headers: outletHeaders(tenantId, outletId), method: "POST" },
    ),
  discardHeldCart: (tenantId: string, outletId: string, id: string) =>
    apiRequest(`/pos/held-carts/${entityIdParamsSchema.parse({ id }).id}`, noContent, {
      headers: outletHeaders(tenantId, outletId),
      method: "DELETE",
    }),
  posMenu: (tenantId: string, outletId: string) =>
    apiRequest("/pos/menu", sellableMenuSchema, { headers: outletHeaders(tenantId, outletId) }),
  /** The caller keeps one key per cart so a retry returns the same order. */
  submitPosOrder: (
    tenantId: string,
    outletId: string,
    input: CreatePosOrder,
    idempotencyKey: string,
  ) =>
    jsonMutation("/pos/orders", "POST", input, createPosOrderSchema, orderSchema, {
      ...outletHeaders(tenantId, outletId),
      [API_HEADERS.idempotencyKey]: idempotencyKey,
    }),
  /** The caller keeps one key per payment attempt so a retry never charges twice. */
  payOrder: (
    tenantId: string,
    outletId: string,
    orderId: string,
    input: PayOrder,
    idempotencyKey: string,
  ) =>
    jsonMutation(
      `/pos/orders/${entityIdParamsSchema.parse({ id: orderId }).id}/payments`,
      "POST",
      input,
      payOrderSchema,
      checkoutSchema,
      { ...outletHeaders(tenantId, outletId), [API_HEADERS.idempotencyKey]: idempotencyKey },
    ),
};

export function nextCatalogStatus(status: CatalogRecordStatus): CatalogRecordStatus {
  return status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
}
