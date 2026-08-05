import assert from "node:assert/strict";
import test from "node:test";
import * as z from "zod";

import {
  API_HEADERS,
  authLoginRequestSchema,
  authSessionSchema,
  createBrandSchema,
  createOutletSchema,
  createTenantSchema,
  commonOpenApiSchemas,
  catalogNameSchema,
  commandContextSchema,
  createCatalogCategorySchema,
  createDomainEventEnvelopeSchema,
  createCatalogModifierGroupSchema,
  createCatalogModifierOptionSchema,
  createCatalogOutletProductSchema,
  createCatalogOutletProductForOutletSchema,
  createCatalogProductSchema,
  createCatalogProductImageSchema,
  createCatalogProductModifierGroupSchema,
  createCatalogProductVariantSchema,
  createMembershipSchema,
  createRoleSchema,
  cursorPaginationQuerySchema,
  entitlementSnapshotSchema,
  domainEventEnvelopeSchema,
  integrationBindingSchema,
  inboxConsumerReceiptSchema,
  limitErrorDetailsSchema,
  moduleInstallationSchema,
  moduleBoundaryRuleSchema,
  moduleManifestSchema,
  MODULES,
  PLAN_CODES,
  replaceSubscriptionSchema,
  requestContextHeadersSchema,
  PERMISSIONS,
  packageVersionSnapshotSchema,
  publicQrResolutionSchema,
  supportAccessGrantSchema,
  tableQrTokenRecordSchema,
  tenantRequestHeadersSchema,
  setTenantEntitlementSchema,
  updateMembershipSchema,
  updateCatalogModifierGroupSchema,
  updateCatalogOutletProductSchema,
  updateCatalogProductSchema,
  updateTenantSchema,
  workspaceContextsSchema,
  workspaceStructureSchema,
  usageAdjustmentSchema,
  usageCounterSchema,
  usageEventSchema,
} from "./index.js";

test("normalizes cursor pagination input", () => {
  assert.deepEqual(cursorPaginationQuerySchema.parse({ limit: "40" }), { limit: 40 });
  assert.deepEqual(cursorPaginationQuerySchema.parse({}), { limit: 25 });
  assert.equal(cursorPaginationQuerySchema.safeParse({ limit: 101 }).success, false);
});

test("requires valid tenant and outlet scope headers", () => {
  const result = requestContextHeadersSchema.safeParse({
    [API_HEADERS.outletId]: "019f6f43-c11e-7aa0-a3a1-f39c7ca1a4ba",
    [API_HEADERS.tenantId]: "019f6f43-c11e-7aa0-a3a1-f39c7ca1a4bb",
  });

  assert.equal(result.success, true);
  assert.equal(requestContextHeadersSchema.safeParse({}).success, false);
});

test("exports OpenAPI-compatible common schemas", () => {
  assert.equal(commonOpenApiSchemas.ApiError.type, "object");
  assert.equal(commonOpenApiSchemas.AuthSession.type, "object");
  assert.equal(commonOpenApiSchemas.HealthResponse.type, "object");
});

test("normalizes login input and validates session output", () => {
  assert.deepEqual(
    authLoginRequestSchema.parse({ email: "  Owner@Example.com ", password: "rahasia-kuat" }),
    { email: "owner@example.com", password: "rahasia-kuat" },
  );

  assert.equal(
    authSessionSchema.safeParse({
      expiresAt: "2026-08-17T10:00:00.000Z",
      user: {
        displayName: "Pemilik Merchant",
        email: "owner@example.com",
        id: "019f738d-e61f-7d46-92de-17b35f970b91",
      },
    }).success,
    true,
  );
});

test("normalizes tenant, brand, and outlet registry input", () => {
  assert.deepEqual(
    createTenantSchema.parse({ name: "  Kopi Nusantara ", slug: "Kopi-Nusantara" }),
    {
      name: "Kopi Nusantara",
      slug: "kopi-nusantara",
    },
  );
  assert.deepEqual(createBrandSchema.parse({ name: "Kopi Kita", slug: "kopi-kita" }), {
    name: "Kopi Kita",
    slug: "kopi-kita",
  });
  assert.deepEqual(
    createOutletSchema.parse({
      brandId: "019f738d-e61f-7d46-92de-17b35f970b91",
      code: " bdg-01 ",
      name: "Bandung Utama",
    }),
    {
      brandId: "019f738d-e61f-7d46-92de-17b35f970b91",
      code: "BDG-01",
      name: "Bandung Utama",
      timezone: "Asia/Jakarta",
    },
  );
  assert.equal(updateTenantSchema.safeParse({}).success, false);
});

