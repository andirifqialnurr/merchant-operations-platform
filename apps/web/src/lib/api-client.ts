import {
  API_HEADERS,
  createCustomerSchema,
  customerDetailSchema,
  customerListSchema,
  customerSchema,
  linkCustomerOrderSchema,
  orderCustomerSchema,
  type CreateCustomer,
  guestMenuSchema,
  guestProductImageParamsSchema,
  guestOrderSchema,
  guestVisitSchema,
  placeGuestOrderSchema,
  placeServiceRequestSchema,
  type ServiceRequestType,
  publicQrResolutionSchema,
  publicQrTokenParamsSchema,
  type PlaceGuestOrder,
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
  acceptGuestOrderSchema,
  rejectGuestOrderSchema,
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
  advanceKitchenTicketSchema,
  createManualKitchenTicketSchema,
  heldCartListSchema,
  kitchenTicketListSchema,
  kitchenTicketSchema,
  heldCartSchema,
  holdCartSchema,
  openRegisterSessionSchema,
  orderSchema,
  payOrderSchema,
  tableSessionCheckoutSchema,
  tableSessionDetailSchema,
  visitDocumentSchema,
  createTableOrderSchema,
  type CreateTableOrder,
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
  createRoleSchema,
  posChargesSchema,
  approvalPinStatusSchema,
  approverListSchema,
  setApprovalPinSchema,
  type SetApprovalPin,
  integrationBindingListSchema,
  integrationBindingSchema,
  brandSchema,
  createBrandSchema,
  createOutletSchema,
  organizationSnapshotSchema,
  outletSchema,
  tenantSchema,
  updateBrandSchema,
  updateOutletSchema,
  updateTenantSchema,
  type CreateBrand,
  type CreateOutlet,
  type UpdateBrand,
  type UpdateOutlet,
  type UpdateTenant,
  updateRoleSchema,
  type CreateRole,
  type UpdateRole,
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
  createKdsIntakeSourceSchema,
  createFloorAreaSchema,
  createFloorSchema,
  createFloorTableSchema,
  floorTableListSchema,
  floorPolicySchema,
  liveFloorSchema,
  tableQrSchema,
  moveTableSessionSchema,
  type MoveTableSession,
  openTableSessionSchema,
  tableSessionSchema,
  type UpdateFloorPolicy,
  updateFloorPolicySchema,
  paymentClaimSchema,
  claimGuestPaymentSchema,
  type ClaimMethod,
  type OpenTableSession,
  floorTableSchema,
  saveFloorLayoutSchema,
  type CreateFloorTable,
  type FloorTableLayout,
  floorAreaSchema,
  floorListSchema,
  floorSchema,
  reorderFloorItemsSchema,
  updateFloorAreaSchema,
  updateFloorSchema,
  type CreateFloor,
  type CreateFloorArea,
  type UpdateFloor,
  type UpdateFloorArea,
  kdsIntakeSourceCreatedSchema,
  kdsIntakeSourceListSchema,
  kdsIntakeSourceSchema,
  type CreateKdsIntakeSource,
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
  type AdvanceKitchenTicket,
  type CreateManualKitchenTicket,
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
  method: "POST" | "PATCH" | "PUT",
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
  organization: (tenantId: string) =>
    apiRequest("/organization", organizationSnapshotSchema, { headers: tenantHeaders(tenantId) }),
  updateTenant: (tenantId: string, input: UpdateTenant) =>
    jsonMutation(
      "/organization/tenant",
      "PATCH",
      input,
      updateTenantSchema,
      tenantSchema,
      tenantHeaders(tenantId),
    ),
  createBrand: (tenantId: string, input: CreateBrand) =>
    jsonMutation(
      "/organization/brands",
      "POST",
      input,
      createBrandSchema,
      brandSchema,
      tenantHeaders(tenantId),
    ),
  updateBrand: (tenantId: string, id: string, input: UpdateBrand) =>
    jsonMutation(
      `/organization/brands/${id}`,
      "PATCH",
      input,
      updateBrandSchema,
      brandSchema,
      tenantHeaders(tenantId),
    ),
  createOutlet: (tenantId: string, input: CreateOutlet) =>
    jsonMutation(
      "/organization/outlets",
      "POST",
      input,
      createOutletSchema,
      outletSchema,
      tenantHeaders(tenantId),
    ),
  updateOutlet: (tenantId: string, id: string, input: UpdateOutlet) =>
    jsonMutation(
      `/organization/outlets/${id}`,
      "PATCH",
      input,
      updateOutletSchema,
      outletSchema,
      tenantHeaders(tenantId),
    ),
  integrations: (tenantId: string) =>
    apiRequest("/modules/bindings", integrationBindingListSchema, {
      headers: tenantHeaders(tenantId),
    }),
  /** The same key for a repeat of the same press, so held events are queued once. */
  retryIntegration: (tenantId: string, id: string, idempotencyKey: string) =>
    apiRequest(`/modules/bindings/${id}/retry`, integrationBindingSchema, {
      headers: { ...tenantHeaders(tenantId), [API_HEADERS.idempotencyKey]: idempotencyKey },
      method: "POST",
    }),
  approvalPinStatus: (tenantId: string) =>
    apiRequest("/access/approval-pin", approvalPinStatusSchema, {
      headers: tenantHeaders(tenantId),
    }),
  setApprovalPin: (tenantId: string, input: SetApprovalPin) =>
    apiRequest("/access/approval-pin", noContent, {
      body: JSON.stringify(setApprovalPinSchema.parse(input)),
      headers: { ...tenantHeaders(tenantId), "Content-Type": "application/json" },
      method: "PUT",
    }),
  resetMemberApprovalPin: (tenantId: string, membershipId: string) =>
    apiRequest(`/access/members/${membershipId}/approval-pin`, noContent, {
      headers: tenantHeaders(tenantId),
      method: "DELETE",
    }),
  /** People who can approve a refund at this outlet with their PIN. */
  refundApprovers: (tenantId: string, outletId: string) =>
    apiRequest("/pos/orders/refund-approvers", approverListSchema, {
      headers: outletHeaders(tenantId, outletId),
    }),
  roles: (tenantId: string) =>
    apiRequest("/access/roles", roleListSchema, { headers: tenantHeaders(tenantId) }),
  createRole: (tenantId: string, input: CreateRole) =>
    jsonMutation(
      "/access/roles",
      "POST",
      input,
      createRoleSchema,
      roleSchema,
      tenantHeaders(tenantId),
    ),
  updateRole: (tenantId: string, id: string, input: UpdateRole) =>
    jsonMutation(
      `/access/roles/${id}`,
      "PATCH",
      input,
      updateRoleSchema,
      roleSchema,
      tenantHeaders(tenantId),
    ),
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
  /** The outside systems allowed to send kitchen tickets. Never their keys. */
  kdsIntakeSources: (tenantId: string) =>
    apiRequest("/kds/intake-sources", kdsIntakeSourceListSchema, {
      headers: tenantHeaders(tenantId),
    }),
  /** Adds a source; the answer holds its key, which is never shown again. */
  createKdsIntakeSource: (tenantId: string, input: CreateKdsIntakeSource) =>
    jsonMutation(
      "/kds/intake-sources",
      "POST",
      input,
      createKdsIntakeSourceSchema,
      kdsIntakeSourceCreatedSchema,
      tenantHeaders(tenantId),
    ),
  revokeKdsIntakeSource: (tenantId: string, id: string) =>
    apiRequest(
      `/kds/intake-sources/${entityIdParamsSchema.parse({ id }).id}/revoke`,
      kdsIntakeSourceSchema,
      { headers: tenantHeaders(tenantId), method: "POST" },
    ),
  /** The outlet's floors with their areas, active or not, in display order. */
  floors: (tenantId: string, outletId: string) =>
    apiRequest("/floor/floors", floorListSchema, { headers: outletHeaders(tenantId, outletId) }),
  createFloor: (tenantId: string, outletId: string, input: CreateFloor) =>
    jsonMutation(
      "/floor/floors",
      "POST",
      input,
      createFloorSchema,
      floorSchema,
      outletHeaders(tenantId, outletId),
    ),
  updateFloor: (tenantId: string, outletId: string, id: string, input: UpdateFloor) =>
    jsonMutation(
      `/floor/floors/${entityIdParamsSchema.parse({ id }).id}`,
      "PATCH",
      input,
      updateFloorSchema,
      floorSchema,
      outletHeaders(tenantId, outletId),
    ),
  reorderFloors: (tenantId: string, outletId: string, ids: string[]) =>
    jsonMutation(
      "/floor/floors/order",
      "POST",
      { ids },
      reorderFloorItemsSchema,
      floorListSchema,
      outletHeaders(tenantId, outletId),
    ),
  createFloorArea: (tenantId: string, outletId: string, floorId: string, input: CreateFloorArea) =>
    jsonMutation(
      `/floor/floors/${entityIdParamsSchema.parse({ id: floorId }).id}/areas`,
      "POST",
      input,
      createFloorAreaSchema,
      floorAreaSchema,
      outletHeaders(tenantId, outletId),
    ),
  updateFloorArea: (tenantId: string, outletId: string, id: string, input: UpdateFloorArea) =>
    jsonMutation(
      `/floor/areas/${entityIdParamsSchema.parse({ id }).id}`,
      "PATCH",
      input,
      updateFloorAreaSchema,
      floorAreaSchema,
      outletHeaders(tenantId, outletId),
    ),
  reorderFloorAreas: (tenantId: string, outletId: string, floorId: string, ids: string[]) =>
    jsonMutation(
      `/floor/floors/${entityIdParamsSchema.parse({ id: floorId }).id}/areas/order`,
      "POST",
      { ids },
      reorderFloorItemsSchema,
      floorListSchema,
      outletHeaders(tenantId, outletId),
    ),
  /** Who sits where right now: floors, every table's status, open visits. */
  liveFloor: (tenantId: string, outletId: string) =>
    apiRequest("/floor/live", liveFloorSchema, { headers: outletHeaders(tenantId, outletId) }),
  openTableSession: (tenantId: string, outletId: string, input: OpenTableSession) =>
    jsonMutation(
      "/floor/sessions",
      "POST",
      input,
      openTableSessionSchema,
      tableSessionSchema,
      outletHeaders(tenantId, outletId),
    ),
  /** The guests' transfer or QRIS arrived: their claim becomes the visit's payment. */
  confirmPaymentClaim: (
    tenantId: string,
    outletId: string,
    sessionId: string,
    claimId: string,
    idempotencyKey: string,
  ) =>
    apiRequest(
      `/pos/table-sessions/${entityIdParamsSchema.parse({ id: sessionId }).id}/claims/${entityIdParamsSchema.parse({ id: claimId }).id}/confirm`,
      tableSessionCheckoutSchema,
      {
        headers: {
          ...outletHeaders(tenantId, outletId),
          [API_HEADERS.idempotencyKey]: idempotencyKey,
        },
        method: "POST",
      },
    ),
  rejectPaymentClaim: (tenantId: string, outletId: string, sessionId: string, claimId: string) =>
    apiRequest(
      `/pos/table-sessions/${entityIdParamsSchema.parse({ id: sessionId }).id}/claims/${entityIdParamsSchema.parse({ id: claimId }).id}/reject`,
      paymentClaimSchema,
      { headers: outletHeaders(tenantId, outletId), method: "POST" },
    ),
  /** Customers by name, or by phone with four or more digits; the latest ones without a search. */
  searchCustomers: (tenantId: string, q: string) =>
    apiRequest(
      `/customers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
      customerListSchema,
      { headers: tenantHeaders(tenantId) },
    ),
  createCustomer: (tenantId: string, input: CreateCustomer) =>
    jsonMutation(
      "/customers",
      "POST",
      input,
      createCustomerSchema,
      customerSchema,
      tenantHeaders(tenantId),
    ),
  customerDetail: (tenantId: string, id: string) =>
    apiRequest(`/customers/${entityIdParamsSchema.parse({ id }).id}`, customerDetailSchema, {
      headers: tenantHeaders(tenantId),
    }),
  /** The customer an order is linked to, if any. */
  orderCustomer: (tenantId: string, orderId: string) =>
    apiRequest(
      `/customers/orders/${entityIdParamsSchema.parse({ id: orderId }).id}`,
      orderCustomerSchema,
      { headers: tenantHeaders(tenantId) },
    ),
  linkCustomerOrder: (tenantId: string, outletId: string, customerId: string, orderId: string) =>
    jsonMutation(
      `/customers/${entityIdParamsSchema.parse({ id: customerId }).id}/orders`,
      "POST",
      { orderId },
      linkCustomerOrderSchema,
      customerDetailSchema,
      outletHeaders(tenantId, outletId),
    ),
  /** Staff came to the table or brought the bill. */
  finishServiceRequest: (tenantId: string, outletId: string, id: string) =>
    apiRequest(`/floor/requests/${entityIdParamsSchema.parse({ id }).id}/done`, noContent, {
      headers: outletHeaders(tenantId, outletId),
      method: "POST",
    }),
  /** A table's QR and, while it works, the address to print. */
  tableQr: (tenantId: string, outletId: string, tableId: string) =>
    apiRequest(
      `/floor/tables/${entityIdParamsSchema.parse({ id: tableId }).id}/qr`,
      tableQrSchema,
      {
        headers: outletHeaders(tenantId, outletId),
      },
    ),
  generateTableQr: (tenantId: string, outletId: string, tableId: string) =>
    apiRequest(
      `/floor/tables/${entityIdParamsSchema.parse({ id: tableId }).id}/qr`,
      tableQrSchema,
      {
        headers: outletHeaders(tenantId, outletId),
        method: "POST",
      },
    ),
  /** A new QR; every printed copy of the old one stops working. */
  rotateTableQr: (tenantId: string, outletId: string, tableId: string) =>
    apiRequest(
      `/floor/tables/${entityIdParamsSchema.parse({ id: tableId }).id}/qr/rotate`,
      tableQrSchema,
      { headers: outletHeaders(tenantId, outletId), method: "POST" },
    ),
  revokeTableQr: (tenantId: string, outletId: string, tableId: string) =>
    apiRequest(
      `/floor/tables/${entityIdParamsSchema.parse({ id: tableId }).id}/qr/revoke`,
      tableQrSchema,
      { headers: outletHeaders(tenantId, outletId), method: "POST" },
    ),
  /** Moves a visit to a free table; its orders and bill stay with it. */
  moveTableSession: (tenantId: string, outletId: string, id: string, input: MoveTableSession) =>
    jsonMutation(
      `/floor/sessions/${entityIdParamsSchema.parse({ id }).id}/move`,
      "POST",
      input,
      moveTableSessionSchema,
      tableSessionSchema,
      outletHeaders(tenantId, outletId),
    ),
  closeTableSession: (tenantId: string, outletId: string, id: string) =>
    apiRequest(
      `/floor/sessions/${entityIdParamsSchema.parse({ id }).id}/close`,
      tableSessionSchema,
      { headers: outletHeaders(tenantId, outletId), method: "POST" },
    ),
  cleanTable: (tenantId: string, outletId: string, tableId: string) =>
    apiRequest(`/floor/tables/${entityIdParamsSchema.parse({ id: tableId }).id}/clean`, noContent, {
      headers: outletHeaders(tenantId, outletId),
      method: "POST",
    }),
  floorPolicy: (tenantId: string, outletId: string) =>
    apiRequest("/floor/policy", floorPolicySchema, { headers: outletHeaders(tenantId, outletId) }),
  setFloorPolicy: (tenantId: string, outletId: string, input: UpdateFloorPolicy) =>
    jsonMutation(
      "/floor/policy",
      "PUT",
      input,
      updateFloorPolicySchema,
      floorPolicySchema,
      outletHeaders(tenantId, outletId),
    ),
  /** The outlet's tables, placed or waiting in the tray. */
  floorTables: (tenantId: string, outletId: string) =>
    apiRequest("/floor/tables", floorTableListSchema, {
      headers: outletHeaders(tenantId, outletId),
    }),
  createFloorTable: (tenantId: string, outletId: string, input: CreateFloorTable) =>
    jsonMutation(
      "/floor/tables",
      "POST",
      input,
      createFloorTableSchema,
      floorTableSchema,
      outletHeaders(tenantId, outletId),
    ),
  /** Saves the changed tables of one floor, all or none. */
  saveFloorLayout: (
    tenantId: string,
    outletId: string,
    floorId: string,
    tables: FloorTableLayout[],
  ) =>
    jsonMutation(
      `/floor/floors/${entityIdParamsSchema.parse({ id: floorId }).id}/layout`,
      "PUT",
      { tables },
      saveFloorLayoutSchema,
      floorTableListSchema,
      outletHeaders(tenantId, outletId),
    ),
  /** The outlet's kitchen tickets still being worked on, oldest first. */
  kitchenTickets: (tenantId: string, outletId: string) =>
    apiRequest("/kds/tickets", kitchenTicketListSchema, {
      headers: outletHeaders(tenantId, outletId),
    }),
  /** Tickets served or canceled today at the outlet, most recent first. */
  finishedKitchenTickets: (tenantId: string, outletId: string) =>
    apiRequest("/kds/tickets/finished", kitchenTicketListSchema, {
      headers: outletHeaders(tenantId, outletId),
    }),
  /** Moves a ticket one step on from the status the screen shows. */
  advanceKitchenTicket: (
    tenantId: string,
    outletId: string,
    id: string,
    input: AdvanceKitchenTicket,
  ) =>
    jsonMutation(
      `/kds/tickets/${entityIdParamsSchema.parse({ id }).id}/advance`,
      "POST",
      input,
      advanceKitchenTicketSchema,
      kitchenTicketSchema,
      outletHeaders(tenantId, outletId),
    ),
  /** The caller keeps one key per form so a retry returns the same ticket. */
  createKitchenTicket: (
    tenantId: string,
    outletId: string,
    input: CreateManualKitchenTicket,
    idempotencyKey: string,
  ) =>
    jsonMutation(
      "/kds/tickets",
      "POST",
      input,
      createManualKitchenTicketSchema,
      kitchenTicketSchema,
      { ...outletHeaders(tenantId, outletId), [API_HEADERS.idempotencyKey]: idempotencyKey },
    ),
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
  /** How this outlet charges tax and service, to show a total before paying. */
  posCharges: (tenantId: string, outletId: string) =>
    apiRequest("/pos/orders/charges", posChargesSchema, {
      headers: outletHeaders(tenantId, outletId),
    }),
  /** Pays every unpaid order of a table visit with one payment. */
  payTableSession: (
    tenantId: string,
    outletId: string,
    sessionId: string,
    input: PayOrder,
    idempotencyKey: string,
  ) =>
    jsonMutation(
      `/pos/table-sessions/${entityIdParamsSchema.parse({ id: sessionId }).id}/payments`,
      "POST",
      input,
      payOrderSchema,
      tableSessionCheckoutSchema,
      { ...outletHeaders(tenantId, outletId), [API_HEADERS.idempotencyKey]: idempotencyKey },
    ),
  /** A visit with its orders and what is still owed. */
  visitDocument: (tenantId: string, outletId: string, sessionId: string) =>
    apiRequest(
      `/floor/sessions/${entityIdParamsSchema.parse({ id: sessionId }).id}/document`,
      visitDocumentSchema,
      { headers: outletHeaders(tenantId, outletId) },
    ),

  tableSessionDetail: (tenantId: string, outletId: string, sessionId: string) =>
    apiRequest(
      `/floor/sessions/${entityIdParamsSchema.parse({ id: sessionId }).id}`,
      tableSessionDetailSchema,
      { headers: outletHeaders(tenantId, outletId) },
    ),
  acceptGuestOrder: (tenantId: string, outletId: string, orderId: string) =>
    jsonMutation(
      `/floor/guest-orders/${entityIdParamsSchema.parse({ id: orderId }).id}/accept`,
      "POST",
      {},
      acceptGuestOrderSchema,
      orderSchema,
      outletHeaders(tenantId, outletId),
    ),
  rejectGuestOrder: (tenantId: string, outletId: string, orderId: string, reason: string) =>
    jsonMutation(
      `/floor/guest-orders/${entityIdParamsSchema.parse({ id: orderId }).id}/reject`,
      "POST",
      { reason },
      rejectGuestOrderSchema,
      orderSchema,
      outletHeaders(tenantId, outletId),
    ),
  /** One more order for the guests of a visit; the key makes a retry return the same order. */
  addTableOrder: (
    tenantId: string,
    outletId: string,
    sessionId: string,
    input: CreateTableOrder,
    idempotencyKey: string,
  ) =>
    jsonMutation(
      `/floor/sessions/${entityIdParamsSchema.parse({ id: sessionId }).id}/orders`,
      "POST",
      input,
      createTableOrderSchema,
      orderSchema,
      { ...outletHeaders(tenantId, outletId), [API_HEADERS.idempotencyKey]: idempotencyKey },
    ),
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

/** The token as part of an address, checked for shape first. */
function guestPath(token: string, rest = "") {
  return `/public/table-qr/${encodeURIComponent(publicQrTokenParamsSchema.parse({ token }).token)}${rest}`;
}

/** No workspace, internal image ID or storage address is sent to a guest image element. */
export function guestProductImageUrl(token: string, productId: string) {
  const params = guestProductImageParamsSchema.parse({ token, productId });
  return `/api/v1${guestPath(params.token, `/products/${params.productId}/image`)}`;
}

/**
 * What a guest who scanned a table's QR may ask for. No session and no
 * workspace headers: the token in the address is the only key.
 */
export const guestApi = {
  resolve: (token: string) => apiRequest(guestPath(token), publicQrResolutionSchema),
  menu: (token: string) => apiRequest(guestPath(token, "/menu"), guestMenuSchema),
  visit: (token: string) => apiRequest(guestPath(token, "/visit"), guestVisitSchema),
  /** "I have paid": the cashier checks the money and confirms. */
  claimPayment: (token: string, method: ClaimMethod, idempotencyKey: string) =>
    jsonMutation(
      guestPath(token, "/payment-claims"),
      "POST",
      { method },
      claimGuestPaymentSchema,
      guestVisitSchema,
      { [API_HEADERS.idempotencyKey]: idempotencyKey },
    ),
  /** Calls a waiter or asks for the bill; asking again while waiting changes nothing. */
  requestService: (token: string, type: ServiceRequestType) =>
    jsonMutation(
      guestPath(token, "/requests"),
      "POST",
      { type },
      placeServiceRequestSchema,
      guestVisitSchema,
      {},
    ),
  /** The same key for the same cart, so a repeated tap places one order. */
  placeOrder: (token: string, input: PlaceGuestOrder, idempotencyKey: string) =>
    jsonMutation(
      guestPath(token, "/orders"),
      "POST",
      input,
      placeGuestOrderSchema,
      guestOrderSchema,
      { [API_HEADERS.idempotencyKey]: idempotencyKey },
    ),
};

export function nextCatalogStatus(status: CatalogRecordStatus): CatalogRecordStatus {
  return status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
}
