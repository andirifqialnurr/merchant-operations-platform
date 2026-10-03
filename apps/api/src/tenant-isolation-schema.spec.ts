import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(
  new URL("../../../packages/database/prisma/schema.prisma", import.meta.url),
  "utf8",
);
const organizationMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260718123000_organization_registry_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const accessMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260718140000_access_control_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const entitlementMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260720120000_subscription_entitlement_core/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const platformMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260720160000_platform_owner_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const catalogMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260720180000_catalog_category_product_core/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const catalogCompositionMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260720190000_catalog_product_composition/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const catalogOutletMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260720200000_catalog_outlet_overrides/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("keeps organization and access relations scoped by tenant composite keys", () => {
  assert.match(
    schema,
    /brand\s+Brand\s+@relation\(fields: \[tenantId, brandId\], references: \[tenantId, id\]/,
  );
  assert.match(
    schema,
    /membership\s+TenantMembership\s+@relation\(fields: \[tenantId, membershipId\], references: \[tenantId, id\]/,
  );
  assert.match(
    schema,
    /role\s+Role\s+@relation\(fields: \[tenantId, roleId\], references: \[tenantId, id\]/,
  );
  assert.match(
    schema,
    /outlet\s+Outlet\s+@relation\(fields: \[tenantId, outletId\], references: \[tenantId, id\]/,
  );
  assert.match(
    organizationMigration,
    /FOREIGN KEY \("tenant_id", "brand_id"\) REFERENCES "brands"\("tenant_id", "id"\)/,
  );
  assert.match(
    accessMigration,
    /FOREIGN KEY \("tenant_id", "membership_id"\) REFERENCES "tenant_memberships"\("tenant_id", "id"\)/,
  );
});

test("keeps current subscription and entitlement overrides isolated per tenant", () => {
  // Module overrides now live in core_entitlement_overrides (see the test for that table).
  assert.match(
    schema,
    /model CoreEntitlementOverride \{[\s\S]*@@map\("core_entitlement_overrides"\)/,
  );
  assert.match(
    entitlementMigration,
    /CREATE UNIQUE INDEX "subscriptions_current_tenant_key" ON "subscriptions"\("tenant_id"\) WHERE "superseded_at" IS NULL/,
  );
  assert.match(
    entitlementMigration,
    /FOREIGN KEY \("tenant_id"\) REFERENCES "tenants"\("id"\) ON DELETE RESTRICT/,
  );
});

test("keeps platform identities and sessions separate from tenant identities", () => {
  assert.match(schema, /model PlatformUser[\s\S]*@@map\("platform_users"\)/);
  assert.match(schema, /model PlatformLoginSession[\s\S]*@@map\("platform_login_sessions"\)/);
  assert.match(platformMigration, /CREATE TABLE "platform_users"/);
  assert.match(platformMigration, /CREATE TABLE "platform_login_sessions"/);
  assert.match(
    platformMigration,
    /FOREIGN KEY \("user_id"\) REFERENCES "platform_users"\("id"\) ON DELETE CASCADE/,
  );
});

test("keeps catalog products scoped to their tenant category and exact non-negative price", () => {
  assert.match(
    schema,
    /category\s+CatalogCategory\s+@relation\(fields: \[tenantId, categoryId\], references: \[tenantId, id\]/,
  );
  assert.match(
    catalogMigration,
    /FOREIGN KEY \("tenant_id", "category_id"\) REFERENCES "categories"\("tenant_id", "id"\)/,
  );
  assert.match(
    catalogMigration,
    /CONSTRAINT "products_base_price_minor_check" CHECK \("base_price_minor" >= 0\)/,
  );
  assert.match(catalogMigration, /'catalog\.manage', 'Manage tenant catalog'/);
});

test("keeps product composition parents tenant-scoped and composition prices non-negative", () => {
  assert.match(
    schema,
    /product\s+CatalogProduct\s+@relation\(fields: \[tenantId, productId\], references: \[tenantId, id\]/,
  );
  assert.match(
    schema,
    /modifierGroup\s+CatalogModifierGroup\s+@relation\(fields: \[tenantId, modifierGroupId\], references: \[tenantId, id\]/,
  );
  assert.match(
    catalogCompositionMigration,
    /FOREIGN KEY \("tenant_id", "product_id"\) REFERENCES "products"\("tenant_id", "id"\)/,
  );
  assert.match(
    catalogCompositionMigration,
    /FOREIGN KEY \("tenant_id", "modifier_group_id"\) REFERENCES "modifier_groups"\("tenant_id", "id"\)/,
  );
  assert.match(
    catalogCompositionMigration,
    /CONSTRAINT "modifier_groups_single_selection_check" CHECK/,
  );
  assert.match(
    catalogCompositionMigration,
    /CONSTRAINT "product_variants_price_delta_minor_check" CHECK \("price_delta_minor" >= 0\)/,
  );
  assert.match(
    catalogCompositionMigration,
    /CREATE UNIQUE INDEX "product_images_active_primary_product_key"[\s\S]*WHERE "is_primary" = TRUE AND "status" = 'ACTIVE'/,
  );
});

test("keeps outlet catalog assignments scoped to both outlet and product tenant keys", () => {
  assert.match(
    schema,
    /outlet\s+Outlet\s+@relation\(fields: \[tenantId, outletId\], references: \[tenantId, id\]/,
  );
  assert.match(
    catalogOutletMigration,
    /FOREIGN KEY \("tenant_id", "outlet_id"\) REFERENCES "outlets"\("tenant_id", "id"\)/,
  );
  assert.match(
    catalogOutletMigration,
    /FOREIGN KEY \("tenant_id", "product_id"\) REFERENCES "products"\("tenant_id", "id"\)/,
  );
  assert.match(
    catalogOutletMigration,
    /CREATE UNIQUE INDEX "outlet_products_tenant_id_outlet_id_product_id_key"/,
  );
  assert.match(
    catalogOutletMigration,
    /CONSTRAINT "outlet_products_price_override_minor_check" CHECK \([\s\S]*"price_override_minor" IS NULL OR "price_override_minor" >= 0/,
  );
});

test("keeps POS shifts tenant-scoped with one open shift per cashier and exact cash facts", () => {
  const posShiftMigration = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261002120000_pos_register_sessions/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(schema, /model PosRegisterSession[\s\S]*@@map\("pos_register_sessions"\)/);
  assert.match(schema, /model PosCashMovement[\s\S]*@@map\("pos_cash_movements"\)/);
  assert.match(
    posShiftMigration,
    /FOREIGN KEY \("tenant_id", "outlet_id"\) REFERENCES "outlets"\("tenant_id", "id"\)/,
  );
  assert.match(
    posShiftMigration,
    /FOREIGN KEY \("tenant_id", "register_session_id"\) REFERENCES "pos_register_sessions"\("tenant_id", "id"\)/,
  );
  assert.match(
    posShiftMigration,
    /CREATE UNIQUE INDEX "pos_register_sessions_one_open_per_cashier_key"\s+ON "pos_register_sessions"\("tenant_id", "outlet_id", "opened_by"\)\s+WHERE "status" = 'OPEN'/,
  );
  assert.match(
    posShiftMigration,
    /"variance_minor" = "counted_cash_minor" - "expected_cash_minor"/,
  );
  assert.match(posShiftMigration, /"amount_minor" > 0/);
});

test("keeps orders tenant-scoped with unique outlet numbers and exact line totals", () => {
  const orderMigration = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261003090000_order_intake/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(schema, /model Order \{[\s\S]*@@map\("order_orders"\)/);
  assert.match(
    schema,
    /order\s+Order\s+@relation\(fields: \[tenantId, orderId\], references: \[tenantId, id\]/,
  );
  assert.match(
    orderMigration,
    /FOREIGN KEY \("tenant_id", "order_id"\) REFERENCES "order_orders"\("tenant_id", "id"\)/,
  );
  assert.match(
    orderMigration,
    /FOREIGN KEY \("tenant_id", "order_item_id"\) REFERENCES "order_order_items"\("tenant_id", "id"\)/,
  );
  assert.match(
    orderMigration,
    /FOREIGN KEY \("tenant_id", "product_id"\) REFERENCES "products"\("tenant_id", "id"\)/,
  );
  assert.match(orderMigration, /ON "order_orders"\("tenant_id", "outlet_id", "order_number"\)/);
  assert.match(orderMigration, /ON "order_orders"\("tenant_id", "outlet_id", "idempotency_key"\)/);
  assert.match(orderMigration, /"line_total_minor" = "unit_price_minor" \* "quantity"/);
});

test("keeps bills, payments, and sales tenant-scoped with derived totals", () => {
  const billingMigration = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261003120000_billing_sales/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(schema, /model Bill \{[\s\S]*@@map\("billing_bills"\)/);
  assert.match(schema, /model Sale \{[\s\S]*@@map\("sales_sales"\)/);
  assert.match(
    billingMigration,
    /FOREIGN KEY \("tenant_id", "order_id"\) REFERENCES "order_orders"\("tenant_id", "id"\)/,
  );
  assert.match(
    billingMigration,
    /FOREIGN KEY \("tenant_id", "register_session_id"\) REFERENCES "pos_register_sessions"\("tenant_id", "id"\)/,
  );
  assert.match(
    billingMigration,
    /FOREIGN KEY \("tenant_id", "bill_id"\) REFERENCES "billing_bills"\("tenant_id", "id"\)/,
  );
  assert.match(billingMigration, /ON "billing_bills"\("tenant_id", "order_id"\)/);
  assert.match(
    billingMigration,
    /ON "billing_payments"\("tenant_id", "outlet_id", "idempotency_key"\)/,
  );
  assert.match(billingMigration, /ON "sales_sales"\("tenant_id", "bill_id"\)/);
  assert.match(
    billingMigration,
    /"total_minor" = "subtotal_minor" - "discount_minor" \+ "tax_minor" \+ "service_charge_minor" \+ "rounding_minor"/,
  );
  assert.match(billingMigration, /"tendered_minor" >= "amount_minor"/);
});

test("keeps a cancelled order with its time, actor, and reason", () => {
  const cancellationMigration = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261003150000_order_cancellation/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(cancellationMigration, /CONSTRAINT "order_orders_cancellation_check" CHECK/);
  assert.match(
    cancellationMigration,
    /"status" = 'CANCELED' AND "canceled_at" IS NOT NULL AND "canceled_by" IS NOT NULL AND "cancel_reason" IS NOT NULL/,
  );
});

test("keeps refunds tenant-scoped, positive, and tied to the sale and shift", () => {
  const refundMigration = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261003180000_sales_refunds/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(schema, /model SaleRefund \{[\s\S]*@@map\("sales_refunds"\)/);
  assert.match(
    refundMigration,
    /FOREIGN KEY \("tenant_id", "sale_id"\) REFERENCES "sales_sales"\("tenant_id", "id"\)/,
  );
  assert.match(
    refundMigration,
    /FOREIGN KEY \("tenant_id", "register_session_id"\) REFERENCES "pos_register_sessions"\("tenant_id", "id"\)/,
  );
  assert.match(
    refundMigration,
    /ON "sales_refunds"\("tenant_id", "outlet_id", "idempotency_key"\)/,
  );
  assert.match(refundMigration, /"amount_minor" > 0/);
});

test("keeps held carts tenant-scoped, labelled, and idempotent", () => {
  const heldMigration = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261003200000_pos_held_carts/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(schema, /model PosHeldCart \{[\s\S]*@@map\("pos_held_carts"\)/);
  assert.match(
    heldMigration,
    /FOREIGN KEY \("tenant_id", "outlet_id"\) REFERENCES "outlets"\("tenant_id", "id"\)/,
  );
  assert.match(heldMigration, /ON "pos_held_carts"\("tenant_id", "outlet_id", "idempotency_key"\)/);
  assert.match(heldMigration, /"item_count" > 0/);
});

test("extends the core tables for the modular platform without breaking old rows", () => {
  const adjustments = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261003230000_core_table_adjustments/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  // Workspace-level idempotency keys have no outlet and still may not repeat.
  assert.match(adjustments, /ALTER COLUMN "outlet_id" DROP NOT NULL/);
  assert.match(
    adjustments,
    /UNIQUE INDEX[\s\S]*ON "idempotency_keys" \("tenant_id", "scope", "key"\)\s+WHERE "outlet_id" IS NULL/,
  );
  // Nothing added to an existing table may be required without a default.
  for (const line of adjustments.split("\n").filter((item) => item.includes("ADD COLUMN"))) {
    assert.ok(!line.includes("NOT NULL") || line.includes("DEFAULT"), line.trim());
  }
  assert.match(adjustments, /\("type" = 'PERSONAL'\) = \("template" = 'PERSONAL'\)/);
  assert.match(schema, /model OutboxEvent \{[\s\S]*eventVersion\s+Int\s+@default\(1\)/);
  assert.match(schema, /model AuditLog \{[\s\S]*@@index\(\[tenantId, correlationId\]\)/);
});

test("keeps published package versions immutable at the database level", () => {
  const packages = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261003233000_core_packages/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(schema, /model CorePackageVersion \{[\s\S]*@@unique\(\[packageId, version\]\)/);
  // The version row and each of its three content tables are guarded by a trigger.
  assert.match(packages, /BEFORE UPDATE OR DELETE ON "core_package_versions"/);
  for (const table of [
    "core_package_modules",
    "core_package_capabilities",
    "core_package_limits",
  ]) {
    assert.match(packages, new RegExp(`BEFORE INSERT OR UPDATE OR DELETE ON "${table}"`));
  }
  assert.match(packages, /OLD\."status" = 'PUBLISHED' AND NEW\."status" = 'RETIRED'/);
  assert.match(packages, /\("status" = 'DRAFT'\) = \("published_at" IS NULL\)/);
  // Unlimited is a flag, never a large number.
  assert.match(packages, /"unlimited" AND "value" IS NULL/);
  // Existing plans are carried over rather than dropped.
  assert.match(packages, /INSERT INTO "core_packages"[\s\S]*FROM "plans"/);
  assert.doesNotMatch(packages, /DROP TABLE/);
});

test("ties subscriptions to a published package version and add-ons to their tenant", () => {
  const subscriptions = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261003235000_subscription_package_versions/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(subscriptions, /ALTER COLUMN "package_version_id" SET NOT NULL/);
  assert.match(subscriptions, /BEFORE INSERT OR UPDATE OF "package_version_id" ON "subscriptions"/);
  assert.match(subscriptions, /"cycle_ends_at" IS NULL OR "cycle_ends_at" > "cycle_starts_at"/);
  assert.match(
    subscriptions,
    /FOREIGN KEY \("tenant_id", "subscription_id"\) REFERENCES "subscriptions"\("tenant_id", "id"\)/,
  );
  assert.match(subscriptions, /"quantity" > 0/);
  assert.doesNotMatch(subscriptions, /DROP COLUMN "plan_id"/);
});

test("keeps entitlement overrides as tenant-owned history with one current decision", () => {
  const overrides = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261004000000_core_entitlement_overrides/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(overrides, /FOREIGN KEY \("tenant_id"\) REFERENCES "tenants"\("id"\)/);
  assert.match(
    overrides,
    /UNIQUE INDEX[\s\S]*\("tenant_id", "target_type", "target_key"\)\s+WHERE "ends_at" IS NULL/,
  );
  assert.match(overrides, /"ends_at" IS NULL OR "ends_at" > "starts_at"/);
  assert.match(overrides, /"target_type" = 'LIMIT' AND "operation" IN \('ADD', 'REPLACE'\)/);
  assert.match(overrides, /char_length\(btrim\("reason"\)\) >= 3/);
  assert.match(
    overrides,
    /INSERT INTO "core_entitlement_overrides"[\s\S]*FROM "tenant_entitlements"/,
  );
  assert.doesNotMatch(overrides, /DROP TABLE/);
});

test("keeps the effective entitlement projection per tenant and rebuildable", () => {
  const projection = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261004010000_core_effective_entitlements/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(projection, /PRIMARY KEY \("tenant_id", "module_key"\)/);
  // Deleting a tenant may drop its projection: nothing is lost that cannot be rebuilt.
  assert.match(
    projection,
    /FOREIGN KEY \("tenant_id"\) REFERENCES "tenants"\("id"\) ON DELETE CASCADE/,
  );
  assert.match(projection, /jsonb_typeof\("capabilities"\) = 'array'/);
  assert.match(projection, /jsonb_typeof\("limits"\) = 'array'/);
});

test("drops the legacy plan and entitlement tables only after checking nothing is lost", () => {
  const cleanup = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261004020000_drop_legacy_plans_and_entitlements/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  // Every drop comes after the block that raises when a row has no copy.
  const guards = cleanup.indexOf("DO $$");
  assert.ok(guards >= 0);
  for (const table of ["plan_modules", "plans", "tenant_entitlements"]) {
    assert.ok(cleanup.includes(`refusing to drop "${table}"`), table);
    assert.ok(cleanup.indexOf(`DROP TABLE "${table}"`) > guards, table);
    assert.ok(!schema.includes(`@@map("${table}")`), table);
  }
  assert.ok(cleanup.includes('DROP COLUMN "plan_id"'));
  assert.ok(!schema.includes("plan_id"));
});

test("keeps module installations and their settings inside one tenant", () => {
  const installations = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261004030000_core_module_installations/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  // One installation per tenant and module; provisioning twice cannot create two.
  assert.match(
    installations,
    /UNIQUE INDEX "core_module_installations_tenant_id_module_key_key"\s+ON "core_module_installations"\("tenant_id", "module_key"\)/,
  );
  // Settings can only hang off an installation of the same tenant.
  assert.match(
    installations,
    /FOREIGN KEY \("tenant_id", "installation_id"\)\s+REFERENCES "core_module_installations"\("tenant_id", "id"\)/,
  );
  // Every status that needs an explanation has one.
  for (const column of [
    "activated_at",
    "setup_required_reason",
    "error_message",
    "suspended_reason",
  ]) {
    assert.ok(installations.includes(`"${column}" IS NOT NULL`), column);
  }
  assert.match(schema, /model CoreModuleInstallation \{[\s\S]*@@unique\(\[tenantId, moduleKey\]\)/);
});

test("delivers each event to each handler at most once per tenant", () => {
  const delivery = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261004040000_outbox_dispatch_and_inbox/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    delivery,
    /UNIQUE INDEX "core_inbox_events_tenant_id_consumer_name_event_id_key"\s+ON "core_inbox_events"\("tenant_id", "consumer_name", "event_id"\)/,
  );
  assert.match(delivery, /FOREIGN KEY \("tenant_id"\) REFERENCES "tenants"\("id"\)/);
  // An event is either delivered or set aside, never both.
  assert.match(delivery, /"processed_at" IS NULL OR "failed_at" IS NULL/);
  // Anything other than "processed" must say why.
  assert.match(delivery, /"status" = 'PROCESSED' OR "last_error" IS NOT NULL/);
  assert.match(
    schema,
    /model CoreInboxEvent \{[\s\S]*@@unique\(\[tenantId, consumerName, eventId\]\)/,
  );
});

test("keeps one integration binding per route in a tenant", () => {
  const bindings = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261004050000_core_integration_bindings/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    bindings,
    /UNIQUE INDEX "core_integration_bindings_route_key"\s+ON "core_integration_bindings"\s+\("tenant_id", "source_module_key", "event_type", "target_module_key", "handler_key"\)/,
  );
  assert.match(bindings, /FOREIGN KEY \("tenant_id"\) REFERENCES "tenants"\("id"\)/);
  // A binding connects two different modules.
  assert.match(bindings, /"source_module_key" <> "target_module_key"/);
  // An error state always says why.
  assert.match(bindings, /"status" <> 'ERROR' OR "last_error" IS NOT NULL/);
  assert.match(
    schema,
    /model CoreIntegrationBinding \{[\s\S]*@@unique\(\[tenantId, sourceModuleKey, eventType, targetModuleKey, handlerKey\]/,
  );
});

test("records where the command behind an event came from", () => {
  const origin = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261004060000_outbox_command_origin/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(origin, /ADD COLUMN "channel" VARCHAR\(20\)/);
  assert.match(origin, /ADD COLUMN "device_id" UUID/);
  assert.match(origin, /ADD COLUMN "client_version" VARCHAR\(80\)/);
  // Only the channels the contract knows.
  assert.match(origin, /"channel" IN \('API', 'IMPORT', 'KDS', 'MOBILE', 'POS', 'WEB'\)/);
  // A device actor always names its device.
  assert.match(origin, /"actor_type" IS DISTINCT FROM 'DEVICE' OR "device_id" IS NOT NULL/);
  assert.match(
    schema,
    /model OutboxEvent \{[\s\S]*clientVersion\s+String\?\s+@map\("client_version"\)/,
  );
});

test("removes free text from events written before the payload guard", () => {
  const cleanup = readFileSync(
    new URL(
      "../../../packages/database/prisma/migrations/20261004070000_outbox_payload_free_text/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(cleanup, /"payload" - 'reason' - 'note' - 'notes' - 'comment'/);
  // Only events are touched; the audit trail keeps the reason.
  assert.doesNotMatch(cleanup, /audit_logs/);
});