test("exports organization schemas for future authorized routes", () => {
  assert.equal(commonOpenApiSchemas.Tenant.type, "object");
  assert.equal(commonOpenApiSchemas.Brand.type, "object");
  assert.equal(commonOpenApiSchemas.Outlet.type, "object");
  assert.equal(commonOpenApiSchemas.OrganizationSnapshot.type, "object");
});

test("validates canonical workspace structure without requiring F&B hierarchy", () => {
  const createdAt = "2026-08-05T00:00:00.000Z";
  const workspaceId = "019f738d-e61f-7d46-92de-17b35f970b91";

  assert.equal(
    workspaceStructureSchema.safeParse({
      businessUnits: [],
      locations: [],
      workspace: {
        createdAt,
        id: workspaceId,
        name: "Keuangan Pribadi",
        slug: "keuangan-pribadi",
        status: "ACTIVE",
        template: "PERSONAL",
        type: "PERSONAL",
        updatedAt: createdAt,
      },
    }).success,
    true,
  );

  assert.equal(
    workspaceStructureSchema.safeParse({
      businessUnits: [
        {
          createdAt,
          id: "019f738d-e61f-7d46-92de-17b35f970b92",
          name: "Kopi Kita",
          slug: "kopi-kita",
          status: "ACTIVE",
          updatedAt: createdAt,
          workspaceId,
        },
      ],
      locations: [
        {
          businessUnitId: "019f738d-e61f-7d46-92de-17b35f970b92",
          code: "JKT-01",
          createdAt,
          id: "019f738d-e61f-7d46-92de-17b35f970b93",
          name: "Jakarta",
          status: "ACTIVE",
          timezone: "Asia/Jakarta",
          updatedAt: createdAt,
          workspaceId,
        },
      ],
      workspace: {
        createdAt,
        id: workspaceId,
        name: "Kopi Kita Group",
        slug: "kopi-kita-group",
        status: "ACTIVE",
        template: "CAFE",
        type: "BUSINESS",
        updatedAt: createdAt,
      },
    }).success,
    true,
  );

  assert.equal(commonOpenApiSchemas.Workspace.type, "object");
  assert.equal(commonOpenApiSchemas.BusinessUnit.type, "object");
  assert.equal(commonOpenApiSchemas.Location.type, "object");
  assert.equal(commonOpenApiSchemas.WorkspaceStructure.type, "object");
});

test("validates tenant access contracts and rejects ambiguous outlet scope", () => {
  const tenantId = "019f738d-e61f-7d46-92de-17b35f970b91";
  const outletId = "019f738d-e61f-7d46-92de-17b35f970b92";
  const roleId = "019f738d-e61f-7d46-92de-17b35f970b93";
  const userId = "019f738d-e61f-7d46-92de-17b35f970b94";

  assert.equal(
    tenantRequestHeadersSchema.safeParse({ [API_HEADERS.tenantId]: tenantId }).success,
    true,
  );
  assert.deepEqual(
    createRoleSchema.parse({
      code: " kasir_cabang ",
      name: "Kasir Cabang",
      permissionKeys: [PERMISSIONS.orderCreate, PERMISSIONS.paymentConfirm],
    }),
    {
      code: "KASIR_CABANG",
      name: "Kasir Cabang",
      permissionKeys: [PERMISSIONS.orderCreate, PERMISSIONS.paymentConfirm],
    },
  );
  assert.equal(
    createMembershipSchema.safeParse({
      allOutlets: true,
      outletIds: [outletId],
      roleIds: [roleId],
      userId,
    }).success,
    false,
  );
  assert.equal(updateMembershipSchema.safeParse({}).success, false);
});

test("exports access-control schemas to OpenAPI", () => {
  assert.equal(commonOpenApiSchemas.AuthorizationContext.type, "object");
  assert.equal(commonOpenApiSchemas.Membership.type, "object");
  assert.equal(commonOpenApiSchemas.Role.type, "object");
  assert.equal(commonOpenApiSchemas.TenantRequestHeaders.type, "object");
  assert.equal(commonOpenApiSchemas.WorkspaceContext.type, "object");
});

test("validates session workspace contexts without exposing unassigned outlets", () => {
  const tenantId = "019f738d-e61f-7d46-92de-17b35f970b91";
  const outletId = "019f738d-e61f-7d46-92de-17b35f970b92";
  assert.equal(
    workspaceContextsSchema.safeParse([
      {
        allOutlets: false,
        membershipId: "019f738d-e61f-7d46-92de-17b35f970b93",
        outlets: [{ code: "JKT-01", id: outletId, name: "Jakarta", status: "ACTIVE" }],
        permissionKeys: [PERMISSIONS.catalogRead],
        tenant: { id: tenantId, name: "Kopi Kita", slug: "kopi-kita" },
      },
    ]).success,
    true,
  );
});

test("validates subscription and entitlement core contracts", () => {
  assert.equal(
    replaceSubscriptionSchema.safeParse({
      planCode: PLAN_CODES.cafeOperations,
      startsAt: "2026-07-20T00:00:00.000Z",
      status: "ACTIVE",
    }).success,
    true,
  );
  assert.deepEqual(
    setTenantEntitlementSchema.parse({
      enabled: true,
      moduleKey: MODULES.inventoryBasic,
      reason: "  Add-on pilot merchant  ",
    }),
    {
      enabled: true,
      moduleKey: MODULES.inventoryBasic,
      reason: "Add-on pilot merchant",
    },
  );
  assert.equal(
    entitlementSnapshotSchema.safeParse({ modules: [], subscription: null }).success,
    true,
  );
  assert.equal(commonOpenApiSchemas.EntitlementSnapshot.type, "object");
});

test("validates versioned module manifests without boolean module shortcuts", () => {
  assert.equal(
    moduleManifestSchema.safeParse({
      capabilities: ["pos.order.create", "pos.payment.manual"],
      configSchemaVersion: 1,
      displayName: "POS Basic",
      eventHandlers: [{ eventType: "catalog.product_updated.v1", handlerKey: "pos.sync_catalog" }],
      eventsProduced: ["sale.completed.v1", "payment.recorded.v1"],
      installSteps: [{ key: "pos.configure_register", label: "Konfigurasi register" }],
      internalDependencies: [MODULES.coreCatalog, MODULES.corePaymentLedger],
      key: MODULES.pos,
      navigation: [{ label: "POS", path: "/pos", permissionKey: PERMISSIONS.orderCreate }],
      permissions: [PERMISSIONS.orderCreate, PERMISSIONS.paymentConfirm],
      routes: [{ path: "/pos", permissionKey: PERMISSIONS.orderCreate }],
      settings: [{ key: "pos.receipt_profile", label: "Profil struk" }],
      supportedWorkspaceTypes: ["BUSINESS"],
      version: "1.0.0",
    }).success,
    true,
  );

  assert.equal(
    moduleManifestSchema.safeParse({
      capabilities: ["pos.order.create", "pos.order.create"],
      configSchemaVersion: 1,
      displayName: "POS Basic",
      eventHandlers: [],
      eventsProduced: [],
      installSteps: [],
      internalDependencies: [],
      key: MODULES.pos,
      navigation: [],
      permissions: [],
      routes: [],
      settings: [],
      supportedWorkspaceTypes: ["BUSINESS"],
      version: "1.0.0",
    }).success,
    false,
  );

  assert.equal(
    moduleManifestSchema.safeParse({
      capabilities: [],
      configSchemaVersion: 1,
      displayName: "KDS",
      eventHandlers: [],
      eventsProduced: [],
      installSteps: [],
      internalDependencies: [MODULES.kds],
      key: MODULES.kds,
      navigation: [],
      permissions: [],
      routes: [],
      settings: [],
      supportedWorkspaceTypes: ["BUSINESS"],
      version: "1.0.0",
    }).success,
    false,
  );
  assert.equal(commonOpenApiSchemas.ModuleManifest.type, "object");
});

test("validates installation and integration binding lifecycle states", () => {
  const workspaceId = "019f738d-e61f-7d46-92de-17b35f970b91";
  const updatedAt = "2026-08-05T00:00:00.000Z";

  assert.equal(
    moduleInstallationSchema.safeParse({
      activatedAt: updatedAt,
      configSchemaVersion: 1,
      errorMessage: null,
      moduleKey: MODULES.kds,
      provisionedAt: updatedAt,
      setupRequiredReason: null,
      status: "ACTIVE",
      suspendedReason: null,
      updatedAt,
      workspaceId,
    }).success,
    true,
  );
  assert.equal(
    moduleInstallationSchema.safeParse({
      activatedAt: null,
      configSchemaVersion: 1,
      errorMessage: null,
      moduleEnabled: true,
      moduleKey: MODULES.kds,
      provisionedAt: updatedAt,
      setupRequiredReason: null,
      status: "ACTIVE",
      suspendedReason: null,
      updatedAt,
      workspaceId,
    }).success,
    false,
  );
  assert.equal(
    moduleInstallationSchema.safeParse({
      activatedAt: null,
      configSchemaVersion: 1,
      errorMessage: null,
      moduleKey: MODULES.financeBasic,
      provisionedAt: updatedAt,
      setupRequiredReason: "Hubungkan akun pendapatan.",
      status: "SETUP_REQUIRED",
      suspendedReason: null,
      updatedAt,
      workspaceId,
    }).success,
    true,
  );

  assert.equal(
    integrationBindingSchema.safeParse({
      auditReason: "POS revenue projection",
      configSchemaVersion: 1,
      effectiveFrom: updatedAt,
      effectiveTo: null,
      eventType: "sale.completed.v1",
      handlerKey: "business_finance.record_sales_revenue",
      health: "HEALTHY",
      id: "019f738d-e61f-7d46-92de-17b35f970b94",
      lastError: null,
      sourceModuleKey: MODULES.pos,
      status: "ACTIVE",
      targetModuleKey: MODULES.financeBasic,
      updatedAt,
      workspaceId,
    }).success,
    true,
  );
  assert.equal(
    integrationBindingSchema.safeParse({
      auditReason: null,
      configSchemaVersion: 1,
      effectiveFrom: updatedAt,
      effectiveTo: null,
      eventType: "sale.completed.v1",
      handlerKey: "pos.loopback",
      health: "HEALTHY",
      id: "019f738d-e61f-7d46-92de-17b35f970b94",
      lastError: null,
      sourceModuleKey: MODULES.pos,
      status: "ACTIVE",
      targetModuleKey: MODULES.pos,
      updatedAt,
      workspaceId,
    }).success,
    false,
  );
  assert.equal(commonOpenApiSchemas.ModuleInstallation.type, "object");
  assert.equal(commonOpenApiSchemas.IntegrationBinding.type, "object");
});

test("validates package snapshot and usage metering contracts", () => {
  const workspaceId = "019f738d-e61f-7d46-92de-17b35f970b91";
  const recordedAt = "2026-08-05T00:00:00.000Z";

  assert.equal(
    packageVersionSnapshotSchema.safeParse({
      createdAt: recordedAt,
      limits: [
        {
          dimensionKey: "core.users.active",
          enforcement: "HARD_COUNT",
          limitValue: "25",
          unlimited: false,
        },
        {
          dimensionKey: "api.requests.cycle",
          enforcement: "THROTTLED",
          limitValue: null,
          unlimited: true,
        },
      ],
      modules: [
        {
          capabilities: ["pos.order.create", "pos.payment.manual"],
          moduleKey: MODULES.pos,
          tier: "BASIC",
        },
      ],
      packageKey: "CAFE_OPERATIONS",
      publishedAt: recordedAt,
      version: 2,
    }).success,
    true,
  );
  assert.equal(
    packageVersionSnapshotSchema.safeParse({
      createdAt: recordedAt,
      limits: [
        {
          dimensionKey: "core.users.active",
          enforcement: "HARD_COUNT",
          limitValue: null,
          unlimited: false,
        },
      ],
      modules: [],
      packageKey: "CAFE_OPERATIONS",
      publishedAt: recordedAt,
      version: 2,
    }).success,
    false,
  );

  assert.equal(
    usageEventSchema.safeParse({
      dimensionKey: "pos.sales.completed.cycle",
      id: "019f738d-e61f-7d46-92de-17b35f970b95",
      idempotencyKey: "sale-completed:019f738d-e61f-7d46-92de-17b35f970b96",
      occurredAt: recordedAt,
      quantity: "1",
      receivedAt: recordedAt,
      sourceRecordId: "019f738d-e61f-7d46-92de-17b35f970b96",
      sourceRecordType: "sale",
      workspaceId,
    }).success,
    true,
  );
  assert.equal(
    usageCounterSchema.safeParse({
      dimensionKey: "pos.sales.completed.cycle",
      effectiveLimit: {
        dimensionKey: "pos.sales.completed.cycle",
        enforcement: "SOFT_METERED",
        limitValue: "75000",
        source: "PACKAGE",
        unlimited: false,
      },
      periodEnd: "2026-09-05T00:00:00.000Z",
      periodStart: recordedAt,
      updatedAt: recordedAt,
      used: "75001",
      workspaceId,
    }).success,
    true,
  );
  assert.equal(
    usageAdjustmentSchema.safeParse({
      actorId: "019f738d-e61f-7d46-92de-17b35f970b97",
      dimensionKey: "pos.sales.completed.cycle",
      id: "019f738d-e61f-7d46-92de-17b35f970b98",
      quantityDelta: "-1",
      reason: "Duplicate event correction",
      recordedAt,
      workspaceId,
    }).success,
    true,
  );
  assert.equal(
    limitErrorDetailsSchema.safeParse({
      allowedAction: "Nonaktifkan user lama atau tambah User Pack.",
      code: "LIMIT_REACHED",
      currentUsage: "25",
      dimensionKey: "core.users.active",
      effectiveLimit: {
        dimensionKey: "core.users.active",
        enforcement: "HARD_COUNT",
        limitValue: "25",
        source: "PACKAGE",
        unlimited: false,
      },
      message: "Batas user aktif tercapai.",
    }).success,
    true,
  );
  assert.equal(commonOpenApiSchemas.PackageVersionSnapshot.type, "object");
  assert.equal(commonOpenApiSchemas.UsageEvent.type, "object");
  assert.equal(commonOpenApiSchemas.UsageCounter.type, "object");
  assert.equal(commonOpenApiSchemas.LimitErrorDetails.type, "object");
});

test("validates domain event envelopes and inbox idempotency receipts", () => {
  const eventId = "019f738d-e61f-7d46-92de-17b35f970ba1";
  const workspaceId = "019f738d-e61f-7d46-92de-17b35f970b91";
  const recordedAt = "2026-08-05T00:00:00.000Z";

  assert.equal(
    domainEventEnvelopeSchema.safeParse({
      actor: { id: null, type: "SYSTEM" },
      businessUnitId: null,
      causationId: null,
      correlationId: "req_019f738d_e61f_7d46_92de",
      eventId,
      eventType: "sale.completed.v1",
      eventVersion: 1,
      locationId: "019f738d-e61f-7d46-92de-17b35f970b92",
      occurredAt: recordedAt,
      payload: { saleId: "sale-public-01", totalMinor: "25000" },
      producer: MODULES.pos,
      recordedAt,
      workspaceId,
    }).success,
    true,
  );

  const saleCompletedEventSchema = createDomainEventEnvelopeSchema(
    catalogNameSchema
      .transform((label) => ({ saleLabel: label }))
      .pipe(z.object({ saleLabel: catalogNameSchema })),
  );
  assert.equal(
    saleCompletedEventSchema.safeParse({
      actor: null,
      businessUnitId: null,
      causationId: null,
      correlationId: "req_019f738d_e61f_7d46_92df",
      eventId: "019f738d-e61f-7d46-92de-17b35f970ba2",
      eventType: "sale.completed.v1",
      eventVersion: 1,
      locationId: null,
      occurredAt: recordedAt,
      payload: "Sale 1001",
      producer: MODULES.pos,
      recordedAt,
      workspaceId,
    }).success,
    true,
  );

  assert.equal(
    inboxConsumerReceiptSchema.safeParse({
      consumerName: "kds-ticket-projector",
      eventId,
      firstSeenAt: recordedAt,
      lastError: null,
      lastSeenAt: recordedAt,
      status: "PROCESSED",
      workspaceId,
    }).success,
    true,
  );
  assert.equal(commonOpenApiSchemas.DomainEventEnvelope.type, "object");
  assert.equal(commonOpenApiSchemas.InboxConsumerReceipt.type, "object");
});

test("validates command context metadata for multiple adapters", () => {
  const workspaceId = "019f738d-e61f-7d46-92de-17b35f970b91";
  const receivedAt = "2026-08-05T00:00:00.000Z";

  assert.equal(
    commandContextSchema.safeParse({
      actorId: "019f738d-e61f-7d46-92de-17b35f970ba3",
      actorType: "USER",
      causationId: null,
      channel: "POS",
      clientVersion: "web-1.0.0",
      correlationId: "req_019f738d_e61f_7d46_92e0",
      deviceId: "019f738d-e61f-7d46-92de-17b35f970ba4",
      idempotencyKey: "pos-order-submit:019f738d-e61f-7d46-92de-17b35f970ba5",
      occurredAt: receivedAt,
      receivedAt,
      workspaceId,
    }).success,
    true,
  );
  assert.equal(
    commandContextSchema.safeParse({
      actorId: null,
      actorType: "DEVICE",
      causationId: null,
      channel: "KDS",
      clientVersion: null,
      correlationId: "req_019f738d_e61f_7d46_92e1",
      deviceId: null,
      idempotencyKey: "kds-ready:019f738d-e61f-7d46-92de-17b35f970ba5",
      occurredAt: receivedAt,
      receivedAt,
      workspaceId,
    }).success,
    false,
  );
  assert.equal(
    commandContextSchema.safeParse({
      actorId: null,
      actorType: "SYSTEM",
      causationId: "019f738d-e61f-7d46-92de-17b35f970ba6",
      channel: "IMPORT",
      clientVersion: null,
      correlationId: "req_019f738d_e61f_7d46_92e2",
      deviceId: null,
      idempotencyKey: "import-stock:019f738d-e61f-7d46-92de-17b35f970ba7",
      occurredAt: receivedAt,
      receivedAt,
      workspaceId,
    }).success,
    true,
  );
  assert.equal(commonOpenApiSchemas.CommandContext.type, "object");
});

test("validates support access grant scope, reason, expiry, and revocation audit", () => {
  const grantedAt = "2026-08-05T00:00:00.000Z";

  assert.equal(
    supportAccessGrantSchema.safeParse({
      auditReference: "support-case-1001",
      expiresAt: "2026-08-05T02:00:00.000Z",
      grantedAt,
      grantedByPlatformActorId: "019f738d-e61f-7d46-92de-17b35f970ba8",
      id: "019f738d-e61f-7d46-92de-17b35f970ba9",
      reason: "Investigasi konfigurasi entitlement merchant.",
      revokedAt: null,
      scope: "CONFIGURATION_SUPPORT",
      status: "ACTIVE",
      supportActorId: "019f738d-e61f-7d46-92de-17b35f970baa",
      workspaceId: "019f738d-e61f-7d46-92de-17b35f970b91",
    }).success,
    true,
  );
  assert.equal(
    supportAccessGrantSchema.safeParse({
      auditReference: "support-case-1002",
      expiresAt: "2026-08-05T02:00:00.000Z",
      grantedAt,
      grantedByPlatformActorId: "019f738d-e61f-7d46-92de-17b35f970ba8",
      id: "019f738d-e61f-7d46-92de-17b35f970bab",
      merchantSessionId: "should-not-be-here",
      reason: "Investigasi konfigurasi entitlement merchant.",
      revokedAt: null,
      scope: "TECHNICAL_SUPPORT",
      status: "REVOKED",
      supportActorId: "019f738d-e61f-7d46-92de-17b35f970baa",
      workspaceId: "019f738d-e61f-7d46-92de-17b35f970b91",
    }).success,
    false,
  );
  assert.equal(commonOpenApiSchemas.SupportAccessGrant.type, "object");
});

test("validates QR token lifecycle without exposing raw token in public DTOs", () => {
  const updatedAt = "2026-08-05T00:00:00.000Z";

  assert.equal(
    tableQrTokenRecordSchema.safeParse({
      activatedAt: updatedAt,
      hash: "a".repeat(64),
      id: "019f738d-e61f-7d46-92de-17b35f970bac",
      locationId: "019f738d-e61f-7d46-92de-17b35f970bad",
      revokedAt: null,
      rotatedFromVersion: null,
      status: "ACTIVE",
      tableId: "019f738d-e61f-7d46-92de-17b35f970bae",
      updatedAt,
      version: 1,
      workspaceId: "019f738d-e61f-7d46-92de-17b35f970b91",
    }).success,
    true,
  );
  assert.equal(
    tableQrTokenRecordSchema.safeParse({
      activatedAt: updatedAt,
      hash: "raw-token-value",
      id: "019f738d-e61f-7d46-92de-17b35f970baf",
      locationId: "019f738d-e61f-7d46-92de-17b35f970bad",
      revokedAt: null,
      rotatedFromVersion: 1,
      status: "ROTATED",
      tableId: "019f738d-e61f-7d46-92de-17b35f970bae",
      updatedAt,
      version: 2,
      workspaceId: "019f738d-e61f-7d46-92de-17b35f970b91",
    }).success,
    false,
  );
  assert.equal(
    publicQrResolutionSchema.safeParse({
      merchantName: "Kopi Kita",
      message: "Meja siap digunakan.",
      outletName: "Jakarta",
      status: "READY",
      tableLabel: "Meja 4",
    }).success,
    true,
  );
  assert.equal(
    publicQrResolutionSchema.safeParse({
      merchantName: "Kopi Kita",
      outletName: "Jakarta",
      rawToken: "secret",
      status: "READY",
      tableId: "019f738d-e61f-7d46-92de-17b35f970bae",
      tableLabel: "Meja 4",
      url: "https://example.test/qr/raw",
    }).success,
    false,
  );
  assert.equal(commonOpenApiSchemas.TableQrTokenRecord.type, "object");
  assert.equal(commonOpenApiSchemas.PublicQrResolution.type, "object");
});

test("validates module boundary rules for facade and event-only access", () => {
  assert.equal(
    moduleBoundaryRuleSchema.safeParse({
      accessType: "PUBLIC_FACADE",
      allowedDependencyKeys: [MODULES.coreCatalog],
      forbiddenRepositoryWriteKeys: [MODULES.kds, MODULES.financeBasic, MODULES.inventoryBasic],
      ownerModuleKey: MODULES.pos,
      publicFacadeKeys: ["catalog.check_sellability"],
      reason: "POS membaca sellability catalog melalui facade publik.",
    }).success,
    true,
  );
  assert.equal(
    moduleBoundaryRuleSchema.safeParse({
      accessType: "EVENT_REACTION",
      allowedDependencyKeys: [MODULES.pos],
      forbiddenRepositoryWriteKeys: [MODULES.kds],
      ownerModuleKey: MODULES.kds,
      publicFacadeKeys: [],
      reason: "KDS bereaksi dari event order tanpa menulis order repository.",
    }).success,
    false,
  );
  assert.equal(
    moduleBoundaryRuleSchema.safeParse({
      accessType: "EVENT_REACTION",
      allowedDependencyKeys: [MODULES.coreOrder],
      forbiddenRepositoryWriteKeys: [MODULES.pos, MODULES.financeBasic, MODULES.inventoryBasic],
      ownerModuleKey: MODULES.kds,
      publicFacadeKeys: [],
      reason: "KDS menerima event order dan hanya menulis repository KDS.",
    }).success,
    true,
  );
  assert.equal(commonOpenApiSchemas.ModuleBoundaryRule.type, "object");
});

test("normalizes catalog defaults and preserves exact minor-unit prices", () => {
  const category = createCatalogCategorySchema.parse({ name: "  Minuman ", slug: "Minuman" });
  assert.deepEqual(category, { displayOrder: 0, name: "Minuman", slug: "minuman" });

  const product = createCatalogProductSchema.parse({
    basePriceMinor: "25000",
    categoryId: "019f738d-e61f-7d46-92de-17b35f971101",
    name: "  Kopi Susu ",
    slug: "Kopi-Susu",
  });
  assert.equal(product.basePriceMinor, "25000");
  assert.equal(product.currency, "IDR");
  assert.equal(product.availability, "AVAILABLE");
  assert.equal(
    createCatalogProductSchema.safeParse({ ...product, basePriceMinor: "-1" }).success,
    false,
  );
  assert.equal(updateCatalogProductSchema.safeParse({}).success, false);
  assert.equal(commonOpenApiSchemas.CatalogSnapshot.type, "object");
});

test("validates product composition defaults and modifier selection rules", () => {
  const productId = "019f738d-e61f-7d46-92de-17b35f971201";
  const groupId = "019f738d-e61f-7d46-92de-17b35f971202";

  assert.deepEqual(createCatalogProductVariantSchema.parse({ name: "Regular", productId }), {
    availability: "AVAILABLE",
    displayOrder: 0,
    name: "Regular",
    priceDeltaMinor: "0",
    productId,
  });
  assert.deepEqual(createCatalogModifierGroupSchema.parse({ name: "Pilihan Gula" }), {
    displayOrder: 0,
    maxSelections: 1,
    minSelections: 0,
    name: "Pilihan Gula",
    selectionType: "SINGLE",
  });
  assert.equal(
    createCatalogModifierGroupSchema.safeParse({
      maxSelections: 2,
      minSelections: 0,
      name: "Ukuran",
      selectionType: "SINGLE",
    }).success,
    false,
  );
  assert.equal(updateCatalogModifierGroupSchema.safeParse({}).success, false);
  assert.equal(
    createCatalogModifierOptionSchema.parse({ groupId, name: "Tanpa Gula" }).priceDeltaMinor,
    "0",
  );
  assert.equal(
    createCatalogProductModifierGroupSchema.parse({ modifierGroupId: groupId, productId })
      .displayOrder,
    0,
  );
});

test("validates product image object keys and safe image metadata", () => {
  const productId = "019f738d-e61f-7d46-92de-17b35f971203";
  const image = createCatalogProductImageSchema.parse({
    contentType: "image/webp",
    height: 1200,
    objectKey: "tenant-a/catalog/kopi-susu.webp",
    productId,
    width: 1200,
  });

  assert.equal(image.isPrimary, false);
  assert.equal(image.displayOrder, 0);
  assert.equal(
    createCatalogProductImageSchema.safeParse({
      contentType: "image/svg+xml",
      objectKey: "../unsafe.svg",
      productId,
    }).success,
    false,
  );
  assert.equal(commonOpenApiSchemas.CatalogProductImage.type, "object");
  assert.equal(commonOpenApiSchemas.CatalogProductVariant.type, "object");
});

test("normalizes outlet catalog inheritance and exact price overrides", () => {
  const outletId = "019f738d-e61f-7d46-92de-17b35f971301";
  const productId = "019f738d-e61f-7d46-92de-17b35f971302";
  const inherited = createCatalogOutletProductSchema.parse({ outletId, productId });

  assert.deepEqual(inherited, {
    availabilityOverride: null,
    displayOrder: 0,
    outletId,
    priceOverrideMinor: null,
    productId,
  });
  assert.equal(
    createCatalogOutletProductSchema.parse({
      availabilityOverride: "SOLD_OUT",
      outletId,
      priceOverrideMinor: "27500",
      productId,
    }).priceOverrideMinor,
    "27500",
  );
  assert.equal(
    createCatalogOutletProductSchema.safeParse({
      outletId,
      priceOverrideMinor: "-1",
      productId,
    }).success,
    false,
  );
  assert.equal(updateCatalogOutletProductSchema.safeParse({}).success, false);
  assert.deepEqual(createCatalogOutletProductForOutletSchema.parse({ productId }), {
    availabilityOverride: null,
    displayOrder: 0,
    priceOverrideMinor: null,
    productId,
  });
  assert.equal(commonOpenApiSchemas.CatalogOutletSnapshot.type, "object");
});
